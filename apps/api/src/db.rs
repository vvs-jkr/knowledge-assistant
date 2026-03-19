use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use std::str::FromStr;

/// Registers sqlite-vec as a global auto-extension so every new connection loads it.
/// Uses `Once` so it is safe to call multiple times (e.g., from tests).
///
/// # Safety
/// `sqlite3_auto_extension` is an FFI call. `sqlite3_vec_init` is the documented
/// entrypoint provided by the `sqlite-vec` crate. This is called once before any
/// connections are opened and is the standard way to register a statically linked
/// SQLite extension.
#[allow(unsafe_code)]
pub fn register_extensions() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| unsafe {
        #[allow(clippy::missing_transmute_annotations)]
        libsqlite3_sys::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    });
}

pub async fn init(database_url: &str) -> anyhow::Result<sqlx::SqlitePool> {
    register_extensions();

    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = sqlx::SqlitePool::connect_with(options).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Create sqlite-vec virtual tables. These cannot be in migration files
    // because `sqlx migrate run` (CLI) does not load the sqlite-vec extension.
    // The extension IS loaded above via register_extensions(), so this is safe.
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS note_embeddings USING vec0(
             note_id TEXT PRIMARY KEY,
             embedding float[512]
         )",
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_embeddings USING vec0(
             knowledge_id TEXT PRIMARY KEY,
             embedding float[512]
         )",
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
