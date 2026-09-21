"""many to many faculty

Revision ID: 202f335c8508
Revises: aee0d7d44274
Create Date: 2026-09-21 12:47:46.277300

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202f335c8508'
down_revision: Union[str, None] = 'aee0d7d44274'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('timetable_entry_faculty',
    sa.Column('entry_id', sa.Integer(), nullable=False),
    sa.Column('faculty_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['entry_id'], ['timetable_entries.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['faculty_id'], ['faculty.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('entry_id', 'faculty_id')
    )
    
    with op.batch_alter_table('timetable_entries', schema=None) as batch_op:
        # SQLite doesn't name foreign keys reliably, but we can drop the column
        batch_op.drop_column('faculty_id')

def downgrade() -> None:
    with op.batch_alter_table('timetable_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('faculty_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_timetable_entries_faculty_id', 'faculty', ['faculty_id'], ['id'])
    
    op.drop_table('timetable_entry_faculty')
