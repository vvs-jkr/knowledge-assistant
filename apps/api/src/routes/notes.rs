use axum::Router;
use sqlx::SqlitePool;

pub fn router() -> Router<SqlitePool> {
    Router::new()
    // эндпоинты добавим в Phase 2
}
