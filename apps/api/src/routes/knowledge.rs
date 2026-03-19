use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::Row as _;

use crate::{
    config::AppState,
    crypto, embeddings,
    error::{ApiResult, AppError},
    knowledge::{KnowledgeEntry, KnowledgeEntryWithContent},
    middleware::AuthUser,
};

/// Maximum accepted file size for a single knowledge entry: 10 MiB.
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/knowledge", get(list_knowledge))
        .route("/knowledge/upload", post_upload())
        .route(
            "/knowledge/:id",
            get(get_knowledge).delete(delete_knowledge),
        )
}

fn post_upload() -> axum::routing::MethodRouter<AppState> {
    axum::routing::post(upload_knowledge)
}

// ---------------------------------------------------------------------------
// POST /knowledge/upload
// ---------------------------------------------------------------------------

async fn upload_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> ApiResult<(StatusCode, Json<Vec<KnowledgeEntry>>)> {
    let mut uploaded: Vec<KnowledgeEntry> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("multipart error: {e}")))?
    {
        let filename = field
            .file_name()
            .ok_or_else(|| AppError::BadRequest("Missing filename in multipart field".into()))?
            .to_owned();

        let ext = std::path::Path::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if ext != "md" && ext != "txt" && ext != "markdown" {
            return Err(AppError::BadRequest(format!(
                "Only .md/.txt/.markdown files allowed, got: {filename}"
            )));
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("failed to read field bytes: {e}")))?;

        if data.len() > MAX_FILE_SIZE {
            return Err(AppError::PayloadTooLarge);
        }

        let content_str = std::str::from_utf8(&data)
            .map_err(|_| AppError::BadRequest("File content is not valid UTF-8".into()))?;

        let size_bytes = i64::try_from(data.len())
            .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
        let (ciphertext, nonce) = crypto::encrypt(&state.encryption_key, &data)?;

        // Derive title from filename (strip extension).
        let title = std::path::Path::new(&filename)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&filename)
            .to_owned();

        let entry_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        let user_id = &claims.sub;
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        sqlx::query(
            r"INSERT INTO knowledge_base
               (id, user_id, title, source, content_enc, nonce, size_bytes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry_id)
        .bind(user_id)
        .bind(&title)
        .bind("")
        .bind(&ciphertext)
        .bind(&nonce)
        .bind(size_bytes)
        .bind(&now)
        .bind(&now)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

        // Generate and store embedding — failure is non-fatal.
        spawn_knowledge_embedding(&state, entry_id.clone(), content_str.to_owned());

        uploaded.push(KnowledgeEntry {
            id: entry_id,
            title,
            source: String::new(),
            size_bytes,
            created_at: now.clone(),
            updated_at: now,
        });
    }

    if uploaded.is_empty() {
        return Err(AppError::BadRequest(
            "No files provided in the request".into(),
        ));
    }

    Ok((StatusCode::CREATED, Json(uploaded)))
}

// ---------------------------------------------------------------------------
// GET /knowledge
// ---------------------------------------------------------------------------

async fn list_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<KnowledgeEntry>>> {
    let rows = sqlx::query(
        r"SELECT id, title, source, size_bytes, created_at, updated_at
           FROM knowledge_base
           WHERE user_id = ?
           ORDER BY updated_at DESC",
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let entries = rows
        .into_iter()
        .map(|r| -> ApiResult<KnowledgeEntry> {
            Ok(KnowledgeEntry {
                id: r.try_get("id").map_err(AppError::from)?,
                title: r.try_get("title").map_err(AppError::from)?,
                source: r.try_get("source").map_err(AppError::from)?,
                size_bytes: r.try_get("size_bytes").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
                updated_at: r.try_get("updated_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(entries))
}

// ---------------------------------------------------------------------------
// GET /knowledge/:id
// ---------------------------------------------------------------------------

async fn get_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<KnowledgeEntryWithContent>> {
    let row = sqlx::query(
        r"SELECT id, title, source, content_enc, nonce, size_bytes, created_at, updated_at
           FROM knowledge_base
           WHERE id = ? AND user_id = ?",
    )
    .bind(&id)
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let content_enc: Vec<u8> = row.try_get("content_enc").map_err(AppError::from)?;
    let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;
    let plaintext = crypto::decrypt(&state.encryption_key, &content_enc, &nonce)?;
    let content = String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8 decode: {e}")))?;

    Ok(Json(KnowledgeEntryWithContent {
        id: row.try_get("id").map_err(AppError::from)?,
        title: row.try_get("title").map_err(AppError::from)?,
        source: row.try_get("source").map_err(AppError::from)?,
        content,
        size_bytes: row.try_get("size_bytes").map_err(AppError::from)?,
        created_at: row.try_get("created_at").map_err(AppError::from)?,
        updated_at: row.try_get("updated_at").map_err(AppError::from)?,
    }))
}

// ---------------------------------------------------------------------------
// DELETE /knowledge/:id
// ---------------------------------------------------------------------------

async fn delete_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query(
        "DELETE FROM knowledge_base WHERE id = ? AND user_id = ?",
    )
    .bind(&id)
    .bind(&claims.sub)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Clean up embedding — failure is non-fatal.
    if let Err(e) = embeddings::delete_knowledge_embedding(&state.db, &id).await {
        tracing::warn!("Failed to delete knowledge embedding for {id}: {e}");
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Spawns a background task to generate and store an embedding for `entry_id`.
/// Logs a warning on failure — never panics, never fails the calling request.
fn spawn_knowledge_embedding(state: &AppState, entry_id: String, content: String) {
    if state.voyage_api_key.is_empty() {
        return;
    }
    let state = state.clone();
    tokio::spawn(async move {
        match embeddings::generate_embedding(
            &state.http_client,
            &state.voyage_api_key,
            &content,
            "document",
        )
        .await
        {
            Ok(emb) => {
                if let Err(e) =
                    embeddings::upsert_knowledge_embedding(&state.db, &entry_id, &emb).await
                {
                    tracing::warn!(
                        "Failed to store knowledge embedding for {entry_id}: {e}"
                    );
                }
            }
            Err(e) => {
                tracing::warn!("Failed to generate knowledge embedding for {entry_id}: {e}");
            }
        }
    });
}
