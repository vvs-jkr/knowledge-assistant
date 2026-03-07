CREATE TABLE IF NOT EXISTS health_records (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename       TEXT NOT NULL,
    lab_date       TEXT NOT NULL,
    lab_name       TEXT NOT NULL DEFAULT '',
    encrypted_pdf  BLOB NOT NULL,
    nonce          BLOB NOT NULL,
    pdf_size_bytes INTEGER NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_records_user ON health_records(user_id);

CREATE TABLE IF NOT EXISTS health_metrics (
    id              TEXT PRIMARY KEY,
    record_id       TEXT NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_name     TEXT NOT NULL,
    recorded_date   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'normal',
    encrypted_value BLOB NOT NULL,
    nonce           BLOB NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_user   ON health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_record ON health_metrics(record_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_lookup ON health_metrics(user_id, metric_name, recorded_date);
