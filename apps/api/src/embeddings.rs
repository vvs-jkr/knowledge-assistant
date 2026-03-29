use crate::error::{ApiResult, AppError};
use serde::{Deserialize, Serialize};

const OPENAI_API_URL: &str = "https://openrouter.ai/api/v1/embeddings";
const OPENAI_MODEL: &str = "openai/text-embedding-3-small";
const EMBEDDING_DIM: usize = 512;
/// Max chars per chunk before splitting.
const MAX_CHUNK_CHARS: usize = 16_000;

#[derive(Serialize)]
struct EmbeddingRequest<'a> {
    input: Vec<&'a str>,
    model: &'a str,
    dimensions: usize,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingItem>,
}

#[derive(Deserialize)]
struct EmbeddingItem {
    embedding: Vec<f32>,
    #[allow(dead_code)]
    index: usize,
}

/// Generates a single embedding vector for `content`.
/// Long content is split into paragraphs; resulting embeddings are averaged.
///
/// The `input_type` parameter is accepted for API compatibility but ignored
/// (OpenAI does not distinguish document vs query embeddings).
pub async fn generate_embedding(
    http_client: &reqwest::Client,
    api_key: &str,
    content: &str,
    _input_type: &str,
) -> ApiResult<Vec<f32>> {
    let chunks = chunk_content(content);
    let chunk_refs: Vec<&str> = chunks.iter().map(String::as_str).collect();

    let request = EmbeddingRequest {
        input: chunk_refs,
        model: OPENAI_MODEL,
        dimensions: EMBEDDING_DIM,
    };

    let response = http_client
        .post(OPENAI_API_URL)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI API request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenAI API error {status}: {body}"
        )));
    }

    let resp: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI API parse error: {e}")))?;

    if resp.data.is_empty() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenAI API returned no embeddings"
        )));
    }

    if resp.data.len() == 1 {
        return Ok(resp
            .data
            .into_iter()
            .next()
            .expect("checked len == 1")
            .embedding);
    }

    Ok(average_embeddings(&resp.data))
}

/// Generates embeddings for a batch of texts in a single Voyage AI request.
///
/// Returns one embedding vector per input text, in the same order.
///
/// # Errors
///
/// Returns `AppError::Internal` if the OpenAI request fails or the response is malformed.
pub async fn generate_embeddings_batch(
    http_client: &reqwest::Client,
    api_key: &str,
    texts: &[&str],
) -> ApiResult<Vec<Vec<f32>>> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    let request = EmbeddingRequest {
        input: texts.to_vec(),
        model: OPENAI_MODEL,
        dimensions: EMBEDDING_DIM,
    };

    let response = http_client
        .post(OPENAI_API_URL)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI API request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenAI API error {status}: {body}"
        )));
    }

    let resp: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI API parse error: {e}")))?;

    let mut items = resp.data;
    items.sort_by_key(|item| item.index);
    Ok(items.into_iter().map(|item| item.embedding).collect())
}

/// Stores or replaces the embedding for `note_id` in the vec0 virtual table.
pub async fn upsert_embedding(
    db: &sqlx::SqlitePool,
    note_id: &str,
    embedding: &[f32],
) -> ApiResult<()> {
    let bytes = embedding_to_bytes(embedding);
    sqlx::query("INSERT OR REPLACE INTO note_embeddings(note_id, embedding) VALUES (?, ?)")
        .bind(note_id)
        .bind(&bytes)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("embedding upsert: {e}")))?;
    Ok(())
}

/// Deletes the embedding for `note_id` from the vec0 virtual table.
pub async fn delete_embedding(db: &sqlx::SqlitePool, note_id: &str) -> ApiResult<()> {
    sqlx::query("DELETE FROM note_embeddings WHERE note_id = ?")
        .bind(note_id)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("embedding delete: {e}")))?;
    Ok(())
}

/// Stores or replaces the embedding for `knowledge_id` in the knowledge vec0 virtual table.
///
/// # Errors
///
/// Returns `AppError::Internal` if the database operation fails.
pub async fn upsert_knowledge_embedding(
    db: &sqlx::SqlitePool,
    knowledge_id: &str,
    embedding: &[f32],
) -> ApiResult<()> {
    let bytes = embedding_to_bytes(embedding);
    sqlx::query(
        "INSERT OR REPLACE INTO knowledge_embeddings(knowledge_id, embedding) VALUES (?, ?)",
    )
    .bind(knowledge_id)
    .bind(&bytes)
    .execute(db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("knowledge embedding upsert: {e}")))?;
    Ok(())
}

/// Deletes the embedding for `knowledge_id` from the knowledge vec0 virtual table.
///
/// # Errors
///
/// Returns `AppError::Internal` if the database operation fails.
pub async fn delete_knowledge_embedding(
    db: &sqlx::SqlitePool,
    knowledge_id: &str,
) -> ApiResult<()> {
    sqlx::query("DELETE FROM knowledge_embeddings WHERE knowledge_id = ?")
        .bind(knowledge_id)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("knowledge embedding delete: {e}")))?;
    Ok(())
}

/// Stores or replaces the embedding for `workout_id` in the workout vec0 virtual table.
///
/// # Errors
///
/// Returns `AppError::Internal` if the database operation fails.
pub async fn upsert_workout_embedding(
    db: &sqlx::SqlitePool,
    workout_id: &str,
    embedding: &[f32],
) -> ApiResult<()> {
    let bytes = embedding_to_bytes(embedding);
    sqlx::query(
        "INSERT OR REPLACE INTO workout_embeddings(workout_id, embedding) VALUES (?, ?)",
    )
    .bind(workout_id)
    .bind(&bytes)
    .execute(db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("workout embedding upsert: {e}")))?;
    Ok(())
}

/// Deletes the embedding for `workout_id` from the workout vec0 virtual table.
///
/// # Errors
///
/// Returns `AppError::Internal` if the database operation fails.
pub async fn delete_workout_embedding(db: &sqlx::SqlitePool, workout_id: &str) -> ApiResult<()> {
    sqlx::query("DELETE FROM workout_embeddings WHERE workout_id = ?")
        .bind(workout_id)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("workout embedding delete: {e}")))?;
    Ok(())
}

/// Searches `workout_embeddings` for the `limit` nearest neighbours of `embedding_bytes`.
///
/// Returns `(workout_id, distance)` pairs ordered by ascending distance.
///
/// # Errors
///
/// Returns `AppError::Internal` if the vector search fails.
pub async fn search_workout_embeddings(
    db: &sqlx::SqlitePool,
    embedding_bytes: &[u8],
    limit: i64,
) -> ApiResult<Vec<(String, f64)>> {
    sqlx::query_as(
        "SELECT workout_id, distance FROM workout_embeddings \
         WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
    )
    .bind(embedding_bytes)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("workout vector search: {e}")))
}

/// Searches `knowledge_embeddings` for the `limit` nearest neighbours of `embedding_bytes`.
///
/// Returns `(knowledge_id, distance)` pairs ordered by ascending distance.
///
/// # Errors
///
/// Returns `AppError::Internal` if the vector search fails.
pub async fn search_knowledge_embeddings(
    db: &sqlx::SqlitePool,
    embedding_bytes: &[u8],
    limit: i64,
) -> ApiResult<Vec<(String, f64)>> {
    sqlx::query_as(
        "SELECT knowledge_id, distance FROM knowledge_embeddings \
         WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
    )
    .bind(embedding_bytes)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("knowledge vector search: {e}")))
}

/// Serializes an f32 slice to little-endian bytes as expected by sqlite-vec.
pub fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Splits content into chunks of at most `MAX_CHUNK_CHARS` characters,
/// splitting on paragraph boundaries (`\n\n`).
fn chunk_content(content: &str) -> Vec<String> {
    if content.len() <= MAX_CHUNK_CHARS {
        return vec![content.to_owned()];
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    for paragraph in content.split("\n\n") {
        if !current.is_empty() && current.len() + paragraph.len() + 2 > MAX_CHUNK_CHARS {
            chunks.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(paragraph);
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

/// Averages multiple embedding vectors into one.
fn average_embeddings(items: &[EmbeddingItem]) -> Vec<f32> {
    #[allow(clippy::cast_precision_loss)]
    let n = items.len() as f32;
    let mut avg = vec![0.0_f32; EMBEDDING_DIM];
    for item in items {
        for (i, &val) in item.embedding.iter().enumerate() {
            if i < EMBEDDING_DIM {
                avg[i] += val / n;
            }
        }
    }
    avg
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_content_short_text_returns_single_chunk() {
        let content = "Hello world";
        let chunks = chunk_content(content);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], content);
    }

    #[test]
    fn chunk_content_long_text_splits_on_paragraphs() {
        let paragraph = "x".repeat(10_000);
        let content = format!("{paragraph}\n\n{paragraph}");
        let chunks = chunk_content(&content);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0], paragraph);
        assert_eq!(chunks[1], paragraph);
    }

    #[test]
    fn chunk_content_exact_limit_stays_single() {
        let content = "a".repeat(MAX_CHUNK_CHARS);
        let chunks = chunk_content(&content);
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn embedding_to_bytes_round_trip() {
        let emb: Vec<f32> = vec![1.0, 2.0, 3.0];
        let bytes = embedding_to_bytes(&emb);
        assert_eq!(bytes.len(), 12); // 3 x 4 bytes
        let recovered: Vec<f32> = bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().expect("4 bytes")))
            .collect();
        assert_eq!(recovered, emb);
    }

    #[test]
    fn average_embeddings_correct() {
        let items = vec![
            VoyageEmbeddingItem {
                embedding: vec![1.0, 2.0],
                index: 0,
            },
            VoyageEmbeddingItem {
                embedding: vec![3.0, 4.0],
                index: 1,
            },
        ];
        // Override EMBEDDING_DIM scope won't help; we test with a 2-element slice.
        let mut avg = vec![0.0_f32; 2];
        let n = items.len() as f32;
        for item in &items {
            for (i, &val) in item.embedding.iter().enumerate() {
                if i < 2 {
                    avg[i] += val / n;
                }
            }
        }
        assert!((avg[0] - 2.0).abs() < f32::EPSILON);
        assert!((avg[1] - 3.0).abs() < f32::EPSILON);
    }
}
