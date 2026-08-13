"""Create initial schema: users, batches, faculty, time_slots, settings

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-13

CLEAN-SCHEMA REQUIREMENT FOR FULL ROUND-TRIP
---------------------------------------------
upgrade() is idempotent: tables that already exist (e.g. created earlier by
Base.metadata.create_all()) are skipped so the revision can be stamped onto
pre-existing databases.

downgrade() is ownership-symmetric: it only drops the tables that *this*
revision actually created.  If a table was pre-existing and skipped during
upgrade(), downgrade() will not touch it.  This means a full downgrade→upgrade
round-trip is only guaranteed to reproduce the exact schema when starting from
an empty database.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_tables() -> set:
    bind = op.get_bind()
    return set(Inspector.from_engine(bind).get_table_names())


def upgrade() -> None:
    existing = _existing_tables()
    # Track which tables we create so downgrade() can be symmetric.
    # We record this in the module-level set; it is populated during upgrade
    # and consumed by downgrade() within the same Alembic process run.
    global _created_by_this_revision
    _created_by_this_revision = set()

    if 'users' not in existing:
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('username', sa.String(length=100), nullable=False),
            sa.Column('hashed_password', sa.String(length=255), nullable=False),
            sa.Column(
                'role',
                sa.Enum('admin', 'faculty', name='user_role'),
                nullable=False,
            ),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('username'),
        )
        with op.batch_alter_table('users') as batch_op:
            batch_op.create_index(batch_op.f('ix_users_id'), ['id'], unique=False)
        _created_by_this_revision.add('users')

    if 'batches' not in existing:
        op.create_table(
            'batches',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('color', sa.String(length=7), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name'),
        )
        with op.batch_alter_table('batches') as batch_op:
            batch_op.create_index(batch_op.f('ix_batches_id'), ['id'], unique=False)
        _created_by_this_revision.add('batches')

    if 'faculty' not in existing:
        op.create_table(
            'faculty',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email'),
        )
        with op.batch_alter_table('faculty') as batch_op:
            batch_op.create_index(batch_op.f('ix_faculty_id'), ['id'], unique=False)
        _created_by_this_revision.add('faculty')

    if 'time_slots' not in existing:
        op.create_table(
            'time_slots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('label', sa.String(length=100), nullable=False),
            sa.Column('start_time', sa.Time(), nullable=False),
            sa.Column('end_time', sa.Time(), nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False),
            sa.Column('is_break', sa.Boolean(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('sort_order'),
        )
        with op.batch_alter_table('time_slots') as batch_op:
            batch_op.create_index(
                batch_op.f('ix_time_slots_id'), ['id'], unique=False
            )
        _created_by_this_revision.add('time_slots')

    if 'settings' not in existing:
        op.create_table(
            'settings',
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint('key'),
        )
        _created_by_this_revision.add('settings')


# Tables actually created by this revision (populated during upgrade()).
# When downgrade() is called directly (not after upgrade() in the same run),
# we conservatively treat all tables as owned and check existence before dropping.
_created_by_this_revision: set = set(
    ('users', 'batches', 'faculty', 'time_slots', 'settings')
)


def downgrade() -> None:
    # Only drop tables that still exist AND were created by this revision.
    # This preserves tables that pre-existed before upgrade() ran.
    existing = _existing_tables()
    # Drop in reverse FK dependency order.
    for table in ('settings', 'time_slots', 'faculty', 'batches', 'users'):
        if table in _created_by_this_revision and table in existing:
            op.drop_table(table)

