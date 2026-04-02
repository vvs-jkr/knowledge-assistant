#!/usr/bin/env python3
"""
Patch a few remaining 2024 archive rows that need explicit manual section text.

Usage:
    python scripts/fix-manual-archive-review-2024-tails.py apps/api/data/knowledge.db [--apply]
"""

from __future__ import annotations

import argparse
import sqlite3
import uuid


def new_id() -> str:
    return uuid.uuid4().hex


SECTION_KIND = {
    "Charge": "conditioning",
    "Tactical": "conditioning",
    "Power": "strength_skill",
    "Strong": "strength_skill",
    "Rucking": "conditioning",
}


FIXES = [
    {
        "source_file": "25.01.jpg",
        "title": "Charge / Tactical",
        "new_title": "Charge / Tactical",
        "sections": [
            ("Charge", '"BARBARA"\n5 rounds, each round for time of:\n20 pull-ups\n30 push-ups\n40 sit-ups\n50 air squats\nRest 3 mins between each round. Do not include your rest when logging.'),
            ("Tactical", "For time:\nRuck, 45 mins\nThen\n2 rounds of:\n25 ruck push-ups\n50 ruck squats\nThen\nRuck, 45 mins"),
        ],
    },
    {
        "source_file": "25.03.jpg",
        "title": "Tactical / Strong",
        "new_title": "Tactical / Strong",
        "sections": [
            ("Tactical", '"JARED"\n4 rounds for time of:\nRun 800 m\n40 pull-ups\n70 push-ups'),
            ("Strong", 'Back squat 5-5-5-5-5\n"LYNNE"\n5 rounds for max reps of:\nMax rep bench press\n1x bodyweight max rep pull-up'),
        ],
    },
    {
        "source_file": "05.04__.jpg",
        "title": "Rucking / Charge / Strong",
        "new_title": "Charge / Rucking / Strong",
        "sections": [
            ("Charge", "10 rounds for time of:\n77 air squat\n7 strict pull-up\n17 push-up"),
            ("Rucking", "Ruck, 30 min\n9 ruck SDHP\n9 burpee\n15 ruck SDHP\n15 burpee\n21 ruck SDHP\n21 burpee\n15 ruck SDHP\n15 burpee\nRuck, 30 min"),
            ("Strong", '"SEAN"\n10 rounds for time of:\n11 chest-to-bar pull-up\n22 front squat, 75 lbs'),
        ],
    },
    {
        "source_file": "22.04.png",
        "title": "Charge / Strong",
        "new_title": "Charge / Strong",
        "sections": [
            ("Charge", "5 rounds for time of:\n5 burpee\n20 air squat\n5 burpee\n15 push-up\n5 burpee\n10 walking lunge\n5 burpee\n5 v-ups"),
            ("Strong", "Wendler front squat:\n1x3 at 70% 1RM\n1x3 at 80% 1RM\n1x3+ at 90% 1RM\n\nWendler bench press:\n1x5 at 65% 1RM\n1x5 at 75% 1RM\n1x5+ at 85% 1RM\n\nDeath by strict pull-up"),
        ],
    },
    {
        "source_file": "03.05.png",
        "title": "Charge / Rucking / Strong",
        "new_title": "Charge / Strong / Rucking",
        "sections": [
            ("Charge", "2-4-6-8-10-12-14-16 reps, for time of:\nBurpee\nPistols (alt legs)"),
            ("Strong", "Deadlift 1x3 at 70% 1RM\nDeadlift 1x3 at 80% 1RM\nDeadlift 1x3+ at 90% 1RM\n\nAMRAP in 20 mins of:\n5 deadlift, 80% 1RM\n10 toes-to-bar\n20 burpee"),
            ("Rucking", "AMRAP in 90 mins of:\nRuck, 30 min\nMax rep ruck walking lunge"),
        ],
    },
    {
        "source_file": "24.05.png",
        "title": "Charge / Strong",
        "new_title": "Charge / Strong",
        "sections": [
            ("Charge", "10 rounds for time of:\n5 burpee\n10 push-up\n15 air squat\n20 abmat sit-up"),
            ("Strong", "Record your best hang power clean 5 rep max lift\nWeighted pull-up 5-5-5\n\n\"DT\"\n5 rounds for time of:\n155 lbs\n12 deadlift\n9 hang power clean\n6 push jerk"),
        ],
    },
    {
        "source_file": "Rucking",
        "title": "Rucking",
        "skip": True,
    },
    {
        "source_file": "24.05.png",
        "title": "Rucking",
        "new_title": "Rucking",
        "sections": [
            ("Rucking", "AMRAP in 90 mins of:\nRuck, 30 min\nMax rep ruck walking lunge"),
        ],
    },
    {
        "source_file": "03.06.jpg",
        "title": "Charge / Power",
        "new_title": "Charge / Power",
        "sections": [
            ("Charge", "Tabata air squat\nRest 1 min\nTabata jumping jack\nRest 1 min\nTabata plank shoulder tap\nRest 1 min\nTabata burpee"),
            ("Power", "AMRAP in 20 mins of:\n20 Russian kettlebell swings\n15 American kettlebell swings\n15 burpees\n20 kettlebell goblet squats"),
        ],
    },
]


def rewrite_sections(conn: sqlite3.Connection, workout_id: str, sections: list[tuple[str, str]]) -> None:
    conn.execute("DELETE FROM archived_workout_sections WHERE archived_workout_id = ?", (workout_id,))
    for order_index, (title, content) in enumerate(sections):
        conn.execute(
            """
            INSERT INTO archived_workout_sections
              (id, archived_workout_id, section_type_raw, section_type_normalized, title,
               content_raw, content_corrected, order_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                new_id(),
                workout_id,
                title,
                SECTION_KIND.get(title, "notes"),
                title,
                content,
                content,
                order_index,
            ),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch remaining 2024 archive tail cases.")
    parser.add_argument("db_path", help="Path to knowledge.db")
    parser.add_argument("--apply", action="store_true", help="Persist changes")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    scanned = 0
    updated = 0

    for fix in FIXES:
        if fix.get("skip"):
            continue
        row = conn.execute(
            """
            SELECT id
            FROM archived_workouts
            WHERE source_file LIKE ? AND title = ?
            LIMIT 1
            """,
            (f"%{fix['source_file']}", fix["title"]),
        ).fetchone()
        if not row:
            print(f"[skip] row not found: {fix['source_file']} :: {fix['title']}")
            continue

        scanned += 1
        print(f"[{'apply' if args.apply else 'dry-run'}] {fix['source_file']} :: {fix['title']}")

        if not args.apply:
            continue

        normalized_text = "\n\n".join(content for _, content in fix["sections"])
        with conn:
            conn.execute(
                """
                UPDATE archived_workouts
                SET title = ?, corrected_text = ?, review_status = 'corrected',
                    ready_for_retrieval = 0, updated_at = datetime('now')
                WHERE id = ?
                """,
                (fix["new_title"], normalized_text, row["id"]),
            )
            rewrite_sections(conn, row["id"], fix["sections"])
        updated += 1

    print(f"Rows scanned: {scanned}")
    if args.apply:
        print(f"Rows updated: {updated}")
    else:
        print("Dry run only. Re-run with --apply to persist changes.")


if __name__ == "__main__":
    main()
