ALTER TABLE knowledge_base
ADD COLUMN doc_type TEXT NOT NULL DEFAULT 'general';

ALTER TABLE knowledge_base
ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE knowledge_base
ADD COLUMN review_status TEXT NOT NULL DEFAULT 'reviewed';

ALTER TABLE knowledge_base
ADD COLUMN use_for_generation INTEGER NOT NULL DEFAULT 1;

ALTER TABLE knowledge_base
ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX idx_knowledge_base_user_doc_type
ON knowledge_base(user_id, doc_type);

CREATE INDEX idx_knowledge_base_user_generation
ON knowledge_base(user_id, use_for_generation);
