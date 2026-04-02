use serde::{Deserialize, Serialize};

pub const VALID_KNOWLEDGE_DOC_TYPES: &[&str] = &[
    "general",
    "archive_workout",
    "book_excerpt",
    "programming_principle",
    "exercise_note",
    "coach_note",
    "user_preference",
];

pub const VALID_KNOWLEDGE_REVIEW_STATUSES: &[&str] = &["draft", "reviewed", "needs_review"];

/// Knowledge base entry metadata returned by list/upload endpoints.
#[derive(Debug, Serialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub source: String,
    pub doc_type: String,
    pub tags: Vec<String>,
    pub review_status: String,
    pub use_for_generation: bool,
    pub metadata: serde_json::Value,
    pub size_bytes: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Full knowledge entry with decrypted content.
#[derive(Debug, Serialize)]
pub struct KnowledgeEntryWithContent {
    pub id: String,
    pub title: String,
    pub source: String,
    pub doc_type: String,
    pub tags: Vec<String>,
    pub review_status: String,
    pub use_for_generation: bool,
    pub metadata: serde_json::Value,
    pub content: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateKnowledgeRequest {
    pub title: String,
    pub content: String,
    pub source: Option<String>,
    pub doc_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub review_status: Option<String>,
    pub use_for_generation: Option<bool>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct KnowledgeListQuery {
    pub doc_type: Option<String>,
    pub use_for_generation: Option<bool>,
}

use crate::error::{ApiResult, AppError};

pub fn validate_knowledge_doc_type(value: &str) -> ApiResult<()> {
    if VALID_KNOWLEDGE_DOC_TYPES.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Invalid doc_type '{value}': must be one of {VALID_KNOWLEDGE_DOC_TYPES:?}"
        )))
    }
}

pub fn validate_knowledge_review_status(value: &str) -> ApiResult<()> {
    if VALID_KNOWLEDGE_REVIEW_STATUSES.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Invalid review_status '{value}': must be one of {VALID_KNOWLEDGE_REVIEW_STATUSES:?}"
        )))
    }
}
