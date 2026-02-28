use axum::{
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};

use crate::{
    config::AppState,
    crypto,
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
        .route(
            "/notes/:id",
            get(get_note).put(update_note).delete(delete_note),
        )
        .route("/notes/:id/download", get(download_note))
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

async fn list_notes(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<NoteMetadata>>> {
    let rows = sqlx::query!(
        r#"SELECT id, filename, mime_type, size_bytes, frontmatter, created_at, updated_at
           FROM note_files
           WHERE user_id = ?
           ORDER BY updated_at DESC"#,
        claims.sub,
    )
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let notes = rows
        .into_iter()
        .map(|r| {
            let frontmatter = r
                .frontmatter
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            NoteMetadata {
                id: r.id.unwrap_or_default(),
                filename: r.filename,
                mime_type: r.mime_type,
                size_bytes: r.size_bytes,
                frontmatter,
                created_at: r.created_at,
                updated_at: r.updated_at,
            }
        })
        .collect();

    Ok(Json(notes))
}

// ---------------------------------------------------------------------------
// GET /notes/{id}
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
// PUT /notes/{id}
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
// DELETE /notes/{id}
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

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /notes/{id}/download
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
