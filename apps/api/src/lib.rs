pub mod ai;
pub mod auth;
pub mod chat;
pub mod config;
pub mod crypto;
pub mod db;
pub mod embeddings;
pub mod error;
pub mod health;
pub mod knowledge;
pub mod middleware;
pub mod notes;
pub mod routes;
pub mod training_goals;
pub mod workouts;

use axum::{routing::get, Router};
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};

pub fn build_app(state: config::AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .merge(routes::auth::router(state.rate_limit_enabled))
        .merge(routes::notes::router())
        .merge(routes::health::router())
        .merge(routes::workouts::router())
        .merge(routes::chat::router())
        .merge(routes::training_goals::router())
        .merge(routes::knowledge::router())
        .layer(
            CorsLayer::new()
                .allow_origin(
                    state
                        .frontend_url
                        .parse::<axum::http::HeaderValue>()
                        .expect("valid frontend URL"),
                )
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                ])
                .allow_headers([
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::CONTENT_TYPE,
                ])
                .allow_credentials(true),
        )
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub async fn build_test_state() -> config::AppState {
    db::register_extensions();
    let pool = sqlx::SqlitePool::connect("sqlite::memory:")
        .await
        .expect("in-memory sqlite");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations");
    let mut state = config::AppState::new(
        &config::AppConfig {
            database_url: "sqlite::memory:".into(),
            jwt_secret: "test_secret_32_bytes_long_enough!".into(),
            encryption_key: "0".repeat(64),
            anthropic_api_key: String::new(),
            anthropic_model: "claude-sonnet-4-6".into(),
            embedding_api_key: String::new(),
            frontend_url: "http://localhost:5173".into(),
            port: 8080,
            cookie_secure: false,
        },
        pool,
    );
    state.rate_limit_enabled = false;
    state
}
