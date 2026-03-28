CREATE TABLE IF NOT EXISTS workout_analysis_cache (
    id                TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id           TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    analysis          TEXT    NOT NULL,
    workout_count     INTEGER NOT NULL,
    last_workout_date TEXT    NOT NULL,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
