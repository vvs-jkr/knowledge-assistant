use std::fmt::Write as _;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::Row as _;

use crate::{
    ai,
    config::AppState,
    crypto, embeddings,
    error::{ApiResult, AppError},
    middleware::AuthUser,
    workouts::{
        validate_date, validate_workout_type, CreateLogRequest, CreateWorkoutRequest, EmbedAllResponse,
        ExerciseInfo, ExerciseInput, ExerciseProgress, ExercisesQuery, GenerateWorkoutRequest,
        GeneratedWorkoutResponse, HeatmapEntry, LogsQuery, StatsQuery, TypeDistribution,
        UpdateWorkoutRequest, VolumeEntry, WorkoutAnalysis, WorkoutDetail, WorkoutExercise,
        WorkoutLog, WorkoutStats, WorkoutSummary, WorkoutsQuery, VALID_SOURCE_TYPES,
    },
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/workouts", get(list_workouts).post(create_workout))
        .route("/workouts/generate", axum::routing::post(generate_workout))
        .route(
            "/workouts/analyze",
            axum::routing::post(analyze_workouts_handler),
        )
        .route("/workouts/embed-all", axum::routing::post(embed_all_workouts))
        .route("/workouts/stats", get(get_stats))
        .route("/workouts/exercises", get(list_exercises))
        .route("/workouts/logs", get(list_logs).post(create_log))
        .route(
            "/workouts/:id",
            get(get_workout).put(update_workout).delete(delete_workout),
        )
}

// ---------------------------------------------------------------------------
// GET /workouts
// ---------------------------------------------------------------------------

async fn list_workouts(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<WorkoutsQuery>,
) -> ApiResult<Json<Vec<WorkoutSummary>>> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query(
        r"SELECT w.id, w.date, w.name, w.workout_type, w.duration_mins, w.rounds,
                 w.source_type, w.created_at,
                 COUNT(we.id) AS exercise_count
          FROM workouts w
          LEFT JOIN workout_exercises we ON we.workout_id = w.id
          WHERE w.user_id = ?
            AND (? IS NULL OR w.workout_type = ?)
            AND (? IS NULL OR w.date >= ?)
            AND (? IS NULL OR w.date <= ?)
            AND (? IS NULL OR EXISTS (
                SELECT 1 FROM workout_exercises we2
                WHERE we2.workout_id = w.id AND we2.exercise_id = ?
            ))
          GROUP BY w.id
          ORDER BY w.date DESC, w.created_at DESC
          LIMIT ? OFFSET ?",
    )
    .bind(&claims.sub)
    .bind(params.workout_type.as_deref())
    .bind(params.workout_type.as_deref())
    .bind(params.from.as_deref())
    .bind(params.from.as_deref())
    .bind(params.to.as_deref())
    .bind(params.to.as_deref())
    .bind(params.exercise_id.as_deref())
    .bind(params.exercise_id.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let summaries = rows
        .into_iter()
        .map(|r| -> ApiResult<WorkoutSummary> {
            Ok(WorkoutSummary {
                id: r.try_get("id").map_err(AppError::from)?,
                date: r.try_get("date").map_err(AppError::from)?,
                name: r.try_get("name").map_err(AppError::from)?,
                workout_type: r.try_get("workout_type").map_err(AppError::from)?,
                duration_mins: r.try_get("duration_mins").map_err(AppError::from)?,
                rounds: r.try_get("rounds").map_err(AppError::from)?,
                exercise_count: r.try_get("exercise_count").map_err(AppError::from)?,
                source_type: r.try_get("source_type").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(summaries))
}

// ---------------------------------------------------------------------------
// POST /workouts
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn create_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateWorkoutRequest>,
) -> ApiResult<(StatusCode, Json<WorkoutDetail>)> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }

    validate_date(&body.date)?;

    let workout_type = body.workout_type.as_deref().unwrap_or("other");
    validate_workout_type(workout_type)?;

    let source_type = body.source_type.as_deref().unwrap_or("manual");
    if !VALID_SOURCE_TYPES.contains(&source_type) {
        return Err(AppError::BadRequest(format!(
            "Invalid source_type '{source_type}': must be one of {VALID_SOURCE_TYPES:?}"
        )));
    }

    let workout_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    sqlx::query(
        r"INSERT INTO workouts
          (id, user_id, date, name, workout_type, duration_mins, rounds,
           source_type, source_file, raw_text, year_confidence, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&workout_id)
    .bind(&claims.sub)
    .bind(&body.date)
    .bind(&body.name)
    .bind(workout_type)
    .bind(body.duration_mins)
    .bind(body.rounds)
    .bind(source_type)
    .bind(body.source_file.as_deref())
    .bind(body.raw_text.as_deref())
    .bind(body.year_confidence)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    // Insert exercises if provided.
    if let Some(exercises) = &body.exercises {
        insert_exercises(&mut tx, &workout_id, exercises).await?;
    }

    tx.commit().await.map_err(AppError::from)?;

    spawn_workout_embedding(&state, workout_id.clone());

    let detail = fetch_workout_detail(&state, &workout_id, &claims.sub).await?;
    Ok((StatusCode::CREATED, Json(detail)))
}

// ---------------------------------------------------------------------------
// GET /workouts/:id
// ---------------------------------------------------------------------------

async fn get_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<WorkoutDetail>> {
    let detail = fetch_workout_detail(&state, &id, &claims.sub).await?;
    Ok(Json(detail))
}

// ---------------------------------------------------------------------------
// PUT /workouts/:id
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn update_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWorkoutRequest>,
) -> ApiResult<Json<WorkoutDetail>> {
    // Verify ownership first.
    let exists = sqlx::query("SELECT id FROM workouts WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    if let Some(date) = &body.date {
        validate_date(date)?;
    }
    if let Some(wt) = &body.workout_type {
        validate_workout_type(wt)?;
    }
    if let Some(st) = &body.source_type {
        if !VALID_SOURCE_TYPES.contains(&st.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid source_type '{st}': must be one of {VALID_SOURCE_TYPES:?}"
            )));
        }
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    sqlx::query(
        r"UPDATE workouts SET
            date            = COALESCE(?, date),
            name            = COALESCE(?, name),
            workout_type    = COALESCE(?, workout_type),
            duration_mins   = CASE WHEN ? THEN ? ELSE duration_mins END,
            rounds          = CASE WHEN ? THEN ? ELSE rounds END,
            source_type     = COALESCE(?, source_type),
            source_file     = CASE WHEN ? THEN ? ELSE source_file END,
            raw_text        = CASE WHEN ? THEN ? ELSE raw_text END,
            year_confidence = CASE WHEN ? THEN ? ELSE year_confidence END,
            updated_at      = ?
          WHERE id = ? AND user_id = ?",
    )
    .bind(body.date.as_deref())
    .bind(body.name.as_deref())
    .bind(body.workout_type.as_deref())
    .bind(body.duration_mins.is_some())
    .bind(body.duration_mins)
    .bind(body.rounds.is_some())
    .bind(body.rounds)
    .bind(body.source_type.as_deref())
    .bind(body.source_file.is_some())
    .bind(body.source_file.as_deref())
    .bind(body.raw_text.is_some())
    .bind(body.raw_text.as_deref())
    .bind(body.year_confidence.is_some())
    .bind(body.year_confidence)
    .bind(&now)
    .bind(&id)
    .bind(&claims.sub)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    // Replace exercises if provided.
    if let Some(exercises) = &body.exercises {
        sqlx::query("DELETE FROM workout_exercises WHERE workout_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;

        insert_exercises(&mut tx, &id, exercises).await?;
    }

    tx.commit().await.map_err(AppError::from)?;

    spawn_workout_embedding(&state, id.clone());

    let detail = fetch_workout_detail(&state, &id, &claims.sub).await?;
    Ok(Json(detail))
}

// ---------------------------------------------------------------------------
// DELETE /workouts/:id
// ---------------------------------------------------------------------------

async fn delete_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query("DELETE FROM workouts WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&claims.sub)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Clean up the embedding vector.
    let db = state.db.clone();
    let workout_id = id.clone();
    tokio::spawn(async move {
        if let Err(e) = embeddings::delete_workout_embedding(&db, &workout_id).await {
            tracing::warn!("Failed to delete workout embedding {workout_id}: {e}");
        }
    });

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// POST /workouts/embed-all
// ---------------------------------------------------------------------------

/// Embeds all workouts for the current user that do not yet have a vector.
/// Safe to call multiple times -- already-embedded workouts are skipped.
async fn embed_all_workouts(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<EmbedAllResponse>> {
    if state.voyage_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Embeddings not configured (missing VOYAGE_API_KEY)".into(),
        ));
    }

    // Find workout IDs that already have embeddings.
    let embedded_ids: std::collections::HashSet<String> = sqlx::query_scalar(
        "SELECT workout_id FROM workout_embeddings",
    )
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?
    .into_iter()
    .collect();

    // Fetch all workouts with their exercises in one query.
    let rows = sqlx::query(
        r"SELECT w.id, w.name, w.workout_type, w.duration_mins, w.rounds,
                 group_concat(e.name, ', ') AS exercise_names
          FROM workouts w
          LEFT JOIN workout_exercises we ON we.workout_id = w.id
          LEFT JOIN exercises e ON e.id = we.exercise_id
          WHERE w.user_id = ?
          GROUP BY w.id
          ORDER BY w.date ASC",
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    // Split into to-embed vs already-done.
    let mut to_embed: Vec<(String, String)> = Vec::new(); // (id, text)
    let mut skipped = 0usize;

    for row in &rows {
        let id: String = row.try_get("id").map_err(AppError::from)?;
        if embedded_ids.contains(&id) {
            skipped += 1;
            continue;
        }
        let name: String = row.try_get("name").map_err(AppError::from)?;
        let workout_type: Option<String> = row.try_get("workout_type").map_err(AppError::from)?;
        let duration_mins: Option<i64> = row.try_get("duration_mins").map_err(AppError::from)?;
        let rounds: Option<i64> = row.try_get("rounds").map_err(AppError::from)?;
        let exercises: Option<String> = row.try_get("exercise_names").map_err(AppError::from)?;
        let text = build_workout_text(&name, workout_type.as_deref(), duration_mins, rounds, exercises.as_deref());
        to_embed.push((id, text));
    }

    // Process in batches of 50.
    let mut embedded = 0usize;

    for chunk in to_embed.chunks(50) {
        let texts: Vec<&str> = chunk.iter().map(|(_, t)| t.as_str()).collect();
        let embeddings_batch = embeddings::generate_embeddings_batch(
            &state.http_client,
            &state.voyage_api_key,
            &texts,
        )
        .await?;

        for ((id, _), embedding) in chunk.iter().zip(embeddings_batch.iter()) {
            embeddings::upsert_workout_embedding(&state.db, id, embedding).await?;
            embedded += 1;
        }
    }

    Ok(Json(EmbedAllResponse { embedded, skipped }))
}

// ---------------------------------------------------------------------------
// GET /workouts/exercises
// ---------------------------------------------------------------------------

async fn list_exercises(
    AuthUser(_claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<ExercisesQuery>,
) -> ApiResult<Json<Vec<ExerciseInfo>>> {
    let pattern = format!("%{}%", params.search.as_deref().unwrap_or(""));

    let rows = sqlx::query(
        "SELECT id, name, muscle_groups FROM exercises WHERE name LIKE ? ORDER BY name LIMIT 100",
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let exercises = rows
        .into_iter()
        .map(|r| {
            let mg_json: String = r.try_get("muscle_groups").map_err(AppError::from)?;
            let muscle_groups: Vec<String> = serde_json::from_str(&mg_json)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("muscle_groups parse: {e}")))?;
            Ok(ExerciseInfo {
                id: r.try_get("id").map_err(AppError::from)?,
                name: r.try_get("name").map_err(AppError::from)?,
                muscle_groups,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(exercises))
}

// ---------------------------------------------------------------------------
// GET /workouts/stats
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn get_stats(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<StatsQuery>,
) -> ApiResult<Json<WorkoutStats>> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let default_from = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(365))
        .map_or_else(
            || "2000-01-01".to_owned(),
            |d| d.format("%Y-%m-%d").to_string(),
        );
    let from = params.from.as_deref().unwrap_or(default_from.as_str());
    let to = params.to.as_deref().unwrap_or(today.as_str());

    // 1. Heatmap
    let heatmap_rows = sqlx::query(
        r"SELECT date, COUNT(*) AS count
          FROM workouts
          WHERE user_id = ? AND date >= ? AND date <= ?
          GROUP BY date
          ORDER BY date ASC",
    )
    .bind(&claims.sub)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let heatmap = heatmap_rows
        .into_iter()
        .map(|r| {
            Ok(HeatmapEntry {
                date: r.try_get("date").map_err(AppError::from)?,
                count: r.try_get("count").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    // 2. Weekly volume: sets * reps * weight_kg summed per ISO week
    let volume_rows = sqlx::query(
        r"SELECT strftime('%Y-%W', w.date) AS week_label,
                 MIN(w.date) AS week_start,
                 COALESCE(SUM(
                     COALESCE(we.sets, 1) *
                     COALESCE(we.reps, 1) *
                     COALESCE(we.weight_kg, 0.0)
                 ), 0.0) AS total_volume,
                 COUNT(DISTINCT w.id) AS workout_count
          FROM workouts w
          LEFT JOIN workout_exercises we ON we.workout_id = w.id
          WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
          GROUP BY week_label
          ORDER BY week_label ASC",
    )
    .bind(&claims.sub)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let weekly_volume = volume_rows
        .into_iter()
        .map(|r| {
            Ok(VolumeEntry {
                week_start: r.try_get("week_start").map_err(AppError::from)?,
                total_volume: r.try_get("total_volume").map_err(AppError::from)?,
                workout_count: r.try_get("workout_count").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    // 3. Type distribution
    let type_rows = sqlx::query(
        r"SELECT workout_type, COUNT(*) AS count
          FROM workouts
          WHERE user_id = ? AND date >= ? AND date <= ?
          GROUP BY workout_type
          ORDER BY count DESC",
    )
    .bind(&claims.sub)
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let type_distribution = type_rows
        .into_iter()
        .map(|r| {
            Ok(TypeDistribution {
                workout_type: r.try_get("workout_type").map_err(AppError::from)?,
                count: r.try_get("count").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    // 4. Exercise progress (only when exercise_id is specified)
    let exercise_progress = if let Some(ex_id) = &params.exercise_id {
        let prog_rows = sqlx::query(
            r"SELECT w.date,
                     MAX(we.weight_kg) AS max_weight_kg,
                     SUM(we.sets) AS total_sets,
                     SUM(we.reps) AS total_reps
              FROM workout_exercises we
              JOIN workouts w ON w.id = we.workout_id
              WHERE w.user_id = ? AND we.exercise_id = ?
                AND w.date >= ? AND w.date <= ?
              GROUP BY w.date
              ORDER BY w.date ASC",
        )
        .bind(&claims.sub)
        .bind(ex_id)
        .bind(from)
        .bind(to)
        .fetch_all(&state.db)
        .await
        .map_err(AppError::from)?;

        prog_rows
            .into_iter()
            .map(|r| {
                Ok(ExerciseProgress {
                    date: r.try_get("date").map_err(AppError::from)?,
                    max_weight_kg: r.try_get("max_weight_kg").map_err(AppError::from)?,
                    total_sets: r.try_get("total_sets").map_err(AppError::from)?,
                    total_reps: r.try_get("total_reps").map_err(AppError::from)?,
                })
            })
            .collect::<ApiResult<Vec<_>>>()?
    } else {
        Vec::new()
    };

    // 5. Total workouts
    let total_workouts: i64 = sqlx::query("SELECT COUNT(*) AS cnt FROM workouts WHERE user_id = ?")
        .bind(&claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(AppError::from)?
        .try_get("cnt")
        .map_err(AppError::from)?;

    // 6. Total logs
    let total_logs: i64 = sqlx::query("SELECT COUNT(*) AS cnt FROM workout_logs WHERE user_id = ?")
        .bind(&claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(AppError::from)?
        .try_get("cnt")
        .map_err(AppError::from)?;

    // 7. Current streak: consecutive days ending today with at least one workout
    let streak_rows = sqlx::query(
        r"SELECT DISTINCT date FROM workouts WHERE user_id = ? ORDER BY date DESC LIMIT 400",
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let dates: Vec<String> = streak_rows
        .into_iter()
        .map(|r| r.try_get::<String, _>("date").map_err(AppError::from))
        .collect::<ApiResult<Vec<_>>>()?;

    let current_streak_days = compute_streak(&dates, &today);

    Ok(Json(WorkoutStats {
        heatmap,
        weekly_volume,
        type_distribution,
        exercise_progress,
        total_workouts,
        total_logs,
        current_streak_days,
    }))
}

// ---------------------------------------------------------------------------
// POST /workouts/logs
// ---------------------------------------------------------------------------

async fn create_log(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateLogRequest>,
) -> ApiResult<(StatusCode, Json<WorkoutLog>)> {
    // Verify workout exists and belongs to this user.
    let workout_row = sqlx::query("SELECT id, name FROM workouts WHERE id = ? AND user_id = ?")
        .bind(&body.workout_id)
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

    let workout_row = workout_row.ok_or(AppError::NotFound)?;
    let workout_name: String = workout_row.try_get("name").map_err(AppError::from)?;

    let log_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        r"INSERT INTO workout_logs
          (id, user_id, workout_id, completed_at, duration_secs, rounds_completed, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&log_id)
    .bind(&claims.sub)
    .bind(&body.workout_id)
    .bind(&body.completed_at)
    .bind(body.duration_secs)
    .bind(body.rounds_completed)
    .bind(body.notes.as_deref())
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok((
        StatusCode::CREATED,
        Json(WorkoutLog {
            id: log_id,
            workout_id: body.workout_id,
            workout_name,
            completed_at: body.completed_at,
            duration_secs: body.duration_secs,
            rounds_completed: body.rounds_completed,
            notes: body.notes,
            created_at: now,
        }),
    ))
}

// ---------------------------------------------------------------------------
// GET /workouts/logs
// ---------------------------------------------------------------------------

async fn list_logs(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<LogsQuery>,
) -> ApiResult<Json<Vec<WorkoutLog>>> {
    let limit = params.limit.unwrap_or(50).min(200);

    let rows = sqlx::query(
        r"SELECT l.id, l.workout_id, w.name AS workout_name,
                 l.completed_at, l.duration_secs, l.rounds_completed, l.notes, l.created_at
          FROM workout_logs l
          JOIN workouts w ON w.id = l.workout_id
          WHERE l.user_id = ?
            AND (? IS NULL OR l.completed_at >= ?)
            AND (? IS NULL OR l.completed_at <= ?)
            AND (? IS NULL OR l.workout_id = ?)
          ORDER BY l.completed_at DESC
          LIMIT ?",
    )
    .bind(&claims.sub)
    .bind(params.from.as_deref())
    .bind(params.from.as_deref())
    .bind(params.to.as_deref())
    .bind(params.to.as_deref())
    .bind(params.workout_id.as_deref())
    .bind(params.workout_id.as_deref())
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let logs = rows
        .into_iter()
        .map(|r| {
            Ok(WorkoutLog {
                id: r.try_get("id").map_err(AppError::from)?,
                workout_id: r.try_get("workout_id").map_err(AppError::from)?,
                workout_name: r.try_get("workout_name").map_err(AppError::from)?,
                completed_at: r.try_get("completed_at").map_err(AppError::from)?,
                duration_secs: r.try_get("duration_secs").map_err(AppError::from)?,
                rounds_completed: r.try_get("rounds_completed").map_err(AppError::from)?,
                notes: r.try_get("notes").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(logs))
}

// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------

/// Builds a compact text representation of a workout for embedding.
fn build_workout_text(
    name: &str,
    workout_type: Option<&str>,
    duration_mins: Option<i64>,
    rounds: Option<i64>,
    exercises: Option<&str>,
) -> String {
    let mut parts = vec![format!("Workout: {name}")];
    if let Some(wt) = workout_type {
        parts.push(format!("Type: {wt}"));
    }
    if let Some(d) = duration_mins {
        parts.push(format!("Duration: {d} mins"));
    }
    if let Some(r) = rounds {
        parts.push(format!("Rounds: {r}"));
    }
    if let Some(ex) = exercises {
        if !ex.is_empty() {
            parts.push(format!("Exercises: {ex}"));
        }
    }
    parts.join(" | ")
}

/// Spawns a background task to (re-)embed a single workout after create/update.
fn spawn_workout_embedding(state: &AppState, workout_id: String) {
    if state.voyage_api_key.is_empty() {
        return;
    }
    let db = state.db.clone();
    let http = state.http_client.clone();
    let key = state.voyage_api_key.clone();
    tokio::spawn(async move {
        // Fetch workout row + exercises for text.
        let row = sqlx::query(
            r"SELECT w.name, w.workout_type, w.duration_mins, w.rounds,
                     group_concat(e.name, ', ') AS exercise_names
              FROM workouts w
              LEFT JOIN workout_exercises we ON we.workout_id = w.id
              LEFT JOIN exercises e ON e.id = we.exercise_id
              WHERE w.id = ?
              GROUP BY w.id",
        )
        .bind(&workout_id)
        .fetch_optional(&db)
        .await;

        let row = match row {
            Ok(Some(r)) => r,
            Ok(None) => return,
            Err(e) => {
                tracing::warn!("spawn_workout_embedding fetch failed: {e}");
                return;
            }
        };

        let name: String = match row.try_get("name") {
            Ok(v) => v,
            Err(e) => { tracing::warn!("spawn_workout_embedding name: {e}"); return; }
        };
        let workout_type: Option<String> = row.try_get("workout_type").ok().flatten();
        let duration_mins: Option<i64> = row.try_get("duration_mins").ok().flatten();
        let rounds: Option<i64> = row.try_get("rounds").ok().flatten();
        let exercises: Option<String> = row.try_get("exercise_names").ok().flatten();

        let text = build_workout_text(&name, workout_type.as_deref(), duration_mins, rounds, exercises.as_deref());

        match embeddings::generate_embedding(&http, &key, &text, "document").await {
            Ok(emb) => {
                if let Err(e) = embeddings::upsert_workout_embedding(&db, &workout_id, &emb).await {
                    tracing::warn!("spawn_workout_embedding upsert failed: {e}");
                }
            }
            Err(e) => tracing::warn!("spawn_workout_embedding voyage failed: {e}"),
        }
    });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Fetch the full detail of a workout, including joined exercises.
///
/// # Errors
///
/// Returns [`AppError::NotFound`] if no workout with `id` exists for `user_id`.
async fn fetch_workout_detail(
    state: &AppState,
    id: &str,
    user_id: &str,
) -> ApiResult<WorkoutDetail> {
    let row = sqlx::query(
        r"SELECT id, date, name, workout_type, duration_mins, rounds,
                 source_type, source_file, raw_text, year_confidence, created_at, updated_at
          FROM workouts
          WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let ex_rows = sqlx::query(
        r"SELECT we.id, we.exercise_id, e.name AS exercise_name, e.muscle_groups,
                 we.reps, we.sets, we.weight_kg, we.weight_note,
                 we.duration_secs, we.order_index, we.notes
          FROM workout_exercises we
          JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = ?
          ORDER BY we.order_index ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let exercises = ex_rows
        .into_iter()
        .map(|r| {
            let mg_json: String = r.try_get("muscle_groups").map_err(AppError::from)?;
            let muscle_groups: Vec<String> = serde_json::from_str(&mg_json)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("muscle_groups parse: {e}")))?;
            Ok(WorkoutExercise {
                id: r.try_get("id").map_err(AppError::from)?,
                exercise_id: r.try_get("exercise_id").map_err(AppError::from)?,
                exercise_name: r.try_get("exercise_name").map_err(AppError::from)?,
                muscle_groups,
                reps: r.try_get("reps").map_err(AppError::from)?,
                sets: r.try_get("sets").map_err(AppError::from)?,
                weight_kg: r.try_get("weight_kg").map_err(AppError::from)?,
                weight_note: r.try_get("weight_note").map_err(AppError::from)?,
                duration_secs: r.try_get("duration_secs").map_err(AppError::from)?,
                order_index: r.try_get("order_index").map_err(AppError::from)?,
                notes: r.try_get("notes").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(WorkoutDetail {
        id: row.try_get("id").map_err(AppError::from)?,
        date: row.try_get("date").map_err(AppError::from)?,
        name: row.try_get("name").map_err(AppError::from)?,
        workout_type: row.try_get("workout_type").map_err(AppError::from)?,
        duration_mins: row.try_get("duration_mins").map_err(AppError::from)?,
        rounds: row.try_get("rounds").map_err(AppError::from)?,
        source_type: row.try_get("source_type").map_err(AppError::from)?,
        source_file: row.try_get("source_file").map_err(AppError::from)?,
        raw_text: row.try_get("raw_text").map_err(AppError::from)?,
        year_confidence: row.try_get("year_confidence").map_err(AppError::from)?,
        created_at: row.try_get("created_at").map_err(AppError::from)?,
        updated_at: row.try_get("updated_at").map_err(AppError::from)?,
        exercises,
    })
}

/// Insert exercise rows for a workout, upserting by name when needed.
///
/// # Errors
///
/// Returns [`AppError::BadRequest`] if neither `exercise_id` nor `name` is provided,
/// or if a given `exercise_id` does not exist.
async fn insert_exercises(
    conn: &mut sqlx::SqliteConnection,
    workout_id: &str,
    exercises: &[ExerciseInput],
) -> ApiResult<()> {
    for (i, ex) in exercises.iter().enumerate() {
        let exercise_id = if let Some(eid) = &ex.exercise_id {
            // Verify the exercise exists.
            let exists = sqlx::query("SELECT id FROM exercises WHERE id = ?")
                .bind(eid)
                .fetch_optional(&mut *conn)
                .await
                .map_err(AppError::from)?;
            if exists.is_none() {
                return Err(AppError::NotFound);
            }
            eid.clone()
        } else if let Some(name) = &ex.name {
            let mg_json = serde_json::to_string(&ex.muscle_groups.as_deref().unwrap_or(&[]))
                .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize muscle_groups: {e}")))?;

            // Upsert by name.
            sqlx::query("INSERT OR IGNORE INTO exercises (name, muscle_groups) VALUES (?, ?)")
                .bind(name)
                .bind(&mg_json)
                .execute(&mut *conn)
                .await
                .map_err(AppError::from)?;

            let row = sqlx::query("SELECT id FROM exercises WHERE name = ?")
                .bind(name)
                .fetch_one(&mut *conn)
                .await
                .map_err(AppError::from)?;

            row.try_get("id").map_err(AppError::from)?
        } else {
            return Err(AppError::BadRequest(
                "Each exercise must have either exercise_id or name".into(),
            ));
        };

        let we_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        #[allow(clippy::cast_possible_wrap)]
        let order_index = ex.order_index.unwrap_or(i as i64);
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        sqlx::query(
            r"INSERT INTO workout_exercises
              (id, workout_id, exercise_id, reps, sets, weight_kg, weight_note,
               duration_secs, order_index, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&we_id)
        .bind(workout_id)
        .bind(&exercise_id)
        .bind(ex.reps)
        .bind(ex.sets)
        .bind(ex.weight_kg)
        .bind(ex.weight_note.as_deref())
        .bind(ex.duration_secs)
        .bind(order_index)
        .bind(ex.notes.as_deref())
        .bind(&now)
        .execute(&mut *conn)
        .await
        .map_err(AppError::from)?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Shared helper: format workouts as compact text for AI context
// ---------------------------------------------------------------------------

/// Fetch up to `limit` most recent workouts for `user_id` and format them as
/// compact text lines suitable for LLM context.
///
/// # Errors
///
/// Returns [`AppError`] if a database query fails.
pub async fn format_workouts_compact(
    db: &sqlx::SqlitePool,
    user_id: &str,
    limit: i64,
) -> ApiResult<String> {
    let workout_rows = sqlx::query(
        "SELECT id, date, name, workout_type, duration_mins FROM workouts \
         WHERE user_id = ? ORDER BY date DESC LIMIT ?",
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    let mut lines = Vec::new();
    for row in &workout_rows {
        let wid: String = row.try_get("id").map_err(AppError::from)?;
        let date: String = row.try_get("date").map_err(AppError::from)?;
        let name: String = row.try_get("name").map_err(AppError::from)?;
        let wtype: String = row.try_get("workout_type").map_err(AppError::from)?;
        let duration: Option<i64> = row.try_get("duration_mins").map_err(AppError::from)?;

        let ex_rows = sqlx::query(
            "SELECT e.name, we.sets, we.reps, we.weight_kg, we.weight_note, we.duration_secs \
             FROM workout_exercises we \
             JOIN exercises e ON e.id = we.exercise_id \
             WHERE we.workout_id = ? ORDER BY we.order_index ASC",
        )
        .bind(&wid)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;

        let mut ex_parts: Vec<String> = Vec::new();
        for ex in &ex_rows {
            let ex_name: String = ex.try_get("name").map_err(AppError::from)?;
            let sets: Option<i64> = ex.try_get("sets").map_err(AppError::from)?;
            let reps: Option<i64> = ex.try_get("reps").map_err(AppError::from)?;
            let weight: Option<f64> = ex.try_get("weight_kg").map_err(AppError::from)?;
            let weight_note: Option<String> = ex.try_get("weight_note").map_err(AppError::from)?;
            let dur_secs: Option<i64> = ex.try_get("duration_secs").map_err(AppError::from)?;

            let detail = match (sets, reps, weight) {
                (Some(s), Some(r), Some(w)) => format!("{ex_name} {s}x{r}@{w}kg"),
                (Some(s), Some(r), None) => match weight_note {
                    Some(wn) => format!("{ex_name} {s}x{r} {wn}"),
                    None => format!("{ex_name} {s}x{r}"),
                },
                (None, Some(r), None) => format!("{ex_name} x{r}"),
                _ => match dur_secs {
                    Some(d) => format!("{ex_name} {d}s"),
                    None => ex_name,
                },
            };
            ex_parts.push(detail);
        }

        let dur_str = duration.map_or(String::new(), |d| format!(" | {d}min"));
        let ex_str = if ex_parts.is_empty() {
            String::new()
        } else {
            format!(" | {}", ex_parts.join(", "))
        };
        lines.push(format!("{date} | {wtype}{dur_str} | {name}{ex_str}"));
    }

    Ok(lines.join("\n"))
}

// ---------------------------------------------------------------------------
// Build representative workout examples for chat context cache
// ---------------------------------------------------------------------------

/// Selects up to 3 workouts per type with full exercise details.
/// Result is stored in `workout_analysis_cache.workout_examples` and injected
/// into the chat system prompt so the AI can match style without re-querying.
async fn build_workout_examples(db: &sqlx::SqlitePool, user_id: &str) -> ApiResult<String> {
    let types = ["for_time", "amrap", "emom", "tabata", "lifting", "rounds", "other"];
    let mut sections: Vec<String> = Vec::new();

    for wtype in types {
        let rows = sqlx::query(
            "SELECT id, date, name, duration_mins, rounds FROM workouts \
             WHERE user_id = ? AND workout_type = ? \
             AND id IN (SELECT id FROM workouts WHERE user_id = ? AND workout_type = ? \
                        ORDER BY RANDOM() LIMIT 3)",
        )
        .bind(user_id)
        .bind(wtype)
        .bind(user_id)
        .bind(wtype)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;

        if rows.is_empty() {
            continue;
        }

        let mut type_lines: Vec<String> = Vec::new();
        for row in &rows {
            let wid: String = row.try_get("id").map_err(AppError::from)?;
            let date: String = row.try_get("date").map_err(AppError::from)?;
            let name: String = row.try_get("name").map_err(AppError::from)?;
            let duration: Option<i64> = row.try_get("duration_mins").map_err(AppError::from)?;
            let rounds: Option<i64> = row.try_get("rounds").map_err(AppError::from)?;

            let ex_rows = sqlx::query(
                "SELECT e.name, we.sets, we.reps, we.weight_kg, we.weight_note, we.duration_secs \
                 FROM workout_exercises we \
                 JOIN exercises e ON e.id = we.exercise_id \
                 WHERE we.workout_id = ? ORDER BY we.order_index ASC",
            )
            .bind(&wid)
            .fetch_all(db)
            .await
            .map_err(AppError::from)?;

            let mut ex_parts: Vec<String> = Vec::new();
            for ex in &ex_rows {
                let ex_name: String = ex.try_get("name").map_err(AppError::from)?;
                let sets: Option<i64> = ex.try_get("sets").map_err(AppError::from)?;
                let reps: Option<i64> = ex.try_get("reps").map_err(AppError::from)?;
                let weight: Option<f64> = ex.try_get("weight_kg").map_err(AppError::from)?;
                let weight_note: Option<String> = ex.try_get("weight_note").map_err(AppError::from)?;
                let dur_secs: Option<i64> = ex.try_get("duration_secs").map_err(AppError::from)?;

                let detail = match (sets, reps, weight) {
                    (Some(s), Some(r), Some(w)) => format!("{ex_name} {s}x{r} @{w}kg"),
                    (Some(s), Some(r), None) => match weight_note {
                        Some(wn) => format!("{ex_name} {s}x{r} {wn}"),
                        None => format!("{ex_name} {s}x{r}"),
                    },
                    (None, Some(r), None) => format!("{ex_name} x{r}"),
                    _ => match dur_secs {
                        Some(d) => format!("{ex_name} {d}s"),
                        None => ex_name,
                    },
                };
                ex_parts.push(detail);
            }

            let mut meta = String::new();
            if let Some(d) = duration {
                write!(meta, " {d}min").expect("write to String");
            }
            if let Some(r) = rounds {
                write!(meta, " {r}rounds").expect("write to String");
            }

            type_lines.push(format!(
                "  [{date}] {name}{meta}\n    {}",
                ex_parts.join(" / ")
            ));
        }

        sections.push(format!("[{wtype}]\n{}", type_lines.join("\n")));
    }

    Ok(sections.join("\n\n"))
}

// ---------------------------------------------------------------------------
// POST /workouts/generate
// ---------------------------------------------------------------------------

async fn generate_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<GenerateWorkoutRequest>,
) -> ApiResult<Json<GeneratedWorkoutResponse>> {
    let prompt = body.prompt.trim().to_owned();
    if prompt.is_empty() {
        return Err(AppError::BadRequest("Prompt cannot be empty".into()));
    }
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Workout generation is not configured (missing ANTHROPIC_API_KEY)".into(),
        ));
    }

    // Build workout history context: cached analysis + last 20 workouts.
    let cached_analysis: Option<String> =
        sqlx::query_scalar("SELECT analysis FROM workout_analysis_cache WHERE user_id = ?")
            .bind(&claims.sub)
            .fetch_optional(&state.db)
            .await
            .map_err(AppError::from)?;

    let all_workouts = format_workouts_compact(&state.db, &claims.sub, i64::MAX).await?;

    let workout_history_context = {
        let mut parts = Vec::new();
        if let Some(analysis_json) = cached_analysis {
            if let Ok(analysis) = serde_json::from_str::<WorkoutAnalysis>(&analysis_json) {
                parts.push(format!(
                    "## Training Analysis\nSummary: {}\nPatterns: {}\nMuscle balance: {}\nSuggested focus: {}",
                    analysis.summary,
                    analysis.patterns.join("; "),
                    analysis.muscle_balance,
                    analysis.suggested_focus,
                ));
            }
        }
        if !all_workouts.is_empty() {
            parts.push(format!("## Full Workout History\n{all_workouts}"));
        }
        parts.join("\n\n")
    };

    // Build RAG context from knowledge base if Voyage is configured.
    let (knowledge_context, knowledge_ids) =
        build_rag_context(&state, &claims.sub, &prompt).await?;

    let draft = ai::generate_workout(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &prompt,
        &knowledge_context,
        &workout_history_context,
    )
    .await?;

    // Persist the generated workout record.
    let gen_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let result_json = serde_json::to_string(&draft)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize draft: {e}")))?;
    let ids_json = serde_json::to_string(&knowledge_ids)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize knowledge_ids: {e}")))?;

    sqlx::query(
        "INSERT INTO generated_workouts (id, user_id, prompt, result, knowledge_ids, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&gen_id)
    .bind(&claims.sub)
    .bind(&prompt)
    .bind(&result_json)
    .bind(&ids_json)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(GeneratedWorkoutResponse {
        id: gen_id,
        prompt,
        result: draft,
        knowledge_ids,
        created_at: now,
    }))
}

/// Fetch and decrypt the top-3 relevant knowledge entries as RAG context.
///
/// Returns `(context_string, knowledge_ids_used)`.
/// Silently falls back to empty context if Voyage is not configured or no entries exist.
async fn build_rag_context(
    state: &AppState,
    user_id: &str,
    prompt: &str,
) -> ApiResult<(String, Vec<String>)> {
    if state.voyage_api_key.is_empty() {
        return Ok((String::new(), Vec::new()));
    }

    let query_embedding = match embeddings::generate_embedding(
        &state.http_client,
        &state.voyage_api_key,
        prompt,
        "query",
    )
    .await
    {
        Ok(emb) => emb,
        Err(e) => {
            tracing::warn!("Failed to embed prompt for RAG: {e}");
            return Ok((String::new(), Vec::new()));
        }
    };

    let embedding_bytes = embeddings::embedding_to_bytes(&query_embedding);
    let candidates = embeddings::search_knowledge_embeddings(&state.db, &embedding_bytes, 9)
        .await
        .unwrap_or_default();

    let mut context_lines: Vec<String> = Vec::new();
    let mut used_ids: Vec<String> = Vec::new();

    for (knowledge_id, _distance) in candidates {
        if used_ids.len() >= 3 {
            break;
        }

        let row = sqlx::query(
            "SELECT title, content_enc, nonce FROM knowledge_base WHERE id = ? AND user_id = ?",
        )
        .bind(&knowledge_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

        let Some(row) = row else { continue };

        let content_enc: Vec<u8> = row.try_get("content_enc").map_err(AppError::from)?;
        let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;
        let title: String = row.try_get("title").map_err(AppError::from)?;

        if let Ok(bytes) = crypto::decrypt(&state.encryption_key, &content_enc, &nonce) {
            let text = String::from_utf8_lossy(&bytes);
            let preview: String = text.chars().take(400).collect();
            context_lines.push(format!("## {title}\n{preview}"));
            used_ids.push(knowledge_id);
        }
    }

    Ok((context_lines.join("\n\n"), used_ids))
}

// ---------------------------------------------------------------------------
// POST /workouts/analyze
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn analyze_workouts_handler(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<WorkoutAnalysis>> {
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Workout analysis is not configured (missing ANTHROPIC_API_KEY)".into(),
        ));
    }

    let user_id = &claims.sub;

    // --- Check if cache is still valid ---
    let total_workouts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workouts WHERE user_id = ?")
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        .map_err(AppError::from)?;

    let last_workout_date: Option<String> =
        sqlx::query_scalar("SELECT MAX(date) FROM workouts WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    let last_date = last_workout_date.unwrap_or_default();

    let cache_row = sqlx::query(
        "SELECT analysis, workout_examples, workout_count, last_workout_date \
         FROM workout_analysis_cache WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    if let Some(row) = cache_row {
        let cached_count: i64 = row.try_get("workout_count").map_err(AppError::from)?;
        let cached_date: String = row.try_get("last_workout_date").map_err(AppError::from)?;
        let cached_examples: String = row.try_get("workout_examples").unwrap_or_default();
        if cached_count == total_workouts && cached_date == last_date && !cached_examples.is_empty() {
            let cached_json: String = row.try_get("analysis").map_err(AppError::from)?;
            if let Ok(analysis) = serde_json::from_str::<WorkoutAnalysis>(&cached_json) {
                return Ok(Json(analysis));
            }
            // Cache JSON is stale/malformed -- fall through to regenerate.
            tracing::warn!("workout_analysis_cache deserialization failed -- regenerating");
        }
    }

    // --- Cache miss: build full context and call AI ---
    let type_rows = sqlx::query(
        "SELECT workout_type, COUNT(*) AS cnt FROM workouts \
         WHERE user_id = ? GROUP BY workout_type ORDER BY cnt DESC",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut type_lines = Vec::new();
    for row in &type_rows {
        let wtype: String = row.try_get("workout_type").map_err(AppError::from)?;
        let cnt: i64 = row.try_get("cnt").map_err(AppError::from)?;
        type_lines.push(format!("  {wtype}: {cnt}"));
    }

    let stats_context = format!(
        "Total workouts: {total_workouts}\nWorkout type distribution:\n{}",
        type_lines.join("\n")
    );

    // Last 200 workouts in compact format -- enough for pattern analysis without hitting context limits.
    let workouts_context = format_workouts_compact(&state.db, user_id, 200).await?;

    // --- Recent health metrics (optional context) ---
    let health_rows = sqlx::query(
        "SELECT metric_name, recorded_date, status, encrypted_value, nonce \
         FROM health_metrics WHERE user_id = ? ORDER BY recorded_date DESC LIMIT 30",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut health_lines: Vec<String> = Vec::new();
    for row in &health_rows {
        let metric_name: String = row.try_get("metric_name").map_err(AppError::from)?;
        let recorded_date: String = row.try_get("recorded_date").map_err(AppError::from)?;
        let status: String = row.try_get("status").map_err(AppError::from)?;
        let enc: Vec<u8> = row.try_get("encrypted_value").map_err(AppError::from)?;
        let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;

        if let Ok(bytes) = crypto::decrypt(&state.encryption_key, &enc, &nonce) {
            if let Ok(mv) = serde_json::from_slice::<crate::health::MetricValue>(&bytes) {
                health_lines.push(format!(
                    "{recorded_date} | {metric_name}: {} {} ({})",
                    mv.value, mv.unit, status
                ));
            }
        }
    }
    let health_context = health_lines.join("\n");

    let analysis = ai::analyze_workouts(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &stats_context,
        &workouts_context,
        &health_context,
    )
    .await?;

    // --- Build representative workout examples for chat context ---
    let workout_examples = build_workout_examples(&state.db, user_id).await?;

    // --- Save result to cache ---
    let analysis_json = serde_json::to_string(&analysis)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize analysis: {e}")))?;
    let cache_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT OR REPLACE INTO workout_analysis_cache \
         (id, user_id, analysis, workout_examples, workout_count, last_workout_date, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&cache_id)
    .bind(user_id)
    .bind(&analysis_json)
    .bind(&workout_examples)
    .bind(total_workouts)
    .bind(&last_date)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(analysis))
}

/// Compute the current streak in days ending at (or including) `today`.
///
/// `dates` must be sorted in descending order (most recent first).
fn compute_streak(dates: &[String], today: &str) -> i64 {
    if dates.is_empty() {
        return 0;
    }

    // Only start a streak if the most recent workout was today or yesterday.
    let most_recent = &dates[0];
    let today_date =
        chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d").unwrap_or(chrono::NaiveDate::MAX);
    let Ok(most_recent_date) = chrono::NaiveDate::parse_from_str(most_recent, "%Y-%m-%d") else {
        return 0;
    };

    // Streak must start within the last 2 days (today or yesterday).
    if today_date
        .signed_duration_since(most_recent_date)
        .num_days()
        > 1
    {
        return 0;
    }

    let mut streak: i64 = 1;
    let mut expected = most_recent_date
        .pred_opt()
        .unwrap_or(chrono::NaiveDate::MIN);

    for date_str in &dates[1..] {
        let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") else {
            break;
        };
        if d == expected {
            streak += 1;
            expected = d.pred_opt().unwrap_or(chrono::NaiveDate::MIN);
        } else {
            break;
        }
    }

    streak
}
