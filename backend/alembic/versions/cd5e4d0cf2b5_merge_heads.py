"""Merge heads

Revision ID: cd5e4d0cf2b5
Revises: bd433ef9f351, ee56ca73837f
Create Date: 2026-09-18 00:44:07.101821

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd5e4d0cf2b5'
down_revision: Union[str, None] = ('bd433ef9f351', 'ee56ca73837f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
