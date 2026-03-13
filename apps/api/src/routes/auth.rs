use crate::{
    auth::{
        build_clear_refresh_cookie, build_refresh_cookie, create_access_token,
        extract_refresh_token, generate_refresh_token, hash_password, refresh_token_expires_at,
        verify_password, AuthResponse, LoginRequest, RegisterRequest, UserInfo,
    },
    config::AppState,
    error::{ApiResult, AppError},
    middleware::AuthUser,
};
use axum::{
    extract::State,
    http::{header::SET_COOKIE, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};

pub fn router(rate_limit_enabled: bool) -> Router<AppState> {
    use tower::ServiceBuilder;
    use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};

    let governor_layer = if rate_limit_enabled {
        let conf = GovernorConfigBuilder::default()
            .per_second(12)
            .burst_size(5)
            .finish()
            .expect("valid governor config");
        Some(GovernorLayer {
            config: conf.into(),
        })
    } else {
        None
    };

    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route_layer(ServiceBuilder::new().option_layer(governor_layer))
        .route("/auth/me", get(me))
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> ApiResult<impl IntoResponse> {
    validate_email(&body.email)?;
    validate_password(&body.password)?;

    let password_hash = hash_password(&body.password)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("hash error: {e}")))?;

    let user_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());

    sqlx::query!(
        "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
        user_id,
        body.email,
        password_hash,
    )
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err)
            if db_err.kind() == sqlx::error::ErrorKind::UniqueViolation =>
        {
            AppError::BadRequest("Email already registered".into())
        }
        _ => AppError::Internal(e.into()),
    })?;

    let (access_token, cookie) = create_session(&state, &user_id, &body.email).await?;

    Ok((
        StatusCode::CREATED,
        [(SET_COOKIE, cookie)],
        Json(AuthResponse {
            access_token,
            user: UserInfo {
                id: user_id,
                email: body.email,
            },
        }),
    ))
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> ApiResult<impl IntoResponse> {
    let row = sqlx::query!(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        body.email,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::Unauthorized)?;

    // sqlx + SQLite: id (PK) выводится как Option<String>
    let user_id = row.id.ok_or(AppError::Unauthorized)?;

    let ok = verify_password(&body.password, &row.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("verify error: {e}")))?;

    if !ok {
        return Err(AppError::Unauthorized);
    }

    // Инвалидируем все предыдущие сессии пользователя
    sqlx::query!("DELETE FROM sessions WHERE user_id = ?", user_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    let (access_token, cookie) = create_session(&state, &user_id, &row.email).await?;

    Ok((
        StatusCode::OK,
        [(SET_COOKIE, cookie)],
        Json(AuthResponse {
            access_token,
            user: UserInfo {
                id: user_id,
                email: row.email,
            },
        }),
    ))
}

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<impl IntoResponse> {
    let refresh_token = extract_refresh_token(&headers).ok_or(AppError::Unauthorized)?;

    let row = sqlx::query!(
        r#"SELECT s.id, s.expires_at, u.id as user_id, u.email
           FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.refresh_token = ?"#,
        refresh_token,
    )
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::Unauthorized)?;

    // sqlx + SQLite: id и user_id (JOIN alias) выводятся как Option<String>
    let session_id = row.id.ok_or(AppError::Unauthorized)?;
    let user_id = row.user_id.ok_or(AppError::Unauthorized)?;

    // Проверяем срок действия
    let expires_at = chrono::NaiveDateTime::parse_from_str(&row.expires_at, "%Y-%m-%d %H:%M:%S")
        .map_err(|_| AppError::Unauthorized)?;
    if expires_at < chrono::Utc::now().naive_utc() {
        sqlx::query!("DELETE FROM sessions WHERE id = ?", session_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;
        return Err(AppError::Unauthorized);
    }

    // Ротация: удаляем старую сессию, создаём новую
    sqlx::query!("DELETE FROM sessions WHERE id = ?", session_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    let (access_token, cookie) = create_session(&state, &user_id, &row.email).await?;

    Ok((
        StatusCode::OK,
        [(SET_COOKIE, cookie)],
        Json(AuthResponse {
            access_token,
            user: UserInfo {
                id: user_id,
                email: row.email,
            },
        }),
    ))
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<impl IntoResponse> {
    if let Some(refresh_token) = extract_refresh_token(&headers) {
        sqlx::query!(
            "DELETE FROM sessions WHERE refresh_token = ?",
            refresh_token
        )
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;
    }

    Ok((StatusCode::OK, [(SET_COOKIE, build_clear_refresh_cookie(state.cookie_secure))]))
}

// ---------------------------------------------------------------------------
// GET /auth/me  (защищённый)
// ---------------------------------------------------------------------------

async fn me(AuthUser(claims): AuthUser) -> Json<UserInfo> {
    Json(UserInfo {
        id: claims.sub,
        email: claims.email,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Создаёт сессию в БД и возвращает (access_token, Set-Cookie value).
async fn create_session(
    state: &AppState,
    user_id: &str,
    email: &str,
) -> ApiResult<(String, axum::http::HeaderValue)> {
    let session_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let refresh_token = generate_refresh_token();
    let expires_at = refresh_token_expires_at();

    sqlx::query!(
        "INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)",
        session_id,
        user_id,
        refresh_token,
        expires_at,
    )
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    let access_token = create_access_token(user_id, email, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("jwt error: {e}")))?;

    let cookie = build_refresh_cookie(&refresh_token, state.cookie_secure);

    Ok((access_token, cookie))
}

fn validate_email(email: &str) -> ApiResult<()> {
    let err = || AppError::BadRequest("Invalid email".into());
    let (local, domain) = email.split_once('@').ok_or_else(err)?;
    if local.is_empty() {
        return Err(err());
    }
    let dot_pos = domain.rfind('.').ok_or_else(err)?;
    if dot_pos == 0 || dot_pos == domain.len() - 1 {
        return Err(err());
    }
    Ok(())
}

fn validate_password(password: &str) -> ApiResult<()> {
    if password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }
    Ok(())
}
