"""Recreate subjects and entries with batch_id FK

Revision ID: a442757cc914
Revises: 0001_initial_schema
Create Date: 2026-08-13 16:43:00.930411

PRE-PRODUCTION RESET INTENT
---------------------------
This revision was deliberately written as a destructive reset.  At the time it
was created, the subjects table had no batch_id column and all existing subject
rows were orphaned (no valid batch to assign them to).  The upgrade() therefore
drops and fully recreates subjects and timetable_entries rather than performing
an additive migration.  This is intentional and safe because the migration was
applied before any production data existed in these two tables.

Do NOT copy this pattern for future migrations.  Any migration that runs
against a populated database must use additive ALTER TABLE / backfill / NOT
NULL constraint approach instead.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a442757cc914'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing tables
    op.execute('DROP TABLE IF EXISTS timetable_entries')
    op.execute('DROP TABLE IF EXISTS subjects')
    
    # Recreate subjects table
    op.create_table('subjects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('short_code', sa.String(length=20), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_id', 'short_code', name='uq_batch_subject_code')
    )
    with op.batch_alter_table('subjects', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_subjects_id'), ['id'], unique=False)
        
    # Recreate timetable_entries table
    op.create_table('timetable_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('faculty_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.Enum('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', name='day_of_week'), nullable=False),
        sa.Column('time_slot_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculty.id'], ),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
        sa.ForeignKeyConstraint(['time_slot_id'], ['time_slots.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_id', 'day', 'time_slot_id', name='uq_batch_day_slot')
    )
    with op.batch_alter_table('timetable_entries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_timetable_entries_id'), ['id'], unique=False)


def downgrade() -> None:
    pass
