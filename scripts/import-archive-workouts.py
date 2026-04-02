#!/usr/bin/env python3
"""
Import digitized workouts.db into archived_workouts in knowledge.db.

Usage:
    python import-archive-workouts.py <workouts.db> <knowledge.db> [user_email]

Notes:
    - imports into archive tables, not active workouts
    - skips duplicates by (user_id, archive_date, title, source_file)
    - creates a synthetic archive section with recognized exercises
    - keeps imported entries excluded from stats
    - marks imported entries as needs_review by default
"""

import sqlite3
import sys
import uuid


CONFIDENCE_MAP = {"high": 1.0, "medium": 0.7, "low": 0.3}


def new_id() -> str:
    return uuid.uuid4().hex


def find_user(dst: sqlite3.Connection, user_email: str | None):
    if user_email:
        return dst.execute(
            "SELECT id, email FROM users WHERE email = ? LIMIT 1", (user_email,)
        ).fetchone()
    return dst.execute("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1").fetchone()


def format_exercise_line(exercise: sqlite3.Row) -> str:
    parts: list[str] = []
    name = exercise["name"] or "Exercise"
    parts.append(name)

    sets = exercise["sets"]
    reps = exercise["reps"]
    if sets and reps:
        parts.append(f"{sets}x{reps}")
    elif reps:
        parts.append(f"{reps} reps")

    if exercise["weight_kg"] is not None:
        parts.append(f"{exercise['weight_kg']} kg")
    elif exercise["weight_note"]:
        parts.append(str(exercise["weight_note"]))

    if exercise["duration_secs"] is not None:
        parts.append(f"{exercise['duration_secs']} sec")

    if exercise["notes"]:
        parts.append(str(exercise["notes"]))

    return " | ".join(str(part) for part in parts if str(part).strip())


def migrate(src_path: str, dst_path: str, user_email: str | None) -> None:
    src = sqlite3.connect(src_path)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(dst_path)
    dst.row_factory = sqlite3.Row

    user = find_user(dst, user_email)
    if not user:
        print("ERROR: target user not found in knowledge.db")
        sys.exit(1)

    user_id = user["id"]
    print(f'Importing archive workouts for user: {user["email"]} ({user_id})')

    src_workouts = src.execute("SELECT * FROM workouts ORDER BY full_date ASC, id ASC").fetchall()
    print(f"Source workouts found: {len(src_workouts)}")

    imported = 0
    skipped = 0

    with dst:
        for workout in src_workouts:
            archive_date = workout["full_date"]
            if not archive_date:
                skipped += 1
                continue

            title = (workout["workout_name"] or "Workout").strip()
            source_file = workout["file"]

            exists = dst.execute(
                """
                SELECT 1
                FROM archived_workouts
                WHERE user_id = ?
                  AND archive_date = ?
                  AND title = ?
                  AND COALESCE(source_file, '') = COALESCE(?, '')
                """,
                (user_id, archive_date, title, source_file),
            ).fetchone()
            if exists:
                skipped += 1
                continue

            archive_id = new_id()
            confidence = CONFIDENCE_MAP.get(workout["year_confidence"] or "low", 0.3)
            raw_text = workout["raw_text"] or ""

            dst.execute(
                """
                INSERT INTO archived_workouts
                  (id, user_id, archive_date, title, source_system, source_type, source_file,
                   raw_ocr_text, corrected_text, review_status, quality_score, exclude_from_stats,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                (
                    archive_id,
                    user_id,
                    archive_date,
                    title,
                    "digitizer",
                    "digitized",
                    source_file,
                    raw_text,
                    raw_text,
                    "needs_review",
                    confidence,
                    1,
                ),
            )

            if source_file:
                dst.execute(
                    """
                    INSERT INTO archived_workout_images
                      (id, archived_workout_id, file_path, sort_order, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                    """,
                    (new_id(), archive_id, source_file, 0),
                )

            exercises = src.execute(
                "SELECT * FROM exercises WHERE workout_id = ? ORDER BY id ASC", (workout["id"],)
            ).fetchall()

            if exercises:
                content_raw = "\n".join(
                    format_exercise_line(exercise)
                    for exercise in exercises
                    if exercise["name"]
                ).strip()
                if content_raw:
                    dst.execute(
                        """
                        INSERT INTO archived_workout_sections
                          (id, archived_workout_id, section_type_raw, section_type_normalized, title,
                           content_raw, content_corrected, order_index, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                        """,
                        (
                            new_id(),
                            archive_id,
                            "recognized_exercises",
                            "conditioning",
                            "Recognized Exercises",
                            content_raw,
                            content_raw,
                            0,
                        ),
                    )

            imported += 1
            if imported % 100 == 0:
                print(f"  {imported} imported...")

    print(f"\nDone: {imported} imported, {skipped} skipped")

    src.close()
    dst.close()


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)

    src_path = sys.argv[1]
    dst_path = sys.argv[2]
    user_email = sys.argv[3] if len(sys.argv) == 4 else None
    migrate(src_path, dst_path, user_email)
