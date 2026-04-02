CREATE TABLE IF NOT EXISTS archived_workouts (
    id                 TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    archive_date       TEXT    NOT NULL,
    title              TEXT    NOT NULL,
    source_system      TEXT    NOT NULL DEFAULT 'manual_import',
    source_type        TEXT    NOT NULL DEFAULT 'digitized',
    source_file        TEXT,
    raw_ocr_text       TEXT    NOT NULL DEFAULT '',
    corrected_text     TEXT    NOT NULL DEFAULT '',
    review_status      TEXT    NOT NULL DEFAULT 'raw',
    quality_score      REAL,
    exclude_from_stats INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archived_workouts_user_date
    ON archived_workouts(user_id, archive_date);

CREATE INDEX IF NOT EXISTS idx_archived_workouts_user_review
    ON archived_workouts(user_id, review_status);

CREATE TABLE IF NOT EXISTS archived_workout_sections (
    id                      TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    archived_workout_id     TEXT    NOT NULL REFERENCES archived_workouts(id) ON DELETE CASCADE,
    section_type_raw        TEXT,
    section_type_normalized TEXT,
    title                   TEXT,
    content_raw             TEXT    NOT NULL DEFAULT '',
    content_corrected       TEXT    NOT NULL DEFAULT '',
    order_index             INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archived_sections_workout
    ON archived_workout_sections(archived_workout_id, order_index);

CREATE TABLE IF NOT EXISTS archived_workout_images (
    id                  TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    archived_workout_id TEXT    NOT NULL REFERENCES archived_workouts(id) ON DELETE CASCADE,
    file_path           TEXT    NOT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archived_images_workout
    ON archived_workout_images(archived_workout_id, sort_order);
