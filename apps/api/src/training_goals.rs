use serde::{Deserialize, Serialize};

/// Persisted training goals for a user, injected into the chat context when active.
#[derive(Debug, Serialize)]
pub struct TrainingGoals {
    /// Free-form text describing the user's current training focus and weak points.
    pub goals: String,
    /// Whether the goals block is prepended to the chat system prompt.
    pub active: bool,
    /// ISO-8601 timestamp of the last update.
    pub updated_at: String,
}

/// Request body for `PUT /training-goals`.
#[derive(Debug, Deserialize)]
pub struct UpdateTrainingGoalsRequest {
    /// New goals text. Omit to keep existing value.
    pub goals: Option<String>,
    /// New active state. Omit to keep existing value.
    pub active: Option<bool>,
}
