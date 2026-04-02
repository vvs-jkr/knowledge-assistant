CREATE TABLE IF NOT EXISTS workout_sections (
    id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workout_id   TEXT    NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    section_key  TEXT    NOT NULL,
    section_role TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    notes        TEXT    NOT NULL DEFAULT '',
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workout_sections_workout
    ON workout_sections(workout_id, order_index);

CREATE TABLE IF NOT EXISTS workout_section_items (
    id                TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    section_id        TEXT    NOT NULL REFERENCES workout_sections(id) ON DELETE CASCADE,
    exercise_id       TEXT REFERENCES exercises(id) ON DELETE SET NULL,
    display_name      TEXT    NOT NULL,
    sets              INTEGER,
    reps              INTEGER,
    weight_kg         REAL,
    weight_note       TEXT,
    duration_secs     INTEGER,
    prescription_text TEXT    NOT NULL DEFAULT '',
    notes             TEXT    NOT NULL DEFAULT '',
    order_index       INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workout_section_items_section
    ON workout_section_items(section_id, order_index);
