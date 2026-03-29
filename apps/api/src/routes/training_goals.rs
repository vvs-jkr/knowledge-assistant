use axum::{extract::State, routing::get, Json, Router};
use sqlx::Row as _;

use crate::{
    config::AppState,
    error::{ApiResult, AppError},
    middleware::AuthUser,
    training_goals::{TrainingGoals, UpdateTrainingGoalsRequest},
};

/// Returns the training-goals sub-router.
pub fn router() -> Router<AppState> {
    Router::new().route(
        "/training-goals",
        get(get_training_goals).put(update_training_goals),
    )
}

// ---------------------------------------------------------------------------
// GET /training-goals
// ---------------------------------------------------------------------------

/// Fetch the current user's training goals.
///
/// Returns an empty goals object with `active = true` if no row exists yet.
///
/// # Errors
///
/// Returns [`AppError`] on database failure.
async fn get_training_goals(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<TrainingGoals>> {
    let row = sqlx::query(
        "SELECT goals, active, updated_at FROM training_goals WHERE user_id = ?",
    )
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    let result = match row {
        Some(r) => {
            let active_int: i64 = r.try_get("active").map_err(AppError::from)?;
            TrainingGoals {
                goals: r.try_get("goals").map_err(AppError::from)?,
                active: active_int != 0,
                updated_at: r.try_get("updated_at").map_err(AppError::from)?,
            }
        }
        None => TrainingGoals {
            goals: String::new(),
            active: true,
            updated_at: String::new(),
        },
    };

    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// PUT /training-goals
// ---------------------------------------------------------------------------

/// Create or update the current user's training goals.
///
/// Uses upsert so the row is created on first call. Omitted fields fall back
/// to existing row values.
///
/// # Errors
///
/// Returns [`AppError`] on database failure.
async fn update_training_goals(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UpdateTrainingGoalsRequest>,
) -> ApiResult<Json<TrainingGoals>> {
    let existing = sqlx::query(
        "SELECT goals, active FROM training_goals WHERE user_id = ?",
    )
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    let (current_goals, current_active): (String, bool) = match existing {
        Some(r) => {
            let active_int: i64 = r.try_get("active").map_err(AppError::from)?;
            (r.try_get("goals").map_err(AppError::from)?, active_int != 0)
        }
        None => (String::new(), true),
    };

    let new_goals = body.goals.unwrap_or(current_goals);
    let new_active = body.active.unwrap_or(current_active);

    sqlx::query(
        "INSERT INTO training_goals (user_id, goals, active, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
             goals      = excluded.goals,
             active     = excluded.active,
             updated_at = excluded.updated_at",
    )
    .bind(&claims.sub)
    .bind(&new_goals)
    .bind(i64::from(new_active))
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    let updated_at: String =
        sqlx::query_scalar("SELECT updated_at FROM training_goals WHERE user_id = ?")
            .bind(&claims.sub)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    Ok(Json(TrainingGoals {
        goals: new_goals,
        active: new_active,
        updated_at,
    }))
}
