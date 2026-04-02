#!/usr/bin/env python3
"""
Apply manual section fixes for selected 2024 archive cards.

This is a one-off repair script for the curated shortlist from:
    docs/archive-manual-review-2024.md

Usage:
    python scripts/apply-manual-archive-review-2024.py apps/api/data/knowledge.db [--apply]
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import uuid
from dataclasses import dataclass


def new_id() -> str:
    return uuid.uuid4().hex


@dataclass(frozen=True)
class RowFix:
    current_title: str
    desired_sections: tuple[str, ...]
    new_title: str | None = None
    source_title: str | None = None
    anchors: tuple[str | None, ...] | None = None


SECTION_KIND = {
    "Charge": "conditioning",
    "Tactical": "conditioning",
    "Power": "strength_skill",
    "Strong": "strength_skill",
    "Rucking": "conditioning",
    "Charge/Home": "conditioning",
    "Power/Kettlebell": "strength_skill",
    "Strong/Gym": "strength_skill",
    "Strong/Double Kettlebell": "strength_skill",
    "Day Screen": "notes",
    "Day Screens": "notes",
}


FIXES: dict[str, tuple[RowFix, ...]] = {
    "24.01.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "25.01.jpg": (
        RowFix(
            "Barbara",
            ("Charge", "Tactical"),
            new_title="Charge / Tactical",
            anchors=("BARBARA", "RUCK, 45 MINS"),
        ),
    ),
    "31.01.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "03.02.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "10.02.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "27.02.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "02.03.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("Power", ("Power",)),
    ),
    "25.03.jpg": (
        RowFix(
            "JARED",
            ("Tactical", "Strong"),
            new_title="Tactical / Strong",
            anchors=("JARED", "BACK SQUAT"),
        ),
    ),
    "05.04.jpg": (
        RowFix("Charge", ("Charge",)),
    ),
    "05.04_.jpg": (
        RowFix("Arnie", ("Power",), new_title="Power"),
    ),
    "05.04__.jpg": (
        RowFix(
            "Rucking",
            ("Charge", "Rucking", "Strong"),
            new_title="Charge / Rucking / Strong",
            anchors=("10 ROUND FOR TIME", "RUCK, 30 MIN", "SEAN"),
        ),
    ),
    "08.04.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "08.04_.jpg": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "12.04.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "12.04_.jpg": (
        RowFix("Charge", ("Charge", "Rucking", "Strong"), new_title="Charge / Rucking / Strong"),
    ),
    "15.04.jpg": (
        RowFix("Power", ("Power",)),
    ),
    "15.04_.jpg": (
        RowFix("Charge", ("Charge",)),
    ),
    "15.04.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "19.04.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "19.04.png": (
        RowFix("Charge", ("Charge", "Rucking", "Strong"), new_title="Charge / Rucking / Strong"),
    ),
    "22.04.png": (
        RowFix(
            "Charge / Strong",
            ("Charge", "Strong"),
            anchors=("5 ROUNDS FOR TIME", "WENDLER FRONT SQUAT"),
        ),
    ),
    "26.04.png": (
        RowFix("Charge", ("Charge", "Rucking"), new_title="Charge / Rucking"),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "29.04.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "29.04.png": (
        RowFix("CHARGE", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("TACTICAL", ("Tactical",), new_title="Tactical"),
    ),
    "03.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "03.05.png": (
        RowFix(
            "Charge",
            ("Charge", "Strong", "Rucking"),
            new_title="Charge / Strong / Rucking",
            anchors=("Charge", "DEADLIFT", "Rucking"),
        ),
    ),
    "04.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "06.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "06.05.png": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("Tactical", ("Tactical",)),
    ),
    "13.05.jpg": (
        RowFix("Hope for Kenya", ("Power",), new_title="Power"),
    ),
    "13.05.png": (
        RowFix("Charge", ("Charge",)),
        RowFix("Tactical", ("Tactical",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "17.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "17.05.png": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "20.05.jpg": (
        RowFix("BONDY", ("Charge",), new_title="Charge"),
    ),
    "20.05.png": (
        RowFix("Charge", ("Charge",)),
        RowFix("Tactical", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "24.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "24.05.png": (
        RowFix(
            "Charge",
            ("Charge", "Strong"),
            new_title="Charge / Strong",
            anchors=("Charge", "Strong"),
        ),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "27.05.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "27.05.png": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("Tactical", ("Tactical",)),
    ),
    "31.05.png": (
        RowFix("Charge", ("Charge", "Strong", "Rucking"), new_title="Charge / Strong / Rucking"),
    ),
    "03.06.jpg": (
        RowFix(
            "CHARGE",
            ("Charge", "Power"),
            new_title="Charge / Power",
            anchors=("CHARGE", "AMRAP in 20 mins"),
        ),
    ),
    "03.06.png": (
        RowFix("Strong / Charge", ("Strong", "Charge")),
    ),
    "17.06.jpg": (
        RowFix("Charge", ("Charge", "Power"), new_title="Charge / Power"),
    ),
    "17.06.png": (
        RowFix("Half Murphy", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "24.06.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("POWER", ("Power",), new_title="Power"),
    ),
    "24.06.png": (
        RowFix("RILEY", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "07.07.png": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
    ),
    "15.07.jpg": (
        RowFix("Charges", ("Charge",), new_title="Charge"),
    ),
    "15.07_.jpg": (
        RowFix("Power", ("Power",)),
    ),
    "15.07.png": (
        RowFix("Baseline - Anywhere / Crossfit Total", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "04.08.jpg": (
        RowFix("CHARGE", ("Charge",), new_title="Charge"),
        RowFix("TACTICAL", ("Tactical",), new_title="Tactical"),
    ),
    "08.08.jpg": (
        RowFix("Hope for Kenya", ("Charge", "Power"), new_title="Charge / Power"),
    ),
    "03.11.jpg": (
        RowFix("Hope for Kenya", ("Charge", "Power"), new_title="Charge / Power"),
    ),
    "14.11.jpg": (
        RowFix("Charges", ("Charge", "Power"), new_title="Charge / Power"),
    ),
    "21.11.jpg": (
        RowFix("Death By Pull-up", ("Charge", "Power"), new_title="Charge / Power"),
    ),
    "29.11.jpg": (
        RowFix("Charges / Power", ("Charge", "Power")),
    ),
}


DAY_SCREEN_FIXES: dict[str, tuple[RowFix, ...]] = {
    "24.01.2024.jpg": (
        RowFix("Home", ("Charge/Home",), new_title="Charge/Home"),
        RowFix("Power", ("Power/Kettlebell",), new_title="Power/Kettlebell"),
        RowFix("Gym", ("Strong/Gym",), new_title="Strong/Gym"),
    ),
    "25-26.01.2024.jpg": (
        RowFix("Home", ("Day Screens",), new_title="Day Screens"),
        RowFix("Power", ("Day Screens",), new_title="Day Screens"),
    ),
    "31.01.2024-01-02.02.2024.jpg": (
        RowFix("Home", ("Day Screens",), new_title="Day Screens"),
        RowFix("Power", ("Day Screens",), new_title="Day Screens"),
        RowFix("Gym", ("Day Screens",), new_title="Day Screens"),
    ),
    "27-28.02.2024.jpg": (
        RowFix("Mary", ("Day Screens",), new_title="Day Screens"),
    ),
    "29.02.2024-01-02.03.2024.jpg": (
        RowFix("Gym", ("Day Screens",), new_title="Day Screens"),
        RowFix("Power", ("Day Screens",), new_title="Day Screens"),
    ),
}


def normalize_text(value: str | None) -> str:
    text = (value or "").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def find_positions(text: str, fix: RowFix) -> list[int | None]:
    positions: list[int | None] = []
    for index, section in enumerate(fix.desired_sections):
        anchor = None
        if fix.anchors and index < len(fix.anchors):
            anchor = fix.anchors[index]
        if not anchor:
            anchor = section
        match = re.search(anchor, text, re.IGNORECASE)
        positions.append(match.start() if match else None)
    return positions


def split_sections(text: str, fix: RowFix) -> list[tuple[str, str]]:
    text = normalize_text(text)
    if len(fix.desired_sections) == 1:
        return [(fix.desired_sections[0], text)]

    positions = find_positions(text, fix)
    found = [(idx, pos) for idx, pos in enumerate(positions) if pos is not None]
    if not found:
        return [(title, text) for title in fix.desired_sections]

    sections: list[tuple[str, str]] = []
    for idx, title in enumerate(fix.desired_sections):
        pos = positions[idx]
        if pos is None:
            prev_found = [p for i, p in found if i < idx]
            next_found = [p for i, p in found if i > idx]
            start = prev_found[-1] if prev_found else 0
            end = next_found[0] if next_found else len(text)
        else:
            start = pos
            next_found = [p for i, p in found if i > idx]
            end = next_found[0] if next_found else len(text)
        content = text[start:end].strip(" \n-")
        if not content:
            content = text
        sections.append((title, content))
    return sections


def fetch_row(conn: sqlite3.Connection, source_suffix: str, title: str):
    return conn.execute(
        """
        SELECT id, archive_date, title, source_file, corrected_text, raw_ocr_text
        FROM archived_workouts
        WHERE source_file LIKE ? AND title = ?
        LIMIT 1
        """,
        (f"%{source_suffix}", title),
    ).fetchone()


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


def apply_fix_set(conn: sqlite3.Connection, fix_set: dict[str, tuple[RowFix, ...]], apply: bool) -> tuple[int, int]:
    scanned = 0
    updated = 0
    for source_suffix, row_fixes in fix_set.items():
        for fix in row_fixes:
            row = fetch_row(conn, source_suffix, fix.current_title)
            if not row:
                print(f"[skip] row not found: {source_suffix} :: {fix.current_title}")
                continue

            source_row = row
            if fix.source_title:
                source_candidate = fetch_row(conn, source_suffix, fix.source_title)
                if source_candidate:
                    source_row = source_candidate

            source_text = normalize_text(source_row["corrected_text"] or source_row["raw_ocr_text"])
            sections = split_sections(source_text, fix)
            title_after = fix.new_title or " / ".join(fix.desired_sections)
            normalized_text = "\n\n".join(content for _, content in sections)

            scanned += 1
            print(
                f"[{'apply' if apply else 'dry-run'}] {source_suffix} :: {fix.current_title} -> "
                f"{', '.join(title for title, _ in sections)}"
            )

            if not apply:
                continue

            with conn:
                conn.execute(
                    """
                    UPDATE archived_workouts
                    SET title = ?, corrected_text = ?, review_status = 'corrected',
                        ready_for_retrieval = 0, updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (title_after, normalized_text, row["id"]),
                )
                rewrite_sections(conn, row["id"], sections)
            updated += 1
    return scanned, updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply manual archive section fixes for selected 2024 cards.")
    parser.add_argument("db_path", help="Path to knowledge.db")
    parser.add_argument("--apply", action="store_true", help="Persist changes")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    scanned_ordinary, updated_ordinary = apply_fix_set(conn, FIXES, args.apply)
    scanned_day, updated_day = apply_fix_set(conn, DAY_SCREEN_FIXES, args.apply)

    print(f"Ordinary rows scanned: {scanned_ordinary}")
    print(f"Day-screen rows scanned: {scanned_day}")
    if args.apply:
        print(f"Ordinary rows updated: {updated_ordinary}")
        print(f"Day-screen rows updated: {updated_day}")
        print(f"Total updated: {updated_ordinary + updated_day}")
    else:
        print("Dry run only. Re-run with --apply to persist changes.")


if __name__ == "__main__":
    main()
