"""Add room_id to timetable_entries

Revision ID: aee0d7d44274
Revises: cd5e4d0cf2b5
Create Date: 2026-09-18 00:45:17.560225

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aee0d7d44274'
down_revision: Union[str, None] = 'cd5e4d0cf2b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We use execute with PRAGMA foreign_keys=off to allow table rebuilds safely in SQLite if needed
    # But since we only alter timetable_entries, no other table references it, so it should be fine.
    
    with op.batch_alter_table('timetable_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('room_id', sa.Integer(), nullable=False, server_default='1'))
        # We ignore other constraint changes to avoid foreign key failures during migration.
        # Just create the foreign key for room_id.
        batch_op.create_foreign_key('fk_timetable_entries_room_id', 'rooms', ['room_id'], ['id'])

def downgrade() -> None:
    with op.batch_alter_table('timetable_entries', schema=None) as batch_op:
        batch_op.drop_constraint('fk_timetable_entries_room_id', type_='foreignkey')
        batch_op.drop_column('room_id')
