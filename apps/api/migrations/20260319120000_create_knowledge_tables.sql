CREATE TABLE knowledge_base (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    content_enc BLOB NOT NULL,
    nonce BLOB NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_knowledge_base_user_id ON knowledge_base(user_id);

CREATE TABLE generated_workouts (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    result TEXT NOT NULL,
    knowledge_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX idx_generated_workouts_user_id ON generated_workouts(user_id);
