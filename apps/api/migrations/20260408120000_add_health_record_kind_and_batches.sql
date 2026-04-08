ALTER TABLE health_records
ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'lab_report';

ALTER TABLE health_records
ADD COLUMN upload_batch_id TEXT;

UPDATE health_records
SET source_kind = CASE
    WHEN lower(filename) LIKE '%.csv' THEN 'inbody'
    ELSE 'lab_report'
END
WHERE source_kind = 'lab_report';

CREATE INDEX IF NOT EXISTS idx_health_records_user_kind
    ON health_records(user_id, source_kind, lab_date);

CREATE INDEX IF NOT EXISTS idx_health_records_batch
    ON health_records(user_id, upload_batch_id);
