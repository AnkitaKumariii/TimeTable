from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()


def _build_engine():
    """Create the SQLAlchemy engine.

    - For local dev (sqlite:///) → standard SQLite engine.
    - For production (libsql://) → use libsql-experimental as a DBAPI
      driver while keeping the SQLite dialect so Alembic/SQLAlchemy work
      without a custom dialect package.

    NullPool is used for Turso so every request gets a brand-new
    libsql connection. The pooler in libsql-experimental is not stable
    enough to be reused across requests — stale connections cause a Rust
    panic (Option::unwrap() on None) when SQLAlchemy tries to reuse them.
    """
    url = settings.database_url

    if settings.is_turso:
        try:
            import libsql_experimental as libsql  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "libsql-experimental is not installed. "
                "Run: pip install libsql-experimental"
            ) from exc

        auth_token = settings.turso_auth_token

        def _creator():
            conn = libsql.connect(database=url, auth_token=auth_token)

            class LibsqlConnectionWrapper:
                def __init__(self, c):
                    self._c = c

                @property
                def isolation_level(self):
                    return self._c.isolation_level

                @isolation_level.setter
                def isolation_level(self, value):
                    # libsql-experimental does not support dynamic isolation_level
                    # changes — silently ignore them so SQLAlchemy doesn't crash.
                    pass

                def __getattr__(self, name):
                    return getattr(self._c, name)

                def create_function(self, *args, **kwargs):
                    pass  # Prevent SQLAlchemy SQLite dialect from crashing

            return LibsqlConnectionWrapper(conn)

        engine = create_engine(
            "sqlite://",          # use SQLite dialect
            creator=_creator,
            poolclass=NullPool,   # no connection reuse — avoids Rust panic on stale conns
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
        )

    return engine


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass