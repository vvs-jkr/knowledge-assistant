CREATE TABLE IF NOT EXISTS exercises (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name          TEXT NOT NULL UNIQUE,
    muscle_groups TEXT NOT NULL DEFAULT '[]',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);

CREATE TABLE IF NOT EXISTS workouts (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,
    name            TEXT NOT NULL,
    workout_type    TEXT NOT NULL DEFAULT 'other',
    duration_mins   INTEGER,
    rounds          INTEGER,
    source_type     TEXT NOT NULL DEFAULT 'manual',
    source_file     TEXT,
    raw_text        TEXT,
    year_confidence REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workouts_user      ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_type ON workouts(user_id, workout_type);

CREATE TABLE IF NOT EXISTS workout_exercises (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workout_id    TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id   TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    reps          INTEGER,
    sets          INTEGER,
    weight_kg     REAL,
    weight_note   TEXT,
    duration_secs INTEGER,
    order_index   INTEGER NOT NULL DEFAULT 0,
    notes         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_we_workout  ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);

CREATE TABLE IF NOT EXISTS workout_logs (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_id       TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    completed_at     TEXT NOT NULL,
    duration_secs    INTEGER,
    rounds_completed INTEGER,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_user           ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_completed ON workout_logs(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_logs_workout        ON workout_logs(workout_id);
