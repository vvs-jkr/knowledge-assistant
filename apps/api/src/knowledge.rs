use serde::Serialize;

/// Knowledge base entry metadata returned by list/upload endpoints.
#[derive(Debug, Serialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub source: String,
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
    pub content: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub updated_at: String,
}
