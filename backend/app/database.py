from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()


def _build_engine():
    """Create the SQLAlchemy engine.

    - For local dev (sqlite:///) → standard SQLite engine.
    - For production (libsql://) → use libsql-experimental as a DBAPI
      driver while keeping the SQLite dialect so Alembic/SQLAlchemy work
      without a custom dialect package.
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

        # Strip the libsql:// scheme and keep the host[:port]/database part
        host = url.removeprefix("libsql://")
        auth_token = settings.turso_auth_token

        def _creator():
            return libsql.connect(database=host, auth_token=auth_token)

        engine = create_engine(
            "sqlite://",  # use SQLite dialect
            creator=_creator,
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
