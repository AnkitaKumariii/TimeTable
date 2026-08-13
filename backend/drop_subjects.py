"""One-off migration helper: drop subjects and timetable_entries tables.

WARNING: This is a DESTRUCTIVE, IRREVERSIBLE operation.
Run only with explicit confirmation or with --yes flag in CI.

Usage:
    cd backend
    source .venv/bin/activate
    python drop_subjects.py
"""
import sys
from sqlalchemy import text
from app.database import engine


def drop_tables() -> None:
    confirmed = (
        "--yes" in sys.argv
        or input(
            "This will permanently DROP timetable_entries and subjects tables. "
            "Type 'yes' to continue: "
        ).strip()
        == "yes"
    )
    if not confirmed:
        print("Aborted.")
        sys.exit(0)

    with engine.begin() as conn:
        print("Dropping timetable_entries table...")
        conn.execute(text("DROP TABLE IF EXISTS timetable_entries"))

        print("Dropping subjects table...")
        conn.execute(text("DROP TABLE IF EXISTS subjects"))

    print("Done dropping tables.")


if __name__ == "__main__":
    drop_tables()
