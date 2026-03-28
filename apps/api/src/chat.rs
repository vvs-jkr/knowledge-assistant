use serde::{Deserialize, Serialize};

/// A chat session (conversation thread).
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

/// A single message within a session.
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    /// `"user"` or `"assistant"`
    pub role: String,
    pub content: String,
    pub created_at: String,
}

/// Request body for sending a message.
#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

/// Request body for renaming a session.
#[derive(Debug, Deserialize)]
pub struct RenameSessionRequest {
    pub title: String,
}
