"""Pydantic v2 schemas for request/response validation."""
from __future__ import annotations

from datetime import datetime, time
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models import DayOfWeek, UserRole


# ── Shared config ──────────────────────────────────────────────────────────────

class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Auth ───────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: UserRole
    is_active: bool


# ── Batch ──────────────────────────────────────────────────────────────────────

class BatchCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    is_active: bool = True


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class BatchOut(_ORM):
    id: int
    name: str
    color: str
    is_active: bool


# ── Subject ────────────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    batch_id: int
    name: str
    short_code: str
    color: str = "#0ea5e9"


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    color: Optional[str] = None


class SubjectOut(_ORM):
    id: int
    batch_id: int
    name: str
    short_code: str
    color: str


# ── Faculty ────────────────────────────────────────────────────────────────────

class FacultyCreate(BaseModel):
    name: str
    email: Optional[str] = None


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class FacultyOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None


# ── TimeSlot ───────────────────────────────────────────────────────────────────

class TimeSlotCreate(BaseModel):
    label: str
    start_time: time
    end_time: time
    sort_order: int
    is_break: bool = False


class TimeSlotUpdate(BaseModel):
    label: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    sort_order: Optional[int] = None
    is_break: Optional[bool] = None


class TimeSlotOut(_ORM):
    id: int
    label: str
    start_time: time
    end_time: time
    sort_order: int
    is_break: bool


# ── TimetableEntry ─────────────────────────────────────────────────────────────

class EntryCreate(BaseModel):
    batch_id: int
    subject_id: int
    faculty_id: int
    day: DayOfWeek
    time_slot_id: int


class EntryUpdate(BaseModel):
    batch_id: Optional[int] = None
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    day: Optional[DayOfWeek] = None
    time_slot_id: Optional[int] = None
    version: int  # required – optimistic concurrency


class ConflictingEntry(BaseModel):
    batch: str
    subject: str
    time_slot: str
    day: str


class EntryCheckResponse(BaseModel):
    status: Literal["ok", "conflict", "warning"]
    message: str = ""
    conflicting_entry: Optional[ConflictingEntry] = None


class EntryOut(_ORM):
    id: int
    batch_id: int
    subject_id: int
    faculty_id: int
    day: DayOfWeek
    time_slot_id: int
    version: int
    created_at: datetime
    updated_at: datetime
    # Nested for convenience
    batch: BatchOut
    subject: SubjectOut
    faculty: FacultyOut
    time_slot: TimeSlotOut


class EntryCreateResponse(BaseModel):
    """Returned from POST /timetable/entries – may carry a warning even on success."""
    status: Literal["ok", "warning"]
    entry: EntryOut
    message: str = ""
    conflicting_entry: Optional[ConflictingEntry] = None


# ── Settings ───────────────────────────────────────────────────────────────────

class ActiveDaysUpdate(BaseModel):
    active_days: list[DayOfWeek]


class ActiveDaysOut(BaseModel):
    active_days: list[DayOfWeek]
