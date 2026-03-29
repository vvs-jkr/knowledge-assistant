use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::Row as _;

use crate::{
    ai,
    config::AppState,
    crypto, embeddings,
    error::{ApiResult, AppError},
    middleware::AuthUser,
    notes::{extract_frontmatter, NoteMetadata, NoteWithContent, UpdateNoteRequest},
};

/// Maximum accepted file size for a single note: 10 MiB.
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/notes", get(list_notes))
        .route("/notes/upload", post(upload_note))
        .route("/notes/search", post(search_notes))
        .route(
            "/notes/:id",
            get(get_note).put(update_note).delete(delete_note),
        )
        .route("/notes/:id/download", get(download_note))
        .route("/notes/:id/analyze", post(analyze_note_handler))
        .route("/notes/:id/improve", post(improve_note_handler))
}

// ---------------------------------------------------------------------------
// POST /notes/upload
// ---------------------------------------------------------------------------

async fn upload_note(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> ApiResult<(StatusCode, Json<Vec<NoteMetadata>>)> {
    let mut uploaded: Vec<NoteMetadata> = Vec::new();

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
        if ext != "md" && ext != "markdown" {
            return Err(AppError::BadRequest(format!(
                "Only .md/.markdown files allowed, got: {filename}"
            )));
        }

        let mime_type = field.content_type().unwrap_or("text/markdown").to_owned();

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("failed to read field bytes: {e}")))?;

        if data.len() > MAX_FILE_SIZE {
            return Err(AppError::PayloadTooLarge);
        }

        let content_str = std::str::from_utf8(&data)
            .map_err(|_| AppError::BadRequest("File content is not valid UTF-8".into()))?;

        let (frontmatter, _body) = extract_frontmatter(content_str);
        let frontmatter_json = frontmatter_to_sql(frontmatter.as_ref())?;

        let size_bytes = i64::try_from(data.len())
            .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
        let (ciphertext, nonce) = crypto::encrypt(&state.encryption_key, &data)?;

        let note_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        let user_id = &claims.sub;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        sqlx::query!(
            r#"INSERT INTO note_files
               (id, user_id, filename, mime_type, size_bytes, encrypted_content, nonce, frontmatter, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            note_id,
            user_id,
            filename,
            mime_type,
            size_bytes,
            ciphertext,
            nonce,
            frontmatter_json,
            now,
            now,
        )
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

        // Generate and store embedding -- failure is non-fatal.
        spawn_embedding(&state, note_id.clone(), content_str.to_owned());

        uploaded.push(NoteMetadata {
            id: note_id,
            filename,
            mime_type,
            size_bytes,
            frontmatter,
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
// GET /notes
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
struct NotesQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_notes(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<NotesQuery>,
) -> ApiResult<Json<Vec<NoteMetadata>>> {
    use sqlx::Row as _;

    let limit = params.limit.unwrap_or(100).min(200);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query(
        r"SELECT id, filename, mime_type, size_bytes, frontmatter, created_at, updated_at
           FROM note_files
           WHERE user_id = ?
           ORDER BY updated_at DESC
           LIMIT ? OFFSET ?",
    )
    .bind(&claims.sub)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let notes = rows
        .into_iter()
        .map(|r| -> ApiResult<NoteMetadata> {
            let frontmatter_str: Option<String> =
                r.try_get("frontmatter").map_err(AppError::from)?;
            let frontmatter = frontmatter_str
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            Ok(NoteMetadata {
                id: r.try_get("id").map_err(AppError::from)?,
                filename: r.try_get("filename").map_err(AppError::from)?,
                mime_type: r.try_get("mime_type").map_err(AppError::from)?,
                size_bytes: r.try_get("size_bytes").map_err(AppError::from)?,
                frontmatter,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
                updated_at: r.try_get("updated_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(notes))
}

// ---------------------------------------------------------------------------
// GET /notes/:id
// ---------------------------------------------------------------------------

async fn get_note(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<NoteWithContent>> {
    let row = sqlx::query!(
        r#"SELECT id, filename, encrypted_content, nonce, frontmatter, created_at, updated_at
           FROM note_files
           WHERE id = ? AND user_id = ?"#,
        id,
        claims.sub,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let plaintext = crypto::decrypt(&state.encryption_key, &row.encrypted_content, &row.nonce)?;
    let content = String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8 decode: {e}")))?;

    let frontmatter = row
        .frontmatter
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

    Ok(Json(NoteWithContent {
        id: row.id.unwrap_or_default(),
        filename: row.filename,
        content,
        frontmatter,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

// ---------------------------------------------------------------------------
// PUT /notes/:id
// ---------------------------------------------------------------------------

async fn update_note(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateNoteRequest>,
) -> ApiResult<Json<NoteMetadata>> {
    // Fetch current row to verify ownership and get current filename/mime.
    let current = sqlx::query!(
        "SELECT filename, mime_type, created_at FROM note_files WHERE id = ? AND user_id = ?",
        id,
        claims.sub,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let content_bytes = body.content.as_bytes();
    if content_bytes.len() > MAX_FILE_SIZE {
        return Err(AppError::PayloadTooLarge);
    }

    let new_filename = body.filename.unwrap_or(current.filename);
    let (frontmatter, _body_text) = extract_frontmatter(&body.content);
    let frontmatter_json = frontmatter_to_sql(frontmatter.as_ref())?;
    let size_bytes = i64::try_from(content_bytes.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
    let (ciphertext, nonce) = crypto::encrypt(&state.encryption_key, content_bytes)?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query!(
        r#"UPDATE note_files
           SET encrypted_content = ?, nonce = ?, size_bytes = ?, frontmatter = ?,
               filename = ?, updated_at = ?
           WHERE id = ?"#,
        ciphertext,
        nonce,
        size_bytes,
        frontmatter_json,
        new_filename,
        now,
        id,
    )
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    // Re-generate embedding -- failure is non-fatal.
    spawn_embedding(&state, id.clone(), body.content.clone());

    Ok(Json(NoteMetadata {
        id,
        filename: new_filename,
        mime_type: current.mime_type,
        size_bytes,
        frontmatter,
        created_at: current.created_at,
        updated_at: now,
    }))
}

// ---------------------------------------------------------------------------
// DELETE /notes/:id
// ---------------------------------------------------------------------------

async fn delete_note(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM note_files WHERE id = ? AND user_id = ?",
        id,
        claims.sub,
    )
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Clean up embedding -- failure is non-fatal.
    if let Err(e) = embeddings::delete_embedding(&state.db, &id).await {
        tracing::warn!("Failed to delete embedding for note {id}: {e}");
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /notes/:id/download
// ---------------------------------------------------------------------------

async fn download_note(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let row = sqlx::query!(
        "SELECT filename, encrypted_content, nonce FROM note_files WHERE id = ? AND user_id = ?",
        id,
        claims.sub,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let plaintext = crypto::decrypt(&state.encryption_key, &row.encrypted_content, &row.nonce)?;

    let content_disposition = format!("attachment; filename=\"{}\"", row.filename);

    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                "text/markdown; charset=utf-8".to_owned(),
            ),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        plaintext,
    ))
}

// ---------------------------------------------------------------------------
// POST /notes/search
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct SearchRequest {
    query: String,
    #[serde(default = "default_limit")]
    limit: u32,
}

fn default_limit() -> u32 {
    10
}

#[derive(serde::Serialize)]
struct SearchResult {
    note_id: String,
    filename: String,
    distance: f64,
    snippet: String,
    frontmatter: Option<serde_json::Value>,
}

async fn search_notes(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SearchRequest>,
) -> ApiResult<Json<Vec<SearchResult>>> {
    if body.query.trim().is_empty() {
        return Err(AppError::BadRequest("Search query cannot be empty".into()));
    }

    if state.embedding_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Search is not configured (missing OPENROUTER_API_KEY)".into(),
        ));
    }

    // Embed the query.
    let query_embedding = embeddings::generate_embedding(
        &state.http_client,
        &state.embedding_api_key,
        &body.query,
        "query",
    )
    .await?;

    let embedding_bytes = embeddings::embedding_to_bytes(&query_embedding);
    // Request more than `limit` to account for ownership filtering.
    let fetch_limit = i64::from((body.limit * 3).min(150));

    // Vector KNN search via sqlite-vec.
    let rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT note_id, distance FROM note_embeddings WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
    )
    .bind(&embedding_bytes)
    .bind(fetch_limit)
    .fetch_all(&state.db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("vector search: {e}")))?;

    let limit = body.limit.min(50) as usize;
    let mut results: Vec<SearchResult> = Vec::new();

    for (note_id, distance) in rows {
        if results.len() >= limit {
            break;
        }

        // Ownership check + metadata fetch.
        let note = sqlx::query!(
            "SELECT filename, encrypted_content, nonce, frontmatter FROM note_files WHERE id = ? AND user_id = ?",
            note_id,
            claims.sub,
        )
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

        let Some(note) = note else { continue };

        let snippet =
            match crypto::decrypt(&state.encryption_key, &note.encrypted_content, &note.nonce) {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    make_snippet(&text, &body.query, 200)
                }
                Err(_) => String::new(),
            };

        let frontmatter = note
            .frontmatter
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        results.push(SearchResult {
            note_id,
            filename: note.filename,
            distance,
            snippet,
            frontmatter,
        });
    }

    Ok(Json(results))
}

// ---------------------------------------------------------------------------
// POST /notes/:id/analyze
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct AnalyzeResponse {
    analysis: ai::NoteAnalysis,
}

async fn analyze_note_handler(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<AnalyzeResponse>> {
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI analysis is not configured (missing ANTHROPIC_API_KEY)".into(),
        ));
    }

    // Fetch and decrypt target note.
    let row = sqlx::query!(
        "SELECT filename, encrypted_content, nonce FROM note_files WHERE id = ? AND user_id = ?",
        id,
        claims.sub,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let plaintext = crypto::decrypt(&state.encryption_key, &row.encrypted_content, &row.nonce)?;
    let content = String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8: {e}")))?;

    // Build context from other notes (first 200 chars each, up to 30 notes).
    let other_rows = sqlx::query!(
        "SELECT id, filename, encrypted_content, nonce FROM note_files WHERE user_id = ? AND id != ? LIMIT 30",
        claims.sub,
        id,
    )
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut context_lines: Vec<String> = Vec::new();
    for note in &other_rows {
        let note_id = note.id.as_deref().unwrap_or("?");
        if let Ok(bytes) =
            crypto::decrypt(&state.encryption_key, &note.encrypted_content, &note.nonce)
        {
            let text = String::from_utf8_lossy(&bytes);
            let preview: String = text.chars().take(200).collect();
            context_lines.push(format!(
                "- [{}] (id: {}): {}...",
                note.filename, note_id, preview
            ));
        } else {
            context_lines.push(format!("- [{}] (id: {})", note.filename, note_id));
        }
    }
    let other_notes_context = context_lines.join("\n");

    let analysis = ai::analyze_note(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &content,
        &row.filename,
        &other_notes_context,
    )
    .await?;

    Ok(Json(AnalyzeResponse { analysis }))
}

// ---------------------------------------------------------------------------
// POST /notes/:id/improve
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct ImproveResponse {
    improved_content: String,
}

async fn improve_note_handler(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ImproveResponse>> {
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI is not configured (missing API key)".into(),
        ));
    }

    let row =
        sqlx::query("SELECT encrypted_content, nonce FROM note_files WHERE id = ? AND user_id = ?")
            .bind(&id)
            .bind(&claims.sub)
            .fetch_optional(&state.db)
            .await
            .map_err(AppError::from)?
            .ok_or(AppError::NotFound)?;

    let encrypted_content: Vec<u8> = row.try_get("encrypted_content").map_err(AppError::from)?;
    let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;
    let plaintext = crypto::decrypt(&state.encryption_key, &encrypted_content, &nonce)?;
    let content = String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("utf8: {e}")))?;

    let improved_content = ai::improve_note(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &content,
    )
    .await?;

    Ok(Json(ImproveResponse { improved_content }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Serialises an optional frontmatter `JsonValue` to an `Option<String>` for SQL binding.
fn frontmatter_to_sql(frontmatter: Option<&serde_json::Value>) -> ApiResult<Option<String>> {
    frontmatter
        .map(|v| {
            serde_json::to_string(v)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("frontmatter serialise: {e}")))
        })
        .transpose()
}

/// Returns a text snippet centred around the first occurrence of `query` in `content`.
fn make_snippet(content: &str, query: &str, max_len: usize) -> String {
    let query_lower = query.to_lowercase();
    let content_lower = content.to_lowercase();

    let pos = content_lower.find(query_lower.as_str()).unwrap_or(0);
    let start = pos.saturating_sub(max_len / 2);
    // Clamp to char boundary.
    let start = content
        .char_indices()
        .map(|(i, _)| i)
        .rfind(|&i| i <= start)
        .unwrap_or(0);

    let snippet: String = content[start..].chars().take(max_len).collect();

    if start == 0 {
        format!("{snippet}...")
    } else {
        format!("...{snippet}...")
    }
}

/// Spawns a background task to generate and store an embedding for `note_id`.
/// Logs a warning on failure -- never panics, never fails the calling request.
fn spawn_embedding(state: &AppState, note_id: String, content: String) {
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
                if let Err(e) = embeddings::upsert_embedding(&state.db, &note_id, &emb).await {
                    tracing::warn!("Failed to store embedding for note {note_id}: {e}");
                }
            }
            Err(e) => tracing::warn!("Failed to generate embedding for note {note_id}: {e}"),
        }
    });
}
