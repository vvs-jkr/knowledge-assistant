#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub encryption_key: String,
    pub anthropic_api_key: String,
    pub voyage_api_key: String,
    pub frontend_url: String,
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("DATABASE_URL")?,
            jwt_secret: require_env("JWT_SECRET")?,
            encryption_key: require_env("ENCRYPTION_KEY")?,
            anthropic_api_key: require_env("ANTHROPIC_API_KEY")?,
            voyage_api_key: require_env("VOYAGE_API_KEY")?,
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()?,
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Missing required env var: {key}"))
}

// Panics at startup if the env var is malformed — better than silently using a wrong key.
fn decode_encryption_key(hex: &str) -> [u8; 32] {
    assert!(
        hex.len() == 64,
        "ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes), got {}",
        hex.len()
    );
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16)
                .expect("ENCRYPTION_KEY must contain only valid hex characters")
        })
        .collect();
    bytes
        .try_into()
        .expect("32 bytes guaranteed by length check above")
}

// ---------------------------------------------------------------------------
// AppState — shared state for all route handlers
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub jwt_encoding_key: jsonwebtoken::EncodingKey,
    pub jwt_decoding_key: jsonwebtoken::DecodingKey,
    pub frontend_url: String,
    pub encryption_key: [u8; 32],
    pub rate_limit_enabled: bool,
    pub anthropic_api_key: String,
    pub voyage_api_key: String,
    pub http_client: reqwest::Client,
}

impl AppState {
    pub fn new(config: &AppConfig, db: sqlx::SqlitePool) -> Self {
        Self {
            db,
            jwt_encoding_key: jsonwebtoken::EncodingKey::from_secret(config.jwt_secret.as_bytes()),
            jwt_decoding_key: jsonwebtoken::DecodingKey::from_secret(config.jwt_secret.as_bytes()),
            frontend_url: config.frontend_url.clone(),
            encryption_key: decode_encryption_key(&config.encryption_key),
            rate_limit_enabled: std::env::var("RATE_LIMIT_ENABLED")
                .map(|v| v == "true")
                .unwrap_or(true),
            anthropic_api_key: config.anthropic_api_key.clone(),
            voyage_api_key: config.voyage_api_key.clone(),
            http_client: reqwest::Client::new(),
        }
    }
}
