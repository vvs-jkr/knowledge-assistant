#!/usr/bin/env python3
"""
Apply manual section fixes for selected 2023 archive cards.

This is a one-off repair script for the curated shortlist from:
    docs/archive-manual-review-2023.md

It rewrites archived_workout_sections for specific archived_workouts matched by
source_file suffix + current title. It does not delete archived_workouts.

Usage:
    python scripts/apply-manual-archive-review-2023.py apps/api/data/knowledge.db [--apply]
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
    "Kb Strong": "strength_skill",
    "Charge/Home": "conditioning",
    "Strong/Gym": "strength_skill",
    "Strong/Double Kettlebell": "strength_skill",
    "Weekly Planner": "notes",
}


FIXES: dict[str, tuple[RowFix, ...]] = {
    "22.07.2023.png": (
        RowFix("CAPOOT", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "29.07.2023.png": (
        RowFix("EMILY / SEAN", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "02.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "05.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Power", ("Power", "Strong"), new_title="Power / Strong"),
    ),
    "09.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "12.08.2023.png": (
        RowFix("Tactical", ("Tactical", "Strong"), new_title="Tactical / Strong"),
        RowFix("Power", ("Power",)),
    ),
    "16.08.2023.png": (
        RowFix(
            "Tactical/Charge/Power/Strong/Lynne",
            ("Tactical", "Charge", "Power", "Strong"),
            new_title="Tactical / Charge / Power / Strong",
        ),
    ),
    "19.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Power", ("Power",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "26.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Power", ("Power", "Strong"), new_title="Power / Strong"),
    ),
    "30.08.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("Power", ("Power",)),
    ),
    "02.09.2023.png": (
        RowFix("Tactical", ("Tactical", "Strong"), new_title="Tactical / Strong"),
        RowFix("Power", ("Power",)),
    ),
    "09.09.2023.png": (
        RowFix("Pyramid Double Helen", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "13.09.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power", "Strong"), new_title="Power / Strong"),
    ),
    "16.09.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "23.09.2023.png": (
        RowFix("Strong", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "30.09.2023.png": (
        RowFix("RILEY", ("Tactical", "Strong"), new_title="Tactical / Strong"),
    ),
    "04.10.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "07.10.2023.png": (
        RowFix("Tactical", ("Tactical",)),
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("Power", ("Power",)),
    ),
    "14.10.2023.png": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power", "Strong"), new_title="Power / Strong"),
    ),
    "18.10.2023.png": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("Tactical", ("Tactical",)),
    ),
    "25.10.2023.png": (
        RowFix("Charge / Lesley", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "28.10.2023.png": (
        RowFix("Zachary Tellier", ("Charge", "Strong"), new_title="Charge / Strong"),
    ),
    "01.11.2023.jpg": (
        RowFix("Charge", ("Charge",)),
        RowFix("Power", ("Power",)),
        RowFix("POWER", ("Strong",), new_title="Strong"),
    ),
    "04.11.2023.jpg": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("POWER", ("Strong", "Kb Strong"), new_title="Strong / Kb Strong"),
    ),
    "08.11.2023.jpg": (
        RowFix(
            "Charge",
            ("Charge", "Power", "Kb Strong"),
            new_title="Charge / Power / Kb Strong",
            anchors=("Charge", r"AMRAP IN 12 MIN OF\s+6 DOUBLE KB CLEAN", "KB Strong"),
        ),
    ),
    "11.11.2023.jpg": (
        RowFix(
            "Charge / Strong / KB Strong",
            ("Charge", "Strong", "Kb Strong"),
            new_title="Charge / Strong / Kb Strong",
        ),
    ),
    "15.11.2023.jpg": (
        RowFix(
            "Charge",
            ("Charge", "Kb Strong"),
            new_title="Charge / Kb Strong",
            anchors=("Charge", "kb Strong"),
        ),
        RowFix("Tactical", ("Tactical",)),
    ),
    "18.11.2023.jpg": (
        RowFix("Charge", ("Charge", "Strong", "Kb Strong"), new_title="Charge / Strong / Kb Strong"),
    ),
    "29.11.2023.jpg": (
        RowFix("Charge", ("Charge", "Strong", "Kb Strong"), new_title="Charge / Strong / Kb Strong"),
    ),
    "02.12.2023.jpg": (
        RowFix("Charge", ("Charge", "Strong"), new_title="Charge / Strong"),
        RowFix("POWER", ("Strong", "Kb Strong"), new_title="Strong / Kb Strong"),
    ),
    "06.12.2023.jpg": (
        RowFix("KB Strong", ("Kb Strong", "Strong", "Charge"), new_title="Kb Strong / Strong / Charge"),
    ),
    "09.12.2023.jpg": (
        RowFix("Charge", ("Charge/Home",), new_title="Charge/Home", source_title="Home"),
        RowFix(
            "Gym",
            ("Strong/Gym", "Strong/Double Kettlebell"),
            new_title="Strong/Gym / Strong/Double Kettlebell",
            anchors=("Gym", r"Strong\s*/\s*Double\s+Kettlebell"),
        ),
        RowFix("Home", ("Charge/Home",), new_title="Charge/Home"),
    ),
    "17-23.12.2023.jpg": (
        RowFix("Multiple Workouts", ("Weekly Planner",), new_title="Weekly Planner"),
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
            start = (prev_found[-1] if prev_found else 0)
            end = (next_found[0] if next_found else len(text))
        else:
            start = pos
            next_found = [p for i, p in found if i > idx]
            end = (next_found[0] if next_found else len(text))
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
    conn.execute(
        "DELETE FROM archived_workout_sections WHERE archived_workout_id = ?",
        (workout_id,),
    )
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
    parser = argparse.ArgumentParser(description="Apply manual archive section fixes for selected 2023 cards.")
    parser.add_argument("db_path", help="Path to knowledge.db")
    parser.add_argument("--apply", action="store_true", help="Persist changes")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    scanned = 0
    updated = 0

    for source_suffix, row_fixes in FIXES.items():
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
            title_after = fix.new_title or (" / ".join(fix.desired_sections))
            normalized_text = "\n\n".join(content for _, content in sections)

            scanned += 1
            print(
                f"[{'apply' if args.apply else 'dry-run'}] {source_suffix} :: {fix.current_title} -> "
                f"{', '.join(title for title, _ in sections)}"
            )

            if not args.apply:
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

    print(f"Rows scanned: {scanned}")
    if args.apply:
        print(f"Rows updated: {updated}")
    else:
        print("Dry run only. Re-run with --apply to persist changes.")


if __name__ == "__main__":
    main()
