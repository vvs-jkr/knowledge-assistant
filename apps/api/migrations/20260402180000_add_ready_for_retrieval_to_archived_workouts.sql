ALTER TABLE archived_workouts
ADD COLUMN ready_for_retrieval INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_archived_workouts_user_retrieval
ON archived_workouts(user_id, ready_for_retrieval);
