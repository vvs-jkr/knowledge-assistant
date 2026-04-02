#!/usr/bin/env python3
"""
Import workout records into archived_workouts in knowledge.db.

Supported sources:
    - digitizer SQLite database (`workouts.db`)
    - digitizer JSON (`workouts.json` or `workouts_split.json`)
    - archive export JSON produced by `export-archive-workouts.py`

Usage:
    python import-archive-workouts.py <source> <knowledge.db> [user_email] [--force-year YYYY]

Notes:
    - imports into archive tables, not active workouts
    - skips duplicates by source file or by identical title + text content
    - creates a synthetic archive section with recognized exercises for digitizer imports
    - keeps imported entries excluded from stats
    - marks imported entries as needs_review by default
    - can override the detected year while preserving month/day from OCR
"""

import argparse
import json
import os
import sqlite3
import sys
import uuid
from typing import Iterable


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


def format_exercise_line_from_mapping(exercise: dict) -> str:
    parts: list[str] = []
    name = exercise.get("name") or "Exercise"
    parts.append(str(name))

    sets = exercise.get("sets")
    reps = exercise.get("reps")
    if sets and reps:
        parts.append(f"{sets}x{reps}")
    elif reps:
        parts.append(f"{reps} reps")

    weight_kg = exercise.get("weight_kg")
    weight_note = exercise.get("weight_note")
    if weight_kg is not None:
        parts.append(f"{weight_kg} kg")
    elif weight_note:
        parts.append(str(weight_note))

    duration_secs = exercise.get("duration_secs")
    if duration_secs is not None:
        parts.append(f"{duration_secs} sec")

    notes = exercise.get("notes")
    if notes:
        parts.append(str(notes))

    return " | ".join(str(part) for part in parts if str(part).strip())


def override_archive_date(value: str | None, force_year: int | None) -> str | None:
    if not value:
        if force_year is None:
            return None
        return f"{force_year}-01-01"
    if force_year is None:
        return value
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return f"{force_year}{value[4:]}"
    return value


def load_workouts_from_db(src_path: str):
    src = sqlite3.connect(src_path)
    src.row_factory = sqlite3.Row
    workouts = src.execute("SELECT * FROM workouts ORDER BY full_date ASC, id ASC").fetchall()
    return src, workouts


def load_workouts_from_json(src_path: str):
    with open(src_path, "r", encoding="utf-8") as handle:
        records = json.load(handle)
    return None, records


def is_archive_export_record(workout: sqlite3.Row | dict) -> bool:
    return isinstance(workout, dict) and "archive_date" in workout and "title" in workout


def extract_exercises(
    src: sqlite3.Connection | None, workout: sqlite3.Row | dict
) -> Iterable[sqlite3.Row | dict]:
    if isinstance(workout, sqlite3.Row):
        return src.execute(
            "SELECT * FROM exercises WHERE workout_id = ? ORDER BY id ASC", (workout["id"],)
        ).fetchall()
    return workout.get("exercises") or []


def read_value(workout: sqlite3.Row | dict, key: str):
    if isinstance(workout, sqlite3.Row):
        return workout[key]
    return workout.get(key)


def insert_archive_export(dst: sqlite3.Connection, user_id: str, workout: dict, force_year: int | None):
    archive_date = override_archive_date(workout.get("archive_date"), force_year)
    if not archive_date:
        return False

    title = (workout.get("title") or "Workout").strip()
    source_file = workout.get("source_file")

    text_signature = (workout.get("corrected_text") or workout.get("raw_ocr_text") or "").strip()
    exists = dst.execute(
        """
        SELECT 1
        FROM archived_workouts
        WHERE user_id = ?
          AND (
                (COALESCE(?, '') <> '' AND COALESCE(source_file, '') = COALESCE(?, ''))
                OR (
                    title = ?
                    AND COALESCE(NULLIF(corrected_text, ''), raw_ocr_text, '') = COALESCE(?, '')
                )
          )
        """,
        (user_id, source_file, source_file, title, text_signature),
    ).fetchone()
    if exists:
        return False

    archive_id = new_id()
    dst.execute(
        """
        INSERT INTO archived_workouts
          (id, user_id, archive_date, title, source_system, source_type, source_file,
           raw_ocr_text, corrected_text, review_status, ready_for_retrieval, quality_score, exclude_from_stats,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """,
        (
            archive_id,
            user_id,
            archive_date,
            title,
            workout.get("source_system") or "archive_export",
            workout.get("source_type") or "digitized",
            source_file,
            workout.get("raw_ocr_text") or "",
            workout.get("corrected_text") or workout.get("raw_ocr_text") or "",
            workout.get("review_status") or "needs_review",
            1 if workout.get("ready_for_retrieval") else 0,
            workout.get("quality_score"),
            1 if workout.get("exclude_from_stats", True) else 0,
        ),
    )

    for index, image in enumerate(workout.get("images") or []):
        file_path = image.get("file_path") if isinstance(image, dict) else None
        if not file_path:
            continue
        dst.execute(
            """
            INSERT INTO archived_workout_images
              (id, archived_workout_id, file_path, sort_order, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            """,
            (new_id(), archive_id, file_path, image.get("sort_order", index) if isinstance(image, dict) else index),
        )

    for index, section in enumerate(workout.get("sections") or []):
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
                section.get("section_type_raw"),
                section.get("section_type_normalized"),
                section.get("title"),
                section.get("content_raw") or "",
                section.get("content_corrected") or section.get("content_raw") or "",
                section.get("order_index", index),
            ),
        )

    return True


def migrate(
    src_path: str, dst_path: str, user_email: str | None, force_year: int | None
) -> None:
    source_ext = os.path.splitext(src_path)[1].lower()
    if source_ext == ".db":
        src, src_workouts = load_workouts_from_db(src_path)
    elif source_ext == ".json":
        src, src_workouts = load_workouts_from_json(src_path)
    else:
        print(f"ERROR: unsupported source format '{source_ext}', expected .db or .json")
        sys.exit(1)

    dst = sqlite3.connect(dst_path)
    dst.row_factory = sqlite3.Row

    user = find_user(dst, user_email)
    if not user:
        print("ERROR: target user not found in knowledge.db")
        sys.exit(1)

    user_id = user["id"]
    print(f'Importing archive workouts for user: {user["email"]} ({user_id})')

    print(f"Source workouts found: {len(src_workouts)}")

    imported = 0
    skipped = 0

    with dst:
        for workout in src_workouts:
            if is_archive_export_record(workout):
                if insert_archive_export(dst, user_id, workout, force_year):
                    imported += 1
                    if imported % 100 == 0:
                        print(f"  {imported} imported...")
                else:
                    skipped += 1
                continue

            archive_date = override_archive_date(read_value(workout, "full_date"), force_year)
            if not archive_date:
                skipped += 1
                continue

            title = (read_value(workout, "workout_name") or "Workout").strip()
            source_file = read_value(workout, "file")
            text_signature = raw_text = read_value(workout, "raw_text") or ""

            exists = dst.execute(
                """
                SELECT 1
                FROM archived_workouts
                WHERE user_id = ?
                  AND (
                        (COALESCE(?, '') <> '' AND COALESCE(source_file, '') = COALESCE(?, ''))
                        OR (
                            title = ?
                            AND COALESCE(NULLIF(corrected_text, ''), raw_ocr_text, '') = COALESCE(?, '')
                        )
                  )
                """,
                (user_id, source_file, source_file, title, text_signature),
            ).fetchone()
            if exists:
                skipped += 1
                continue

            archive_id = new_id()
            if isinstance(workout, sqlite3.Row):
                confidence = CONFIDENCE_MAP.get(read_value(workout, "year_confidence") or "low", 0.3)
            else:
                year_resolution = read_value(workout, "year_resolution") or {}
                confidence = CONFIDENCE_MAP.get(year_resolution.get("confidence") or "low", 0.3)

            dst.execute(
                """
                INSERT INTO archived_workouts
                  (id, user_id, archive_date, title, source_system, source_type, source_file,
                   raw_ocr_text, corrected_text, review_status, ready_for_retrieval, quality_score, exclude_from_stats,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
                    0,
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

            exercises = extract_exercises(src, workout)

            if exercises:
                if isinstance(workout, sqlite3.Row):
                    content_raw = "\n".join(
                        format_exercise_line(exercise)
                        for exercise in exercises
                        if exercise["name"]
                    ).strip()
                else:
                    content_raw = "\n".join(
                        format_exercise_line_from_mapping(exercise)
                        for exercise in exercises
                        if exercise.get("name")
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

    if src is not None:
        src.close()
    dst.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import digitized workouts into archive tables.")
    parser.add_argument("src_path", help="Path to workouts.db or workouts.json/workouts_split.json")
    parser.add_argument("dst_path", help="Path to target app SQLite database")
    parser.add_argument("user_email", nargs="?", help="Optional user email")
    parser.add_argument("--force-year", dest="force_year", type=int, help="Override workout year")
    args = parser.parse_args()
    migrate(args.src_path, args.dst_path, args.user_email, args.force_year)
