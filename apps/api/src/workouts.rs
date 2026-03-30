use serde::{Deserialize, Serialize};

/// Valid values for the `workout_type` field.
pub const VALID_WORKOUT_TYPES: &[&str] = &[
    "for_time", "amrap", "emom", "tabata", "lifting", "rounds", "other",
];

/// Valid values for the `source_type` field.
pub const VALID_SOURCE_TYPES: &[&str] = &["manual", "digitized", "generated"];

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Summary of a workout returned by the list endpoint.
#[derive(Debug, Serialize)]
pub struct WorkoutSummary {
    pub id: String,
    pub date: String,
    pub name: String,
    pub workout_type: String,
    pub duration_mins: Option<i64>,
    pub rounds: Option<i64>,
    pub exercise_count: i64,
    pub source_type: String,
    pub plan_id: Option<String>,
    pub created_at: String,
}

/// Summary of a workout plan returned by the list endpoint.
#[derive(Debug, Serialize)]
pub struct WorkoutPlanSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub workout_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Full workout plan detail including its workouts.
#[derive(Debug, Serialize)]
pub struct WorkoutPlanDetail {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub workouts: Vec<WorkoutSummary>,
}

/// A single exercise entry within a workout, including catalogue metadata.
#[derive(Debug, Serialize)]
pub struct WorkoutExercise {
    pub id: String,
    pub exercise_id: String,
    pub exercise_name: String,
    pub muscle_groups: Vec<String>,
    pub reps: Option<i64>,
    pub sets: Option<i64>,
    pub weight_kg: Option<f64>,
    pub weight_note: Option<String>,
    pub duration_secs: Option<i64>,
    pub order_index: i64,
    pub notes: Option<String>,
}

/// Full workout detail including exercises.
#[derive(Debug, Serialize)]
pub struct WorkoutDetail {
    pub id: String,
    pub date: String,
    pub name: String,
    pub workout_type: String,
    pub duration_mins: Option<i64>,
    pub rounds: Option<i64>,
    pub source_type: String,
    pub source_file: Option<String>,
    pub raw_text: Option<String>,
    pub year_confidence: Option<f64>,
    pub plan_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub exercises: Vec<WorkoutExercise>,
}

/// Exercise catalogue entry.
#[derive(Debug, Serialize)]
pub struct ExerciseInfo {
    pub id: String,
    pub name: String,
    pub muscle_groups: Vec<String>,
}

/// A completed-workout log entry.
#[derive(Debug, Serialize)]
pub struct WorkoutLog {
    pub id: String,
    pub workout_id: String,
    pub workout_name: String,
    pub completed_at: String,
    pub duration_secs: Option<i64>,
    pub rounds_completed: Option<i64>,
    pub notes: Option<String>,
    pub created_at: String,
}

/// Heatmap data point -- one entry per day that has at least one workout.
#[derive(Debug, Serialize)]
pub struct HeatmapEntry {
    pub date: String,
    pub count: i64,
}

/// Weekly training volume aggregation.
#[derive(Debug, Serialize)]
pub struct VolumeEntry {
    pub week_start: String,
    pub total_volume: f64,
    pub workout_count: i64,
}

/// Count of workouts by type.
#[derive(Debug, Serialize)]
pub struct TypeDistribution {
    pub workout_type: String,
    pub count: i64,
}

/// Progress for a single exercise over time.
#[derive(Debug, Serialize)]
pub struct ExerciseProgress {
    pub date: String,
    pub max_weight_kg: Option<f64>,
    pub total_sets: Option<i64>,
    pub total_reps: Option<i64>,
}

/// Aggregated statistics returned by `GET /workouts/stats`.
#[derive(Debug, Serialize)]
pub struct WorkoutStats {
    pub heatmap: Vec<HeatmapEntry>,
    pub weekly_volume: Vec<VolumeEntry>,
    pub type_distribution: Vec<TypeDistribution>,
    pub exercise_progress: Vec<ExerciseProgress>,
    pub total_workouts: i64,
    pub total_logs: i64,
    pub current_streak_days: i64,
}

/// AI analysis of the user's full workout history.
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkoutAnalysis {
    /// Overall assessment of the training history.
    pub summary: String,
    /// Recurring training patterns found.
    pub patterns: Vec<String>,
    /// Muscle group balance assessment.
    pub muscle_balance: String,
    /// What's going well in the training.
    pub strengths: Vec<String>,
    /// Concrete recommendations for improvement.
    pub improvements: Vec<String>,
    /// Suggested next focus: `"cardio"`, `"mass"`, `"strength"`, or `"mixed"`.
    pub suggested_focus: String,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// Exercise entry submitted when creating or updating a workout.
#[derive(Debug, Deserialize)]
pub struct ExerciseInput {
    /// Use an existing exercise by ID.
    pub exercise_id: Option<String>,
    /// Create or upsert an exercise by name (used when `exercise_id` is absent).
    pub name: Option<String>,
    /// Muscle groups to store when creating a new exercise by name.
    pub muscle_groups: Option<Vec<String>>,
    pub reps: Option<i64>,
    pub sets: Option<i64>,
    pub weight_kg: Option<f64>,
    pub weight_note: Option<String>,
    pub duration_secs: Option<i64>,
    pub order_index: Option<i64>,
    pub notes: Option<String>,
}

/// Request body for `POST /workouts/plans`.
#[derive(Debug, Deserialize)]
pub struct CreatePlanRequest {
    pub name: String,
    pub description: Option<String>,
}

/// Request body for `PUT /workouts/plans/:id`.
#[derive(Debug, Deserialize)]
pub struct UpdatePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Request body for `POST /workouts`.
#[derive(Debug, Deserialize)]
pub struct CreateWorkoutRequest {
    /// Date in `YYYY-MM-DD` format.
    pub date: String,
    pub name: String,
    pub workout_type: Option<String>,
    pub duration_mins: Option<i64>,
    pub rounds: Option<i64>,
    pub source_type: Option<String>,
    pub source_file: Option<String>,
    pub raw_text: Option<String>,
    pub year_confidence: Option<f64>,
    pub plan_id: Option<String>,
    pub exercises: Option<Vec<ExerciseInput>>,
}

/// Request body for `PUT /workouts/:id`.
#[derive(Debug, Deserialize)]
pub struct UpdateWorkoutRequest {
    pub date: Option<String>,
    pub name: Option<String>,
    pub workout_type: Option<String>,
    pub duration_mins: Option<i64>,
    pub rounds: Option<i64>,
    pub source_type: Option<String>,
    pub source_file: Option<String>,
    pub raw_text: Option<String>,
    pub year_confidence: Option<f64>,
    /// When `Some`, replaces all exercises; when `None`, leaves them unchanged.
    pub exercises: Option<Vec<ExerciseInput>>,
}

/// Request body for `POST /workouts/logs`.
#[derive(Debug, Deserialize)]
pub struct CreateLogRequest {
    pub workout_id: String,
    /// Timestamp in `YYYY-MM-DD HH:MM:SS` or ISO-8601 format.
    pub completed_at: String,
    pub duration_secs: Option<i64>,
    pub rounds_completed: Option<i64>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

/// Query parameters for `GET /workouts`.
#[derive(Debug, Deserialize, Default)]
pub struct WorkoutsQuery {
    pub workout_type: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub exercise_id: Option<String>,
    pub plan_id: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Query parameters for `GET /workouts/stats`.
#[derive(Debug, Deserialize, Default)]
pub struct StatsQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub exercise_id: Option<String>,
}

/// Query parameters for `GET /workouts/exercises`.
#[derive(Debug, Deserialize, Default)]
pub struct ExercisesQuery {
    pub search: Option<String>,
}

/// Query parameters for `GET /workouts/logs`.
#[derive(Debug, Deserialize, Default)]
pub struct LogsQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub workout_id: Option<String>,
    pub limit: Option<i64>,
}

/// Request body for `POST /workouts/generate`.
#[derive(Debug, Deserialize)]
pub struct GenerateWorkoutRequest {
    /// Natural-language description of the desired workout.
    pub prompt: String,
}

/// Response from `POST /workouts/embed-all`.
#[derive(Debug, Serialize)]
pub struct EmbedAllResponse {
    /// Workouts that were newly embedded.
    pub embedded: usize,
    /// Workouts skipped because an embedding already existed.
    pub skipped: usize,
}

/// Response from `POST /workouts/generate`.
#[derive(Debug, Serialize)]
pub struct GeneratedWorkoutResponse {
    /// Generated record ID (saved in `generated_workouts`).
    pub id: String,
    /// Original user prompt.
    pub prompt: String,
    /// Structured workout draft from Claude.
    pub result: crate::ai::WorkoutDraft,
    /// IDs of knowledge entries used as RAG context.
    pub knowledge_ids: Vec<String>,
    /// UTC timestamp of generation.
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

use crate::error::{ApiResult, AppError};

/// Validates that `s` is a calendar date in `YYYY-MM-DD` format.
///
/// # Errors
///
/// Returns [`AppError::BadRequest`] if the string cannot be parsed as a date.
pub fn validate_date(s: &str) -> ApiResult<()> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::BadRequest(format!("Invalid date '{s}': expected YYYY-MM-DD")))
}

/// Validates that `s` is one of the accepted workout types.
///
/// # Errors
///
/// Returns [`AppError::BadRequest`] if `s` is not in [`VALID_WORKOUT_TYPES`].
pub fn validate_workout_type(s: &str) -> ApiResult<()> {
    if VALID_WORKOUT_TYPES.contains(&s) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Invalid workout_type '{s}': must be one of {VALID_WORKOUT_TYPES:?}"
        )))
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_date_accepts_valid_date() {
        assert!(validate_date("2026-03-10").is_ok());
        assert!(validate_date("2000-01-01").is_ok());
        assert!(validate_date("2026-12-31").is_ok());
    }

    #[test]
    fn validate_date_rejects_invalid_formats() {
        assert!(validate_date("not-a-date").is_err());
        assert!(validate_date("03-10-2026").is_err());
        assert!(validate_date("2026-13-01").is_err());
        assert!(validate_date("2026/03/10").is_err());
        assert!(validate_date("").is_err());
    }

    #[test]
    fn validate_workout_type_accepts_all_valid_types() {
        for t in VALID_WORKOUT_TYPES {
            assert!(validate_workout_type(t).is_ok(), "expected Ok for '{t}'");
        }
    }

    #[test]
    fn validate_workout_type_rejects_unknown_type() {
        assert!(validate_workout_type("yoga").is_err());
        assert!(validate_workout_type("").is_err());
        assert!(validate_workout_type("FOR_TIME").is_err());
    }
}
