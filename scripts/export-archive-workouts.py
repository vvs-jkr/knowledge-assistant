#!/usr/bin/env python3
"""
Export archived workouts from knowledge.db into JSON for transfer/import.

Usage:
    python export-archive-workouts.py <knowledge.db> <output.json> [--year YYYY]
"""

import argparse
import json
import sqlite3
from collections import defaultdict


def export_archive(src_path: str, output_path: str, year: str | None) -> None:
    conn = sqlite3.connect(src_path)
    conn.row_factory = sqlite3.Row

    where_sql = ""
    params: list[str] = []
    if year:
        where_sql = "WHERE substr(archive_date, 1, 4) = ?"
        params.append(year)

    workouts = conn.execute(
        f"""
        SELECT id, archive_date, title, source_system, source_type, source_file,
               raw_ocr_text, corrected_text, review_status, ready_for_retrieval,
               quality_score, exclude_from_stats
        FROM archived_workouts
        {where_sql}
        ORDER BY archive_date ASC, title ASC, id ASC
        """,
        params,
    ).fetchall()

    workout_ids = [row["id"] for row in workouts]
    sections_by_workout: dict[str, list[dict]] = defaultdict(list)
    images_by_workout: dict[str, list[dict]] = defaultdict(list)

    if workout_ids:
        placeholders = ",".join("?" for _ in workout_ids)
        for row in conn.execute(
            f"""
            SELECT archived_workout_id, section_type_raw, section_type_normalized, title,
                   content_raw, content_corrected, order_index
            FROM archived_workout_sections
            WHERE archived_workout_id IN ({placeholders})
            ORDER BY archived_workout_id ASC, order_index ASC, id ASC
            """,
            workout_ids,
        ):
            sections_by_workout[row["archived_workout_id"]].append(
                {
                    "section_type_raw": row["section_type_raw"],
                    "section_type_normalized": row["section_type_normalized"],
                    "title": row["title"],
                    "content_raw": row["content_raw"],
                    "content_corrected": row["content_corrected"],
                    "order_index": row["order_index"],
                }
            )

        for row in conn.execute(
            f"""
            SELECT archived_workout_id, file_path, sort_order
            FROM archived_workout_images
            WHERE archived_workout_id IN ({placeholders})
            ORDER BY archived_workout_id ASC, sort_order ASC, id ASC
            """,
            workout_ids,
        ):
            images_by_workout[row["archived_workout_id"]].append(
                {
                    "file_path": row["file_path"],
                    "sort_order": row["sort_order"],
                }
            )

    payload = []
    for workout in workouts:
        payload.append(
            {
                "archive_date": workout["archive_date"],
                "title": workout["title"],
                "source_system": workout["source_system"],
                "source_type": workout["source_type"],
                "source_file": workout["source_file"],
                "raw_ocr_text": workout["raw_ocr_text"],
                "corrected_text": workout["corrected_text"],
                "review_status": workout["review_status"],
                "ready_for_retrieval": bool(workout["ready_for_retrieval"]),
                "quality_score": workout["quality_score"],
                "exclude_from_stats": bool(workout["exclude_from_stats"]),
                "sections": sections_by_workout.get(workout["id"], []),
                "images": images_by_workout.get(workout["id"], []),
            }
        )

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(f"Exported {len(payload)} archived workouts to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export archived workouts from knowledge.db")
    parser.add_argument("src_path", help="Path to source knowledge.db")
    parser.add_argument("output_path", help="Path to output JSON file")
    parser.add_argument("--year", help="Optional archive year filter, e.g. 2022")
    args = parser.parse_args()
    export_archive(args.src_path, args.output_path, args.year)
