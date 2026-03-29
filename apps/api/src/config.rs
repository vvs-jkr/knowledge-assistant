#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub encryption_key: String,
    pub anthropic_api_key: String,
    pub anthropic_model: String,
    pub embedding_api_key: String,
    pub frontend_url: String,
    pub port: u16,
    pub cookie_secure: bool,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("DATABASE_URL")?,
            jwt_secret: require_env("JWT_SECRET")?,
            encryption_key: require_env("ENCRYPTION_KEY")?,
            anthropic_api_key: require_env("ANTHROPIC_API_KEY")?,
            anthropic_model: std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "anthropic/claude-sonnet-4-5".into()),
            embedding_api_key: std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()?,
            cookie_secure: std::env::var("COOKIE_SECURE")
                .map(|v| v != "false")
                .unwrap_or(true),
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Missing required env var: {key}"))
}

// Panics at startup if the env var is malformed -- better than silently using a wrong key.
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
// AppState -- shared state for all route handlers
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
    pub anthropic_model: String,
    pub embedding_api_key: String,
    pub http_client: reqwest::Client,
    pub cookie_secure: bool,
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
            anthropic_model: config.anthropic_model.clone(),
            embedding_api_key: config.embedding_api_key.clone(),
            http_client: reqwest::Client::new(),
            cookie_secure: config.cookie_secure,
        }
    }
}
