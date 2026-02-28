use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub user: UserInfo,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
}

// ---------------------------------------------------------------------------
// JWT Claims
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
    pub iat: usize,
}

#[allow(clippy::cast_sign_loss, clippy::cast_possible_truncation)]
pub fn create_access_token(
    user_id: &str,
    email: &str,
    encoding_key: &EncodingKey,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now.timestamp() as usize,
        exp: (now + chrono::Duration::minutes(15)).timestamp() as usize,
    };
    encode(&Header::default(), &claims, encoding_key)
}

pub fn verify_access_token(
    token: &str,
    decoding_key: &DecodingKey,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(token, decoding_key, &Validation::default())?;
    Ok(token_data.claims)
}

// ---------------------------------------------------------------------------
// Password hashing (argon2)
// ---------------------------------------------------------------------------

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------

pub fn generate_refresh_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

use axum::http::HeaderValue;

const REFRESH_TOKEN_TTL_SECS: i64 = 7 * 24 * 60 * 60; // 7 дней

pub fn build_refresh_cookie(token: &str) -> HeaderValue {
    HeaderValue::from_str(&format!(
        "refresh_token={token}; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age={REFRESH_TOKEN_TTL_SECS}"
    ))
    .expect("valid cookie header")
}

pub fn build_clear_refresh_cookie() -> HeaderValue {
    HeaderValue::from_str(
        "refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0",
    )
    .expect("valid cookie header")
}

pub fn refresh_token_expires_at() -> String {
    (Utc::now() + chrono::Duration::seconds(REFRESH_TOKEN_TTL_SECS))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------

pub fn extract_refresh_token(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            part.trim()
                .strip_prefix("refresh_token=")
                .map(std::string::ToString::to_string)
        })
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_round_trip() {
        let hash = hash_password("SecretPass1").unwrap();
        assert!(verify_password("SecretPass1", &hash).unwrap());
        assert!(!verify_password("WrongPass", &hash).unwrap());
    }

    #[test]
    fn jwt_round_trip() {
        let secret = "test_secret";
        let enc = EncodingKey::from_secret(secret.as_bytes());
        let dec = DecodingKey::from_secret(secret.as_bytes());

        let token = create_access_token("user123", "test@example.com", &enc).unwrap();
        let claims = verify_access_token(&token, &dec).unwrap();

        assert_eq!(claims.sub, "user123");
        assert_eq!(claims.email, "test@example.com");
    }

    #[test]
    fn jwt_invalid_secret_fails() {
        let enc = EncodingKey::from_secret(b"secret_a");
        let dec = DecodingKey::from_secret(b"secret_b");

        let token = create_access_token("user123", "test@example.com", &enc).unwrap();
        assert!(verify_access_token(&token, &dec).is_err());
    }

    #[test]
    fn refresh_tokens_are_unique() {
        let a = generate_refresh_token();
        let b = generate_refresh_token();
        assert_ne!(a, b);
    }

    #[test]
    fn extract_refresh_token_parses_correctly() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            axum::http::header::COOKIE,
            axum::http::HeaderValue::from_static("other=val; refresh_token=abc123; foo=bar"),
        );
        assert_eq!(extract_refresh_token(&headers), Some("abc123".to_string()));
    }

    #[test]
    fn extract_refresh_token_missing_returns_none() {
        let headers = axum::http::HeaderMap::new();
        assert_eq!(extract_refresh_token(&headers), None);
    }
}
