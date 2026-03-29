use std::fmt::Write as _;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::Row as _;

use crate::{
    ai::{self, ChatTurn},
    chat::{ChatMessage, ChatSession, RenameSessionRequest, SendMessageRequest},
    config::AppState,
    crypto,
    error::{ApiResult, AppError},
    middleware::AuthUser,
    workouts::WorkoutAnalysis,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/chat/sessions", get(list_sessions).post(create_session))
        .route(
            "/chat/sessions/:id",
            get(get_session)
                .patch(rename_session)
                .delete(delete_session),
        )
        .route(
            "/chat/sessions/:id/messages",
            get(list_messages).post(send_message),
        )
}

// ---------------------------------------------------------------------------
// GET /chat/sessions
// ---------------------------------------------------------------------------

async fn list_sessions(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<ChatSession>>> {
    let rows = sqlx::query(
        "SELECT id, title, created_at, updated_at FROM chat_sessions \
         WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let sessions = rows
        .iter()
        .map(|r| -> ApiResult<ChatSession> {
            Ok(ChatSession {
                id: r.try_get("id").map_err(AppError::from)?,
                title: r.try_get("title").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
                updated_at: r.try_get("updated_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(sessions))
}

// ---------------------------------------------------------------------------
// POST /chat/sessions
// ---------------------------------------------------------------------------

async fn create_session(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<(StatusCode, Json<ChatSession>)> {
    let id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) \
         VALUES (?, ?, 'Новый чат', ?, ?)",
    )
    .bind(&id)
    .bind(&claims.sub)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok((
        StatusCode::CREATED,
        Json(ChatSession {
            id,
            title: "Новый чат".into(),
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

// ---------------------------------------------------------------------------
// GET /chat/sessions/:id
// ---------------------------------------------------------------------------

async fn get_session(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ChatSession>> {
    let row = sqlx::query(
        "SELECT id, title, created_at, updated_at FROM chat_sessions \
         WHERE id = ? AND user_id = ?",
    )
    .bind(&id)
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    Ok(Json(ChatSession {
        id: row.try_get("id").map_err(AppError::from)?,
        title: row.try_get("title").map_err(AppError::from)?,
        created_at: row.try_get("created_at").map_err(AppError::from)?,
        updated_at: row.try_get("updated_at").map_err(AppError::from)?,
    }))
}

// ---------------------------------------------------------------------------
// PATCH /chat/sessions/:id
// ---------------------------------------------------------------------------

async fn rename_session(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<RenameSessionRequest>,
) -> ApiResult<Json<ChatSession>> {
    let title = body.title.trim().to_owned();
    if title.is_empty() {
        return Err(AppError::BadRequest("Title cannot be empty".into()));
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let result = sqlx::query(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .bind(&title)
    .bind(&now)
    .bind(&id)
    .bind(&claims.sub)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    let created_at: String =
        sqlx::query_scalar("SELECT created_at FROM chat_sessions WHERE id = ?")
            .bind(&id)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    Ok(Json(ChatSession {
        id,
        title,
        created_at,
        updated_at: now,
    }))
}

// ---------------------------------------------------------------------------
// DELETE /chat/sessions/:id
// ---------------------------------------------------------------------------

async fn delete_session(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&claims.sub)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /chat/sessions/:id/messages
// ---------------------------------------------------------------------------

async fn list_messages(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<ChatMessage>>> {
    // Verify ownership.
    let exists: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM chat_sessions WHERE id = ? AND user_id = ?")
            .bind(&id)
            .bind(&claims.sub)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query(
        "SELECT id, session_id, role, content, created_at FROM chat_messages \
         WHERE session_id = ? ORDER BY created_at ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let messages = rows
        .iter()
        .map(|r| -> ApiResult<ChatMessage> {
            Ok(ChatMessage {
                id: r.try_get("id").map_err(AppError::from)?,
                session_id: r.try_get("session_id").map_err(AppError::from)?,
                role: r.try_get("role").map_err(AppError::from)?,
                content: r.try_get("content").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(messages))
}

// ---------------------------------------------------------------------------
// POST /chat/sessions/:id/messages
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn send_message(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(body): Json<SendMessageRequest>,
) -> ApiResult<Json<ChatMessage>> {
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Chat is not configured (missing ANTHROPIC_API_KEY)".into(),
        ));
    }

    let content = body.content.trim().to_owned();
    if content.is_empty() {
        return Err(AppError::BadRequest("Message cannot be empty".into()));
    }

    // Verify session ownership.
    let exists: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM chat_sessions WHERE id = ? AND user_id = ?")
            .bind(&session_id)
            .bind(&claims.sub)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    if !exists {
        return Err(AppError::NotFound);
    }

    // Save user message.
    let user_msg_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO chat_messages (id, session_id, role, content, created_at) \
         VALUES (?, ?, 'user', ?, ?)",
    )
    .bind(&user_msg_id)
    .bind(&session_id)
    .bind(&content)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    // Build training context from cached analysis + KNN workout search + recent health metrics.
    let training_context = build_training_context(&state, &claims.sub, &content).await?;

    // Load full conversation history for the AI.
    let history_rows = sqlx::query(
        "SELECT role, content FROM chat_messages \
         WHERE session_id = ? ORDER BY created_at ASC",
    )
    .bind(&session_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let history: Vec<ChatTurn> = history_rows
        .iter()
        .map(|r| -> ApiResult<ChatTurn> {
            Ok(ChatTurn {
                role: r.try_get("role").map_err(AppError::from)?,
                content: r.try_get("content").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    // Call AI.
    let reply = ai::chat(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &history,
        &training_context,
    )
    .await?;

    // Save assistant reply.
    let assistant_msg_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let reply_time = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO chat_messages (id, session_id, role, content, created_at) \
         VALUES (?, ?, 'assistant', ?, ?)",
    )
    .bind(&assistant_msg_id)
    .bind(&session_id)
    .bind(&reply)
    .bind(&reply_time)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    // Update session updated_at.
    sqlx::query("UPDATE chat_sessions SET updated_at = ? WHERE id = ?")
        .bind(&reply_time)
        .bind(&session_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    // Auto-title on first message.
    let msg_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM chat_messages WHERE session_id = ?")
            .bind(&session_id)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

    if msg_count == 2 {
        let title: String = content.chars().take(50).collect();
        sqlx::query("UPDATE chat_sessions SET title = ? WHERE id = ?")
            .bind(&title)
            .bind(&session_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;
    }

    Ok(Json(ChatMessage {
        id: assistant_msg_id,
        session_id,
        role: "assistant".into(),
        content: reply,
        created_at: reply_time,
    }))
}

/// Build training context string from cached workout analysis + KNN workout search + recent health metrics.
#[allow(clippy::too_many_lines)]
async fn build_training_context(state: &AppState, user_id: &str, query: &str) -> ApiResult<String> {
    let mut parts: Vec<String> = Vec::new();

    // Training goals -- prepended so the AI treats them as highest-priority context.
    let goals_row = sqlx::query(
        "SELECT goals, active FROM training_goals WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    if let Some(row) = goals_row {
        let active_int: i64 = row.try_get("active").map_err(AppError::from)?;
        if active_int != 0 {
            let goals: String = row.try_get("goals").map_err(AppError::from)?;
            if !goals.is_empty() {
                parts.push(format!("## Цели тренировок\n{goals}"));
            }
        }
    }

    // Cached workout analysis summary.
    let cache_row = sqlx::query(
        "SELECT analysis FROM workout_analysis_cache WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    if let Some(row) = cache_row {
        let analysis_json: String = row.try_get("analysis").map_err(AppError::from)?;
        if let Ok(analysis) = serde_json::from_str::<WorkoutAnalysis>(&analysis_json) {
            parts.push(format!(
                "## Анализ тренировок\n{}\n\nПаттерны: {}\nБаланс мышц: {}\nРекомендуемый фокус: {}",
                analysis.summary,
                analysis.patterns.join("; "),
                analysis.muscle_balance,
                analysis.suggested_focus,
            ));
        }
    }

    // KNN workout search: find examples most relevant to the user's query.
    if !state.voyage_api_key.is_empty() && !query.is_empty() {
        match crate::embeddings::generate_embedding(
            &state.http_client,
            &state.voyage_api_key,
            query,
            "query",
        )
        .await
        {
            Ok(query_emb) => {
                let emb_bytes = crate::embeddings::embedding_to_bytes(&query_emb);
                match crate::embeddings::search_workout_embeddings(&state.db, &emb_bytes, 30).await
                {
                    Ok(hits) => {
                        // Filter to workouts owned by this user.
                        let mut workout_lines: Vec<String> = Vec::new();
                        for (workout_id, _distance) in hits {
                            let row = sqlx::query(
                                r"SELECT w.name, w.workout_type, w.duration_mins, w.rounds,
                                         group_concat(e.name, ', ') AS exercise_names
                                  FROM workouts w
                                  LEFT JOIN workout_exercises we ON we.workout_id = w.id
                                  LEFT JOIN exercises e ON e.id = we.exercise_id
                                  WHERE w.id = ? AND w.user_id = ?
                                  GROUP BY w.id",
                            )
                            .bind(&workout_id)
                            .bind(user_id)
                            .fetch_optional(&state.db)
                            .await
                            .map_err(AppError::from)?;

                            if let Some(r) = row {
                                let name: String =
                                    r.try_get("name").map_err(AppError::from)?;
                                let wtype: Option<String> =
                                    r.try_get("workout_type").map_err(AppError::from)?;
                                let duration: Option<f64> =
                                    r.try_get("duration_mins").map_err(AppError::from)?;
                                let rounds: Option<f64> =
                                    r.try_get("rounds").map_err(AppError::from)?;
                                let exercises: Option<String> =
                                    r.try_get("exercise_names").map_err(AppError::from)?;

                                let mut line = format!("- {name}");
                                if let Some(wt) = wtype {
                                    write!(line, " [{wt}]").expect("write to String");
                                }
                                if let Some(d) = duration {
                                    write!(line, " {d}min").expect("write to String");
                                }
                                if let Some(r) = rounds {
                                    write!(line, " {r}rds").expect("write to String");
                                }
                                if let Some(ex) = exercises {
                                    if !ex.is_empty() {
                                        write!(line, ": {ex}").expect("write to String");
                                    }
                                }
                                workout_lines.push(line);

                                if workout_lines.len() >= 10 {
                                    break;
                                }
                            }
                        }
                        if !workout_lines.is_empty() {
                            parts.push(format!(
                                "## Похожие тренировки из базы (используй как стиль/образец)\n{}",
                                workout_lines.join("\n")
                            ));
                        }
                    }
                    Err(e) => tracing::warn!("workout KNN search failed: {e}"),
                }
            }
            Err(e) => tracing::warn!("query embedding failed: {e}"),
        }
    }

    // Recent health metrics (last 30).
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

    if !health_lines.is_empty() {
        parts.push(format!(
            "## Показатели здоровья\n{}",
            health_lines.join("\n")
        ));
    }

    Ok(parts.join("\n\n"))
}
