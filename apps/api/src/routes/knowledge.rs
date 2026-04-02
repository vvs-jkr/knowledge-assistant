use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::Row as _;

use crate::{
    config::AppState,
    crypto, embeddings,
    error::{ApiResult, AppError},
    knowledge::{
        validate_knowledge_doc_type, validate_knowledge_review_status, CreateKnowledgeRequest,
        KnowledgeEntry, KnowledgeEntryWithContent, KnowledgeListQuery,
    },
    middleware::AuthUser,
};

/// Maximum accepted file size for a single knowledge entry: 10 MiB.
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/knowledge", get(list_knowledge).post(create_knowledge))
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
        let tags_json = "[]";
        let metadata_json = "{}";

        sqlx::query(
            r"INSERT INTO knowledge_base
               (id, user_id, title, source, doc_type, tags_json, review_status, use_for_generation,
                metadata_json, content_enc, nonce, size_bytes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry_id)
        .bind(user_id)
        .bind(&title)
        .bind("")
        .bind("general")
        .bind(tags_json)
        .bind("reviewed")
        .bind(1_i64)
        .bind(metadata_json)
        .bind(&ciphertext)
        .bind(&nonce)
        .bind(size_bytes)
        .bind(&now)
        .bind(&now)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

        // Generate and store embedding -- failure is non-fatal.
        spawn_knowledge_embedding(&state, entry_id.clone(), content_str.to_owned());

        uploaded.push(KnowledgeEntry {
            id: entry_id,
            title,
            source: String::new(),
            doc_type: "general".to_owned(),
            tags: Vec::new(),
            review_status: "reviewed".to_owned(),
            use_for_generation: true,
            metadata: serde_json::json!({}),
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
// POST /knowledge
// ---------------------------------------------------------------------------

async fn create_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateKnowledgeRequest>,
) -> ApiResult<(StatusCode, Json<KnowledgeEntryWithContent>)> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("content is required".into()));
    }

    let doc_type = body.doc_type.as_deref().unwrap_or("general");
    validate_knowledge_doc_type(doc_type)?;

    let review_status = body.review_status.as_deref().unwrap_or("reviewed");
    validate_knowledge_review_status(review_status)?;

    let source = body.source.unwrap_or_default();
    let tags = body.tags.unwrap_or_default();
    let metadata = body.metadata.unwrap_or_else(|| serde_json::json!({}));
    let tags_json = serde_json::to_string(&tags)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize tags: {e}")))?;
    let metadata_json = serde_json::to_string(&metadata)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize metadata: {e}")))?;
    let content_bytes = body.content.into_bytes();
    let size_bytes = i64::try_from(content_bytes.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
    let (ciphertext, nonce) = crypto::encrypt(&state.encryption_key, &content_bytes)?;

    let entry_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let use_for_generation = body.use_for_generation.unwrap_or(true);

    sqlx::query(
        r"INSERT INTO knowledge_base
           (id, user_id, title, source, doc_type, tags_json, review_status, use_for_generation,
            metadata_json, content_enc, nonce, size_bytes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&entry_id)
    .bind(&claims.sub)
    .bind(body.title.trim())
    .bind(&source)
    .bind(doc_type)
    .bind(&tags_json)
    .bind(review_status)
    .bind(if use_for_generation { 1_i64 } else { 0_i64 })
    .bind(&metadata_json)
    .bind(&ciphertext)
    .bind(&nonce)
    .bind(size_bytes)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    let content = String::from_utf8(content_bytes)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8 decode: {e}")))?;
    spawn_knowledge_embedding(&state, entry_id.clone(), content.clone());

    Ok((
        StatusCode::CREATED,
        Json(KnowledgeEntryWithContent {
            id: entry_id,
            title: body.title.trim().to_owned(),
            source,
            doc_type: doc_type.to_owned(),
            tags,
            review_status: review_status.to_owned(),
            use_for_generation,
            metadata,
            content,
            size_bytes,
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

// ---------------------------------------------------------------------------
// GET /knowledge
// ---------------------------------------------------------------------------

async fn list_knowledge(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<KnowledgeListQuery>,
) -> ApiResult<Json<Vec<KnowledgeEntry>>> {
    if let Some(doc_type) = params.doc_type.as_deref() {
        validate_knowledge_doc_type(doc_type)?;
    }

    let rows = sqlx::query(
        r"SELECT id, title, source, doc_type, tags_json, review_status, use_for_generation,
                  metadata_json, size_bytes, created_at, updated_at
           FROM knowledge_base
           WHERE user_id = ?
             AND (? IS NULL OR doc_type = ?)
             AND (? IS NULL OR use_for_generation = ?)
           ORDER BY updated_at DESC",
    )
    .bind(&claims.sub)
    .bind(params.doc_type.as_deref())
    .bind(params.doc_type.as_deref())
    .bind(params.use_for_generation)
    .bind(params.use_for_generation.map(i64::from))
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let entries = rows
        .into_iter()
        .map(|r| -> ApiResult<KnowledgeEntry> {
            let tags_json: String = r.try_get("tags_json").map_err(AppError::from)?;
            let metadata_json: String = r.try_get("metadata_json").map_err(AppError::from)?;
            Ok(KnowledgeEntry {
                id: r.try_get("id").map_err(AppError::from)?,
                title: r.try_get("title").map_err(AppError::from)?,
                source: r.try_get("source").map_err(AppError::from)?,
                doc_type: r.try_get("doc_type").map_err(AppError::from)?,
                tags: serde_json::from_str(&tags_json)
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("parse tags_json: {e}")))?,
                review_status: r.try_get("review_status").map_err(AppError::from)?,
                use_for_generation: r
                    .try_get::<i64, _>("use_for_generation")
                    .map_err(AppError::from)?
                    != 0,
                metadata: serde_json::from_str(&metadata_json)
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("parse metadata_json: {e}")))?,
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
        r"SELECT id, title, source, doc_type, tags_json, review_status, use_for_generation,
                  metadata_json, content_enc, nonce, size_bytes, created_at, updated_at
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
    let tags_json: String = row.try_get("tags_json").map_err(AppError::from)?;
    let metadata_json: String = row.try_get("metadata_json").map_err(AppError::from)?;
    let plaintext = crypto::decrypt(&state.encryption_key, &content_enc, &nonce)?;
    let content = String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8 decode: {e}")))?;

    Ok(Json(KnowledgeEntryWithContent {
        id: row.try_get("id").map_err(AppError::from)?,
        title: row.try_get("title").map_err(AppError::from)?,
        source: row.try_get("source").map_err(AppError::from)?,
        doc_type: row.try_get("doc_type").map_err(AppError::from)?,
        tags: serde_json::from_str(&tags_json)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("parse tags_json: {e}")))?,
        review_status: row.try_get("review_status").map_err(AppError::from)?,
        use_for_generation: row
            .try_get::<i64, _>("use_for_generation")
            .map_err(AppError::from)?
            != 0,
        metadata: serde_json::from_str(&metadata_json)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("parse metadata_json: {e}")))?,
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
    let result = sqlx::query("DELETE FROM knowledge_base WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&claims.sub)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Clean up embedding -- failure is non-fatal.
    if let Err(e) = embeddings::delete_knowledge_embedding(&state.db, &id).await {
        tracing::warn!("Failed to delete knowledge embedding for {id}: {e}");
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Spawns a background task to generate and store an embedding for `entry_id`.
/// Logs a warning on failure -- never panics, never fails the calling request.
fn spawn_knowledge_embedding(state: &AppState, entry_id: String, content: String) {
    if state.embedding_api_key.is_empty() {
        return;
    }
    let state = state.clone();
    tokio::spawn(async move {
        match embeddings::generate_embedding(
            &state.http_client,
            &state.embedding_api_key,
            &content,
            "document",
        )
        .await
        {
            Ok(emb) => {
                if let Err(e) =
                    embeddings::upsert_knowledge_embedding(&state.db, &entry_id, &emb).await
                {
                    tracing::warn!("Failed to store knowledge embedding for {entry_id}: {e}");
                }
            }
            Err(e) => {
                tracing::warn!("Failed to generate knowledge embedding for {entry_id}: {e}");
            }
        }
    });
}
