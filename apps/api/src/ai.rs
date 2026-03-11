use crate::{
    error::{ApiResult, AppError},
    health::LabExtraction,
};
use serde::{Deserialize, Serialize};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const ANTHROPIC_MODEL: &str = "claude-3-5-sonnet-20241022";

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
// Anthropic API request/response shapes — text messages
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

// ---------------------------------------------------------------------------
// Anthropic API request/response shapes — PDF document messages
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct PdfAnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<PdfMessage>,
}

#[derive(Serialize)]
struct PdfMessage {
    role: String,
    content: Vec<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Shared response shape
// ---------------------------------------------------------------------------

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

    serde_json::from_str::<NoteAnalysis>(extract_json_object(text))
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
// Health lab extraction (PDF → structured metrics)
// ---------------------------------------------------------------------------

/// Sends a base64-encoded PDF to Claude and returns extracted lab metrics.
///
/// The `pdf_base64` argument must be standard base64 (no line breaks).
pub async fn extract_lab_metrics(
    http_client: &reqwest::Client,
    anthropic_api_key: &str,
    pdf_base64: &str,
    pdf_filename: &str,
) -> ApiResult<LabExtraction> {
    let system = lab_system_prompt();
    let content = vec![
        serde_json::json!({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": pdf_base64
            }
        }),
        serde_json::json!({
            "type": "text",
            "text": format!(
                "Filename: {pdf_filename}\n\nExtract all lab metrics from this document."
            )
        }),
    ];

    let request = PdfAnthropicRequest {
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: &system,
        messages: vec![PdfMessage {
            role: "user".into(),
            content,
        }],
    };

    let response = http_client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", anthropic_api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("anthropic-beta", "pdfs-2024-09-25")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Anthropic PDF request failed: {e}")))?;

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
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Anthropic PDF parse error: {e}")))?;

    let text = api_resp
        .content
        .iter()
        .find(|b| b.block_type == "text")
        .and_then(|b| b.text.as_deref())
        .ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!("No text block in Anthropic PDF response"))
        })?;

    serde_json::from_str::<LabExtraction>(extract_json_object(text)).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse lab extraction JSON: {e}"))
    })
}

fn lab_system_prompt() -> String {
    r#"You are a medical lab report analyzer. Extract lab metrics from the provided PDF document.

Return ONLY valid JSON — no markdown fences, no extra text — with exactly this structure:
{
  "lab_date": "YYYY-MM-DD",
  "lab_name": "Laboratory Name",
  "metrics": [
    {
      "metric_name": "canonical_name",
      "value": 5.1,
      "unit": "mmol/L",
      "reference_min": 3.9,
      "reference_max": 6.1,
      "status": "normal"
    }
  ]
}

Canonical metric names (ONLY use these — omit any metric not in this list):
- glucose (blood glucose, mmol/L)
- cholesterol_total (total cholesterol, mmol/L)
- cholesterol_hdl (HDL cholesterol, mmol/L)
- cholesterol_ldl (LDL cholesterol, mmol/L)
- hemoglobin (hemoglobin, g/L)
- platelets (platelets/thrombocytes, ×10⁹/L)
- leukocytes (white blood cells, ×10⁹/L)
- erythrocytes (red blood cells, ×10¹²/L)
- esr (erythrocyte sedimentation rate, mm/h)
- creatinine (creatinine, μmol/L)
- alt (alanine aminotransferase, U/L)
- ast (aspartate aminotransferase, U/L)

Rules:
- lab_date: collection/result date from the PDF in YYYY-MM-DD format; use today if not found
- lab_name: laboratory name from the document header; use empty string if not found
- Only include metrics that are actually present in the PDF
- Normalize all values to the units listed above
- status: "low" if value < reference_min, "high" if value > reference_max, "normal" otherwise
- reference_min / reference_max: null if the PDF does not provide a reference range
- value: numeric, floating point"#
        .into()
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/// Extracts the outermost JSON object `{...}` from an LLM response string.
///
/// Claude sometimes wraps the JSON in markdown code fences (` ```json...``` `)
/// or adds preamble text. This function strips fences and finds the JSON boundaries.
fn extract_json_object(text: &str) -> &str {
    // First strip any markdown code fences.
    let text = text.trim();
    let inner = if let Some(rest) = text.strip_prefix("```json").or_else(|| text.strip_prefix("```")) {
        // Skip to end of opening fence line.
        let after_fence = match rest.find('\n') {
            Some(pos) => &rest[pos + 1..],
            None => rest,
        };
        // Strip closing fence.
        after_fence
            .trim_end()
            .strip_suffix("```")
            .unwrap_or(after_fence)
            .trim()
    } else {
        text
    };

    // Find the outermost { ... } block.
    if let Some(start) = inner.find('{') {
        if let Some(end) = inner.rfind('}') {
            if end >= start {
                return &inner[start..=end];
            }
        }
    }

    inner
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::ExtractedMetric;

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

    #[test]
    fn lab_system_prompt_is_non_empty() {
        assert!(!lab_system_prompt().is_empty());
    }

    #[test]
    fn lab_system_prompt_contains_all_metric_names() {
        let prompt = lab_system_prompt();
        for name in &[
            "glucose",
            "cholesterol_total",
            "hemoglobin",
            "platelets",
            "leukocytes",
            "creatinine",
            "alt",
            "ast",
        ] {
            assert!(prompt.contains(name), "prompt missing metric: {name}");
        }
    }

    #[test]
    fn lab_extraction_round_trips_json() {
        let extraction = LabExtraction {
            lab_date: "2026-01-15".into(),
            lab_name: "City Lab".into(),
            metrics: vec![ExtractedMetric {
                metric_name: "glucose".into(),
                value: 5.1,
                unit: "mmol/L".into(),
                reference_min: Some(3.9),
                reference_max: Some(6.1),
                status: "normal".into(),
            }],
        };
        let json = serde_json::to_string(&extraction).expect("serialize");
        let parsed: LabExtraction = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.lab_date, "2026-01-15");
        assert_eq!(parsed.metrics.len(), 1);
        assert_eq!(parsed.metrics[0].metric_name, "glucose");
    }
}
