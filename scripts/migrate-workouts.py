#!/usr/bin/env python3
"""
Migrate workouts from digitizer workouts.db → production knowledge.db.

Usage:
    python migrate-workouts.py <workouts.db> <knowledge.db>

The user is taken from the first (and only) account in knowledge.db.
Run this inside a Docker container that has both files accessible.
"""

import sqlite3
import sys
import uuid


CONFIDENCE_MAP = {'high': 1.0, 'medium': 0.7, 'low': 0.3}


def new_id() -> str:
    return uuid.uuid4().hex


def migrate(src_path: str, dst_path: str) -> None:
    src = sqlite3.connect(src_path)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(dst_path)
    dst.row_factory = sqlite3.Row

    # Get user
    user = dst.execute('SELECT id, email FROM users LIMIT 1').fetchone()
    if not user:
        print('ERROR: no users found in knowledge.db — register first via the web UI')
        sys.exit(1)

    user_id = user['id']
    print(f'Migrating workouts for user: {user["email"]} ({user_id})')

    src_workouts = src.execute('SELECT * FROM workouts').fetchall()
    print(f'Source: {len(src_workouts)} workouts in workouts.db')

    imported = 0
    skipped = 0

    with dst:
        for w in src_workouts:
            date = w['full_date']
            if not date:
                skipped += 1
                continue

            name = w['workout_name'] or 'Workout'

            # Skip duplicates by (user_id, date, name)
            exists = dst.execute(
                'SELECT 1 FROM workouts WHERE user_id = ? AND date = ? AND name = ?',
                (user_id, date, name),
            ).fetchone()
            if exists:
                skipped += 1
                continue

            confidence_str = w['year_confidence'] or 'low'
            year_confidence = CONFIDENCE_MAP.get(confidence_str, 0.3)

            workout_id = new_id()
            dst.execute(
                '''INSERT INTO workouts
                   (id, user_id, date, name, workout_type, duration_mins, rounds,
                    source_type, source_file, raw_text, year_confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    workout_id,
                    user_id,
                    date,
                    name,
                    w['workout_type'] or 'other',
                    w['duration_mins'],
                    w['rounds'],
                    w['source_type'] or 'other',
                    w['file'],
                    w['raw_text'],
                    year_confidence,
                ),
            )

            exercises = src.execute(
                'SELECT * FROM exercises WHERE workout_id = ? ORDER BY id',
                (w['id'],),
            ).fetchall()

            for order_idx, ex in enumerate(exercises):
                if not ex['name']:
                    continue

                # Upsert exercise by name (UNIQUE constraint)
                dst.execute(
                    'INSERT OR IGNORE INTO exercises (id, name) VALUES (?, ?)',
                    (new_id(), ex['name']),
                )
                ex_row = dst.execute(
                    'SELECT id FROM exercises WHERE name = ?',
                    (ex['name'],),
                ).fetchone()
                if not ex_row:
                    continue

                dst.execute(
                    '''INSERT INTO workout_exercises
                       (id, workout_id, exercise_id, reps, sets, weight_kg,
                        weight_note, duration_secs, order_index, notes)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (
                        new_id(),
                        workout_id,
                        ex_row[0],
                        ex['reps'],
                        ex['sets'],
                        ex['weight_kg'],
                        ex['weight_note'],
                        ex['duration_secs'],
                        order_idx,
                        ex['notes'],
                    ),
                )

            imported += 1
            if imported % 100 == 0:
                print(f'  {imported} imported...')

    print(f'\nDone: {imported} imported, {skipped} skipped (already exist)')

    src.close()
    dst.close()


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    migrate(sys.argv[1], sys.argv[2])
