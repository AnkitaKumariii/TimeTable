"""Pydantic v2 schemas for request/response validation."""
from __future__ import annotations

from datetime import datetime, time
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator, Field

from app.models import DayOfWeek, FacultyRole, UserRole, SubjectType


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


class BatchGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class BatchGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("name must not be blank")
            return stripped
        return v


class BatchGroupOut(_ORM):
    id: int
    batch_id: int
    name: str


# ── Subject ────────────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    batch_id: int
    name: str
    short_code: str
    color: str = "#0ea5e9"
    hours_per_week: int = 4
    type: SubjectType = SubjectType.theory


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    color: Optional[str] = None
    hours_per_week: Optional[int] = None
    type: Optional[SubjectType] = None


class SubjectOut(_ORM):
    id: int
    batch_id: int
    name: str
    short_code: str
    color: str
    hours_per_week: int
    type: SubjectType


# ── Faculty ────────────────────────────────────────────────────────────────────

class FacultyCreate(BaseModel):
    name: str
    email: Optional[str] = None
    role: FacultyRole = FacultyRole.professor


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[FacultyRole] = None


class FacultyOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None
    role: FacultyRole


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


# ── Room ───────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str


class RoomUpdate(BaseModel):
    name: Optional[str] = None


class RoomOut(_ORM):
    id: int
    name: str


# ── TimetableEntry ─────────────────────────────────────────────────────────────

class EntryCreate(BaseModel):
    batch_id: int
    group_id: Optional[int] = None
    subject_id: int
    faculty_ids: list[int] = Field(..., min_length=1)
    day: DayOfWeek
    time_slot_id: int
    room_id: int

    @field_validator("faculty_ids")
    @classmethod
    def no_duplicate_faculty(cls, v: list[int]) -> list[int]:
        if len(v) != len(set(v)):
            raise ValueError("faculty_ids must not contain duplicates")
        return v


class EntryUpdate(BaseModel):
    batch_id: Optional[int] = None
    group_id: Optional[int] = None
    subject_id: Optional[int] = None
    faculty_ids: Optional[list[int]] = None
    day: Optional[DayOfWeek] = None
    time_slot_id: Optional[int] = None
    room_id: Optional[int] = None
    version: int  # required – optimistic concurrency

    @field_validator("faculty_ids")
    @classmethod
    def no_duplicate_faculty(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is not None:
            if len(v) == 0:
                raise ValueError("faculty_ids must contain at least one ID")
            if len(v) != len(set(v)):
                raise ValueError("faculty_ids must not contain duplicates")
        return v


class ConflictingEntry(BaseModel):
    batch: str
    group: Optional[str] = None
    subject: str
    time_slot: str
    day: str
    room: str


class EntryCheckResponse(BaseModel):
    status: Literal["ok", "conflict", "warning"]
    message: str = ""
    conflicting_entry: Optional[ConflictingEntry] = None


class EntryOut(_ORM):
    id: int
    batch_id: int
    group_id: Optional[int] = None
    subject_id: int
    day: DayOfWeek
    time_slot_id: int
    room_id: int
    version: int
    created_at: datetime
    updated_at: datetime
    # Nested for convenience
    batch: BatchOut
    group: Optional[BatchGroupOut] = None
    subject: SubjectOut
    faculties: list[FacultyOut]
    time_slot: TimeSlotOut
    room: RoomOut


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
