"""Add room/day/slot uniqueness constraint.

Revision ID: 7b5d0a9f2c41
Revises: 202f335c8508
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7b5d0a9f2c41"
down_revision: Union[str, None] = "202f335c8508"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("timetable_entries", schema=None) as batch_op:
        batch_op.create_unique_constraint(
            "uq_room_day_slot",
            ["room_id", "day", "time_slot_id"],
        )

    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS prevent_faculty_double_booking_insert
        BEFORE INSERT ON timetable_entry_faculty
        FOR EACH ROW
        WHEN EXISTS (
            SELECT 1
            FROM timetable_entry_faculty existing_faculty
            JOIN timetable_entries existing_entry
                ON existing_entry.id = existing_faculty.entry_id
            JOIN timetable_entries new_entry
                ON new_entry.id = NEW.entry_id
            WHERE existing_faculty.faculty_id = NEW.faculty_id
              AND existing_entry.day = new_entry.day
              AND existing_entry.time_slot_id = new_entry.time_slot_id
              AND existing_entry.id != new_entry.id
        )
        BEGIN
            SELECT RAISE(ABORT, 'faculty double-booked for this slot');
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER IF NOT EXISTS prevent_faculty_double_booking_entry_update
        BEFORE UPDATE OF day, time_slot_id ON timetable_entries
        FOR EACH ROW
        WHEN EXISTS (
            SELECT 1
            FROM timetable_entry_faculty current_faculty
            JOIN timetable_entry_faculty other_faculty
                ON other_faculty.faculty_id = current_faculty.faculty_id
            JOIN timetable_entries other_entry
                ON other_entry.id = other_faculty.entry_id
            WHERE current_faculty.entry_id = OLD.id
              AND other_entry.id != OLD.id
              AND other_entry.day = NEW.day
              AND other_entry.time_slot_id = NEW.time_slot_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'faculty double-booked for this slot');
        END
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS prevent_faculty_double_booking_entry_update")
    op.execute("DROP TRIGGER IF EXISTS prevent_faculty_double_booking_insert")

    with op.batch_alter_table("timetable_entries", schema=None) as batch_op:
        batch_op.drop_constraint("uq_room_day_slot", type_="unique")
