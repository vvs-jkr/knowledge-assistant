use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
};

use crate::{
    auth::{Claims, verify_access_token},
    config::AppState,
    error::AppError,
};

/// Extractor для защищённых routes.
/// Добавь `AuthUser(claims): AuthUser` в параметры handler'а — и роут становится защищённым.
pub struct AuthUser(pub Claims);

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let claims = verify_access_token(token, &state.jwt_decoding_key)
            .map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser(claims))
    }
}
