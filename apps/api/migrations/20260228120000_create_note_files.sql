CREATE TABLE IF NOT EXISTS note_files (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename          TEXT NOT NULL,
    mime_type         TEXT NOT NULL DEFAULT 'text/markdown',
    size_bytes        INTEGER NOT NULL,
    encrypted_content BLOB NOT NULL,
    nonce             BLOB NOT NULL,
    frontmatter       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_note_files_user_id ON note_files(user_id);
