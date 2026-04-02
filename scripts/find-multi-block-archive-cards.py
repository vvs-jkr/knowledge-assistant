#!/usr/bin/env python3
"""
Find archived workout cards whose text appears to contain multiple named blocks.

Usage:
    python find-multi-block-archive-cards.py <knowledge.db> [user_email] [--year YYYY] [--limit N]
"""

import argparse
import re
import sqlite3
import sys


BLOCK_MARKERS = [
    "Charge",
    "Tactical",
    "Power",
    "Strong",
    "Lifting",
    "Endurance",
    "Gym",
    "Home",
    "Street",
    "Candy",
    "Flash",
]

PATTERN = re.compile(r"\b(" + "|".join(re.escape(marker) for marker in BLOCK_MARKERS) + r")\b", re.IGNORECASE)


def find_user(conn: sqlite3.Connection, user_email: str | None):
    if user_email:
        return conn.execute(
            "SELECT id, email FROM users WHERE email = ? LIMIT 1", (user_email,)
        ).fetchone()
    return conn.execute("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1").fetchone()


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\r", " ").replace("\n", " ")).strip()


def safe_console_text(value: str) -> str:
    return value.encode("cp1251", errors="replace").decode("cp1251")


def main() -> None:
    parser = argparse.ArgumentParser(description="Find archived workout cards with multiple named blocks.")
    parser.add_argument("db_path", help="Path to knowledge.db")
    parser.add_argument("user_email", nargs="?", help="Optional user email")
    parser.add_argument("--year", help="Optional year filter, e.g. 2024")
    parser.add_argument("--limit", type=int, default=50, help="Max rows to print")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    user = find_user(conn, args.user_email)
    if not user:
        print("ERROR: target user not found in knowledge.db")
        sys.exit(1)

    filters = ["user_id = ?"]
    params: list[str] = [user["id"]]
    if args.year:
        filters.append("substr(archive_date, 1, 4) = ?")
        params.append(args.year)

    rows = conn.execute(
        f"""
        SELECT id, archive_date, title, corrected_text, raw_ocr_text, review_status, ready_for_retrieval
        FROM archived_workouts
        WHERE {' AND '.join(filters)}
        ORDER BY archive_date DESC, title ASC
        """,
        params,
    ).fetchall()

    candidates = []
    for row in rows:
        text = normalize_text(row["corrected_text"] or row["raw_ocr_text"])
        matches = [match.group(1).title() for match in PATTERN.finditer(text)]
        unique_markers = []
        for marker in matches:
            if marker not in unique_markers:
                unique_markers.append(marker)
        if len(unique_markers) >= 2:
            candidates.append(
                {
                    "id": row["id"],
                    "archive_date": row["archive_date"],
                    "title": row["title"],
                    "markers": unique_markers,
                    "review_status": row["review_status"],
                    "ready_for_retrieval": bool(row["ready_for_retrieval"]),
                    "preview": text[:260],
                }
            )

    print(f"User: {user['email']}")
    print(f"Found {len(candidates)} multi-block candidates")
    print()

    for item in candidates[: args.limit]:
        print(f"{item['archive_date']} | {item['title']}")
        print(f"markers: {', '.join(item['markers'])}")
        print(f"status: {item['review_status']} | rag: {item['ready_for_retrieval']}")
        print(f"id: {item['id']}")
        print(f"text: {safe_console_text(item['preview'])}")
        print()


if __name__ == "__main__":
    main()
