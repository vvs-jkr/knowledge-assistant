mod config;
mod db;
mod error;
mod routes;
mod middleware;

use axum::{Router, routing::get};
use tower_http::{cors::CorsLayer, compression::CompressionLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Загружаем .env
    dotenvy::dotenv().ok();

    // Инициализируем трейсинг
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "knowledge_api=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::AppConfig::from_env()?;
    let db = db::init(&config.database_url).await?;

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .merge(routes::auth::router())
        .merge(routes::notes::router())
        .layer(CorsLayer::new()
            .allow_origin(config.frontend_url.parse::<axum::http::HeaderValue>()?)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::DELETE])
            .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE])
            .allow_credentials(true)
        )
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(db);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
