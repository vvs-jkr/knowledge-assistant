pub async fn init(_database_url: &str) -> anyhow::Result<sqlx::SqlitePool> {
    let pool = sqlx::SqlitePool::connect(_database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
