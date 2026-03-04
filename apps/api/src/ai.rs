use crate::error::{ApiResult, AppError};
use serde::{Deserialize, Serialize};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const ANTHROPIC_MODEL: &str = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteAnalysis {
    pub summary: String,
    /// Subjective quality score from 1 (poor) to 10 (excellent).
    pub quality_score: u8,
    pub improvement_suggestions: Vec<String>,
    pub duplicate_candidates: Vec<DuplicateCandidate>,
    pub tags_suggested: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateCandidate {
    pub note_id: String,
    pub filename: String,
    pub similarity_reason: String,
}

// ---------------------------------------------------------------------------
// Anthropic API request/response shapes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<AnthropicMessage<'a>>,
}

#[derive(Serialize)]
struct AnthropicMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Sends `note_content` to Claude for analysis.
///
/// `other_notes_context` should be a plain-text summary of other notes in the
/// knowledge base so Claude can check for duplicates.
pub async fn analyze_note(
    http_client: &reqwest::Client,
    anthropic_api_key: &str,
    note_content: &str,
    note_filename: &str,
    other_notes_context: &str,
) -> ApiResult<NoteAnalysis> {
    let system = system_prompt();
    let user_content = build_user_message(note_content, note_filename, other_notes_context);

    let request = AnthropicRequest {
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: &system,
        messages: vec![AnthropicMessage {
            role: "user",
            content: &user_content,
        }],
    };

    let response = http_client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", anthropic_api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Anthropic API request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Anthropic API error {status}: {body}"
        )));
    }

    let api_resp: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Anthropic API parse error: {e}")))?;

    let text = api_resp
        .content
        .iter()
        .find(|b| b.block_type == "text")
        .and_then(|b| b.text.as_deref())
        .ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!("No text block in Anthropic response"))
        })?;

    serde_json::from_str::<NoteAnalysis>(text)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse analysis JSON: {e}")))
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

fn system_prompt() -> String {
    r#"You are a knowledge base analyst. Analyze the provided note and return ONLY valid JSON — no markdown fences, no extra text — with exactly this structure:
{
  "summary": "2-3 sentence summary",
  "quality_score": 7,
  "improvement_suggestions": ["suggestion 1", "suggestion 2"],
  "duplicate_candidates": [
    {"note_id": "id", "filename": "name.md", "similarity_reason": "reason"}
  ],
  "tags_suggested": ["tag1", "tag2"]
}

Rules:
- quality_score: integer 1-10 (structure, completeness, clarity)
- improvement_suggestions: actionable, specific; empty array if none needed
- duplicate_candidates: only include notes with genuinely overlapping content; empty array if none
- tags_suggested: short topic tags useful for search/organisation"#
        .into()
}

fn build_user_message(content: &str, filename: &str, other_notes_context: &str) -> String {
    if other_notes_context.is_empty() {
        format!("Filename: {filename}\n\nContent:\n{content}\n\nNo other notes in the knowledge base yet.")
    } else {
        format!(
            "Filename: {filename}\n\nContent:\n{content}\n\n---\nOther notes for dedup check:\n{other_notes_context}"
        )
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_prompt_is_non_empty() {
        assert!(!system_prompt().is_empty());
    }

    #[test]
    fn build_user_message_includes_content() {
        let msg = build_user_message("note body", "test.md", "");
        assert!(msg.contains("note body"));
        assert!(msg.contains("test.md"));
    }

    #[test]
    fn build_user_message_includes_context_when_provided() {
        let msg = build_user_message("body", "file.md", "other note context");
        assert!(msg.contains("other note context"));
    }

    #[test]
    fn note_analysis_round_trips_json() {
        let analysis = NoteAnalysis {
            summary: "A great note".into(),
            quality_score: 8,
            improvement_suggestions: vec!["Add examples".into()],
            duplicate_candidates: vec![],
            tags_suggested: vec!["rust".into()],
        };
        let json = serde_json::to_string(&analysis).expect("serialize");
        let parsed: NoteAnalysis = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.quality_score, 8);
        assert_eq!(parsed.tags_suggested, vec!["rust"]);
    }
}
