-- Workout plans: named groups of workouts
CREATE TABLE IF NOT EXISTS workout_plans (
    id          TEXT    NOT NULL PRIMARY KEY,
    user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workout_plans_user ON workout_plans(user_id);

-- Link workouts to plans (nullable, ON DELETE SET NULL)
ALTER TABLE workouts ADD COLUMN plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_workouts_plan ON workouts(plan_id);
