#!/usr/bin/env python3
"""
Split archived workout cards into named sections such as Charge / Tactical / Power.

By default runs in dry-run mode and prints a summary only.

Usage:
    python normalize-archive-sections.py <knowledge.db> [user_email] [--year YYYY] [--source-system NAME] [--apply]
"""

import argparse
import re
import sqlite3
import sys
import uuid
from dataclasses import dataclass


SECTION_MARKERS = [
    ("Charge", "conditioning"),
    ("Tactical", "conditioning"),
    ("Power", "strength_skill"),
    ("Lifting", "strength_skill"),
    ("Strong", "strength_skill"),
    ("Rucking", "conditioning"),
    ("Endurance", "conditioning"),
    ("Gym", "conditioning"),
    ("Home", "conditioning"),
    ("Street", "conditioning"),
    ("Candy", "conditioning"),
    ("Flash", "conditioning"),
]

MARKER_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(label) for label, _ in SECTION_MARKERS) + r")\b",
    re.IGNORECASE,
)

SECTION_KIND = {label.lower(): normalized for label, normalized in SECTION_MARKERS}
PAYLOAD_PATTERN = re.compile(
    r"\b(for time|amrap|emom|tabata|round|rounds|rep|reps|min|mins|run|rest|deadlift|squat|press|pull-?up|push-?up|swing|row|lunge|burpee)\b",
    re.IGNORECASE,
)


@dataclass
class ProposedSection:
    title: str
    section_type_normalized: str
    content: str
    order_index: int


def new_id() -> str:
    return uuid.uuid4().hex


def find_user(conn: sqlite3.Connection, user_email: str | None):
    if user_email:
        return conn.execute(
            "SELECT id, email FROM users WHERE email = ? LIMIT 1", (user_email,)
        ).fetchone()
    return conn.execute("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1").fetchone()


def canonical_title(raw: str) -> str:
    for label, _ in SECTION_MARKERS:
        if raw.lower() == label.lower():
            return label
    return raw.strip().title()


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\r", " ").replace("\n", " ")).strip()


def has_meaningful_payload(marker: str, content: str) -> bool:
    body = content[len(marker) :].strip(" :-?\"'/")
    if len(body) < 12:
        return False
    if PAYLOAD_PATTERN.search(body):
        return True
    if len(re.findall(r"\d+", body)) >= 2:
        return True
    return len(body) >= 80


def infer_sections(text: str) -> list[ProposedSection]:
    matches = list(MARKER_PATTERN.finditer(text))
    if len(matches) < 2:
        return []

    sections: list[ProposedSection] = []
    deduped_matches = []
    for match in matches:
        marker = canonical_title(match.group(1))
        if deduped_matches and deduped_matches[-1][0] == marker:
            continue
        deduped_matches.append((marker, match.start()))

    if len(deduped_matches) < 2:
        return []

    for index, (marker, start) in enumerate(deduped_matches):
        end = deduped_matches[index + 1][1] if index + 1 < len(deduped_matches) else len(text)
        content = text[start:end].strip()
        if len(content) < 12:
            continue
        if not has_meaningful_payload(marker, content):
            continue
        sections.append(
            ProposedSection(
                title=marker,
                section_type_normalized=SECTION_KIND.get(marker.lower(), "conditioning"),
                content=content,
                order_index=len(sections),
            )
        )

    if len(sections) < 2:
        return []
    return sections


def can_replace_existing_sections(sections: list[sqlite3.Row]) -> bool:
    if not sections:
        return True
    return all(
        (section["section_type_raw"] or "").lower() == "recognized_exercises"
        or (section["title"] or "").lower() == "recognized exercises"
        for section in sections
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize archived workout cards into named sections.")
    parser.add_argument("db_path", help="Path to knowledge.db")
    parser.add_argument("user_email", nargs="?", help="Optional user email")
    parser.add_argument("--year", help="Optional archive year filter, e.g. 2024")
    parser.add_argument("--source-system", dest="source_system", help="Optional source_system filter")
    parser.add_argument("--apply", action="store_true", help="Persist inferred sections")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    user = find_user(conn, args.user_email)
    if not user:
        print("ERROR: target user not found in knowledge.db")
        sys.exit(1)

    user_id = user["id"]
    filters = ["user_id = ?"]
    params: list[str] = [user_id]
    if args.year:
        filters.append("substr(archive_date, 1, 4) = ?")
        params.append(args.year)
    if args.source_system:
        filters.append("source_system = ?")
        params.append(args.source_system)

    workouts = conn.execute(
        f"""
        SELECT id, archive_date, title, raw_ocr_text, corrected_text
        FROM archived_workouts
        WHERE {' AND '.join(filters)}
        ORDER BY archive_date ASC, title ASC
        """,
        params,
    ).fetchall()

    total = len(workouts)
    candidates = 0
    replaceable = 0
    updated = 0

    print(f"User: {user['email']}")
    print(f"Archived workouts scanned: {total}")

    for workout in workouts:
        source_text = normalize_text(workout["corrected_text"] or workout["raw_ocr_text"] or "")
        proposed = infer_sections(source_text)
        if not proposed:
            continue

        candidates += 1
        existing_sections = conn.execute(
            """
            SELECT id, section_type_raw, title
            FROM archived_workout_sections
            WHERE archived_workout_id = ?
            ORDER BY order_index ASC, created_at ASC
            """,
            (workout["id"],),
        ).fetchall()

        if not can_replace_existing_sections(existing_sections):
            continue

        replaceable += 1

        if not args.apply:
            if replaceable <= 10:
                print(
                    f"[dry-run] {workout['archive_date']} {workout['title']}: "
                    + ", ".join(section.title for section in proposed)
                )
            continue

        with conn:
            conn.execute(
                "DELETE FROM archived_workout_sections WHERE archived_workout_id = ?",
                (workout["id"],),
            )
            for section in proposed:
                conn.execute(
                    """
                    INSERT INTO archived_workout_sections
                      (id, archived_workout_id, section_type_raw, section_type_normalized, title,
                       content_raw, content_corrected, order_index, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        new_id(),
                        workout["id"],
                        section.title,
                        section.section_type_normalized,
                        section.title,
                        section.content,
                        section.content,
                        section.order_index,
                    ),
                )

        updated += 1
        if updated % 100 == 0:
            print(f"  {updated} updated...")

    print(f"Candidates with multiple block markers: {candidates}")
    print(f"Replaceable records: {replaceable}")
    if args.apply:
        print(f"Updated records: {updated}")
    else:
        print("Dry run only. Re-run with --apply to persist changes.")


if __name__ == "__main__":
    main()
