#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub encryption_key: String, // 32 байта hex
    pub anthropic_api_key: String,
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

// ---------------------------------------------------------------------------
// AppState — shared state for all route handlers
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub jwt_encoding_key: jsonwebtoken::EncodingKey,
    pub jwt_decoding_key: jsonwebtoken::DecodingKey,
    pub frontend_url: String,
    pub encryption_key: String,
    /// false в тестах — GovernorLayer требует реального TCP-соединения
    pub rate_limit_enabled: bool,
}

impl AppState {
    pub fn new(config: &AppConfig, db: sqlx::SqlitePool) -> Self {
        Self {
            db,
            jwt_encoding_key: jsonwebtoken::EncodingKey::from_secret(config.jwt_secret.as_bytes()),
            jwt_decoding_key: jsonwebtoken::DecodingKey::from_secret(config.jwt_secret.as_bytes()),
            frontend_url: config.frontend_url.clone(),
            encryption_key: config.encryption_key.clone(),
            rate_limit_enabled: true,
        }
    }
}

