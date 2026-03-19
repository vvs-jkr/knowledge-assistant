use crate::{
    error::{ApiResult, AppError},
    health::LabExtraction,
};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Workout generation types
// ---------------------------------------------------------------------------

/// A generated exercise within a workout draft.
#[derive(Debug, Serialize, Deserialize)]
pub struct DraftExercise {
    /// Exercise name.
    pub name: String,
    /// Number of sets.
    pub sets: Option<u32>,
    /// Number of reps per set.
    pub reps: Option<u32>,
    /// Qualitative weight guidance (e.g. "moderate", "heavy").
    pub weight_note: Option<String>,
}

/// A generated workout draft returned by the AI.
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkoutDraft {
    /// Workout name.
    pub name: String,
    /// One of the valid workout types (for_time, amrap, emom, tabata, lifting, rounds, other).
    pub workout_type: String,
    /// Estimated duration in minutes.
    pub duration_mins: Option<u32>,
    /// Optional coaching notes.
    pub notes: Option<String>,
    /// Exercise list.
    pub exercises: Vec<DraftExercise>,
}

const OPENROUTER_API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteAnalysis {
    pub summary: String,
    /// Subjective quality score from 1 (poor) to 10 (excellent).
    /// Stored as f64 to tolerate the model returning `8.0` instead of `8`.
    #[serde(deserialize_with = "deserialize_score")]
    pub quality_score: u8,
    pub improvement_suggestions: Vec<String>,
    pub duplicate_candidates: Vec<DuplicateCandidate>,
    pub tags_suggested: Vec<String>,
}

/// Accepts both integer (`8`) and float (`8.0`) from JSON and converts to `u8`.
fn deserialize_score<'de, D>(deserializer: D) -> Result<u8, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = f64::deserialize(deserializer)?;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    Ok(v.round().clamp(1.0, 10.0) as u8)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateCandidate {
    pub note_id: String,
    pub filename: String,
    pub similarity_reason: String,
}

// ---------------------------------------------------------------------------
// OpenAI-compatible request/response shapes (used by OpenRouter)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct OaiResponse {
    choices: Vec<OaiChoice>,
}

#[derive(Deserialize)]
struct OaiChoice {
    message: OaiAssistantMessage,
}

#[derive(Deserialize)]
struct OaiAssistantMessage {
    content: Option<String>,
}

// ---------------------------------------------------------------------------
// Shared HTTP helper
// ---------------------------------------------------------------------------

async fn call_openrouter(
    http_client: &reqwest::Client,
    api_key: &str,
    model: &str,
    system: &str,
    user_content: serde_json::Value,
    max_tokens: u32,
) -> ApiResult<String> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]
    });

    let response = http_client
        .post(OPENROUTER_API_URL)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenRouter request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenRouter API error {status}: {text}"
        )));
    }

    let api_resp: OaiResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenRouter parse error: {e}")))?;

    api_resp
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No content in OpenRouter response")))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Sends `note_content` to the AI for analysis.
///
/// `other_notes_context` should be a plain-text summary of other notes in the
/// knowledge base so the model can check for duplicates.
pub async fn analyze_note(
    http_client: &reqwest::Client,
    anthropic_api_key: &str,
    anthropic_model: &str,
    note_content: &str,
    note_filename: &str,
    other_notes_context: &str,
) -> ApiResult<NoteAnalysis> {
    let system = system_prompt();
    let user_content = build_user_message(note_content, note_filename, other_notes_context);

    let text = call_openrouter(
        http_client,
        anthropic_api_key,
        anthropic_model,
        &system,
        serde_json::Value::String(user_content),
        2048,
    )
    .await?;

    serde_json::from_str::<NoteAnalysis>(extract_json_object(&text))
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
- Always respond in Russian language
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

/// Sends a base64-encoded PDF to the AI and returns extracted lab metrics.
///
/// The `pdf_base64` argument must be standard base64 (no line breaks).
pub async fn extract_lab_metrics(
    http_client: &reqwest::Client,
    anthropic_api_key: &str,
    anthropic_model: &str,
    pdf_base64: &str,
    pdf_filename: &str,
) -> ApiResult<LabExtraction> {
    let system = lab_system_prompt();

    // OpenRouter file attachment format (supported by Claude and other vision models).
    let user_content = serde_json::json!([
        {
            "type": "file",
            "file": {
                "filename": pdf_filename,
                "file_data": format!("data:application/pdf;base64,{pdf_base64}")
            }
        },
        {
            "type": "text",
            "text": format!("Filename: {pdf_filename}\n\nExtract all lab metrics from this document.")
        }
    ]);

    let text = call_openrouter(
        http_client,
        anthropic_api_key,
        anthropic_model,
        &system,
        user_content,
        4096,
    )
    .await?;

    serde_json::from_str::<LabExtraction>(extract_json_object(&text)).map_err(|e| {
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
/// Models sometimes wrap the JSON in markdown code fences (` ```json...``` `)
/// or add preamble text. This function strips fences and finds the JSON boundaries.
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
// Note improvement
// ---------------------------------------------------------------------------

/// Rewrites `note_content` using the AI to improve structure, clarity, and style.
///
/// Returns the improved Markdown text. The model responds in the same language
/// as the original note.
pub async fn improve_note(
    http_client: &reqwest::Client,
    api_key: &str,
    model: &str,
    note_content: &str,
) -> ApiResult<String> {
    call_openrouter(
        http_client,
        api_key,
        model,
        &improve_system_prompt(),
        serde_json::Value::String(note_content.to_owned()),
        4096,
    )
    .await
}

fn improve_system_prompt() -> String {
    r#"You are an expert technical writer and knowledge manager. The user will provide a note in Markdown format. Improve it:
- Fix grammar, spelling, and style
- Improve structure with proper headings, lists, and formatting
- Make it clearer and more concise
- Preserve all original information — do not invent or omit facts
- Keep existing YAML frontmatter intact (do not remove or modify it)
- Return ONLY the improved Markdown content — no explanations, no code fences
Respond in the same language as the original note."#
        .into()
}

// ---------------------------------------------------------------------------
// Workout generation
// ---------------------------------------------------------------------------

/// Asks the AI to generate a structured workout based on `prompt` and optional
/// `knowledge_context` (RAG excerpts from the user's knowledge base).
///
/// # Errors
///
/// Returns `AppError::Internal` if the API call or JSON parsing fails.
pub async fn generate_workout(
    http_client: &reqwest::Client,
    anthropic_api_key: &str,
    anthropic_model: &str,
    prompt: &str,
    knowledge_context: &str,
) -> ApiResult<WorkoutDraft> {
    let system = workout_generation_system_prompt();
    let user_content = build_workout_generation_message(prompt, knowledge_context);

    let text = call_openrouter(
        http_client,
        anthropic_api_key,
        anthropic_model,
        &system,
        serde_json::Value::String(user_content),
        2048,
    )
    .await?;

    serde_json::from_str::<WorkoutDraft>(extract_json_object(&text))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse workout draft JSON: {e}")))
}

fn workout_generation_system_prompt() -> String {
    r#"You are an expert fitness coach. Generate a workout based on the user's request.

Return ONLY valid JSON — no markdown fences, no extra text — with exactly this structure:
{
  "name": "Workout Name",
  "workout_type": "lifting",
  "duration_mins": 60,
  "notes": "Optional coaching notes",
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 4,
      "reps": 10,
      "weight_note": "moderate weight"
    }
  ]
}

Rules:
- workout_type: one of "for_time", "amrap", "emom", "tabata", "lifting", "rounds", "other"
- duration_mins: integer or null
- notes: brief coaching notes or null
- exercises: at least 3, ordered logically (warm-up to cool-down)
- sets/reps: integers or null if not applicable (e.g. cardio)
- weight_note: qualitative guidance or null
- Always respond in Russian language (name, notes, weight_note fields)"#
        .into()
}

fn build_workout_generation_message(prompt: &str, knowledge_context: &str) -> String {
    if knowledge_context.is_empty() {
        prompt.to_owned()
    } else {
        format!(
            "{prompt}\n\n---\nRelevant knowledge base excerpts:\n{knowledge_context}"
        )
    }
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
