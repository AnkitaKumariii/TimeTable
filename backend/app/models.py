"""SQLAlchemy ORM models for NitaTime."""
from __future__ import annotations

import enum
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    faculty = "faculty"


class DayOfWeek(str, enum.Enum):
    Monday = "Monday"
    Tuesday = "Tuesday"
    Wednesday = "Wednesday"
    Thursday = "Thursday"
    Friday = "Friday"
    Saturday = "Saturday"


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    """Login accounts.  Only the admin is used today; the role field and
    faculty FK enable multi-user without a schema rewrite later."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.admin, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Reverse relation – one user may be linked to one faculty record later
    faculty_profile: Mapped[list["Faculty"]] = relationship(
        "Faculty", back_populates="user"
    )


class Batch(Base):
    """A student cohort / class section (e.g. M.TECH-AI-1)."""

    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    entries: Mapped[list["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="batch", cascade="all, delete-orphan"
    )
    subjects: Mapped[list["Subject"]] = relationship(
        "Subject", back_populates="batch", cascade="all, delete-orphan"
    )


class Subject(Base):
    """A subject / course specific to a batch."""

    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("batch_id", "short_code", name="uq_batch_subject_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("batches.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_code: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#0ea5e9", nullable=False)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="subjects")
    entries: Mapped[list["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="subject"
    )


class Faculty(Base):
    """A teacher / instructor (distinct from a login account)."""

    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # FK to users – null until multi-faculty login is enabled
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    user: Mapped["User | None"] = relationship("User", back_populates="faculty_profile")

    entries: Mapped[list["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="faculty"
    )


class TimeSlot(Base):
    """A period in the day.  sort_order is used for adjacency checks."""

    __tablename__ = "time_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    is_break: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    entries: Mapped[list["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="time_slot"
    )


class TimetableEntry(Base):
    """One scheduled class: batch × subject × faculty × day × slot."""

    __tablename__ = "timetable_entries"
    __table_args__ = (
        # A batch can only have one entry per (day, time_slot)
        UniqueConstraint(
            "batch_id", "day", "time_slot_id", name="uq_batch_day_slot"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("batches.id"), nullable=False
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.id"), nullable=False
    )
    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faculty.id"), nullable=False
    )
    day: Mapped[DayOfWeek] = mapped_column(
        Enum(DayOfWeek, name="day_of_week"), nullable=False
    )
    time_slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("time_slots.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="entries")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="entries")
    faculty: Mapped["Faculty"] = relationship("Faculty", back_populates="entries")
    time_slot: Mapped["TimeSlot"] = relationship("TimeSlot", back_populates="entries")


class Setting(Base):
    """Generic key-value store for app-level config (e.g. active_days)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-serialised
