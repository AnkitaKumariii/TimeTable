"""Pydantic v2 schemas for request/response validation."""
from __future__ import annotations

from datetime import datetime, time
from typing import Annotated, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PositiveInt,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models import DayOfWeek, FacultyRole, UserRole, SubjectType


# ── Shared config ──────────────────────────────────────────────────────────────

class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class _StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


NonBlank100 = Annotated[str, StringConstraints(min_length=1, max_length=100)]
NonBlank200 = Annotated[str, StringConstraints(min_length=1, max_length=200)]
ShortCode = Annotated[str, StringConstraints(min_length=1, max_length=20)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]


# ── Auth ───────────────────────────────────────────────────────────────────────

class LoginRequest(_StrictInput):
    username: NonBlank100
    password: Annotated[str, StringConstraints(min_length=1, strip_whitespace=False)]


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

class BatchCreate(_StrictInput):
    name: NonBlank100
    color: HexColor = "#6366f1"
    is_active: bool = True


class BatchUpdate(_StrictInput):
    name: Optional[NonBlank100] = None
    color: Optional[HexColor] = None
    is_active: Optional[bool] = None


class BatchOut(_ORM):
    id: int
    name: str
    color: str
    is_active: bool


class BatchGroupCreate(_StrictInput):
    name: NonBlank100

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class BatchGroupUpdate(_StrictInput):
    name: Optional[NonBlank100] = None

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

class SubjectCreate(_StrictInput):
    batch_id: PositiveInt
    name: NonBlank200
    short_code: ShortCode
    color: HexColor = "#0ea5e9"
    hours_per_week: int = Field(default=4, ge=1, le=12)
    type: SubjectType = SubjectType.theory


class SubjectUpdate(_StrictInput):
    name: Optional[NonBlank200] = None
    short_code: Optional[ShortCode] = None
    color: Optional[HexColor] = None
    hours_per_week: Optional[int] = Field(default=None, ge=1, le=12)
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

class FacultyCreate(_StrictInput):
    name: NonBlank200
    email: Optional[Annotated[str, StringConstraints(min_length=3, max_length=255)]] = None
    role: FacultyRole = FacultyRole.professor


class FacultyUpdate(_StrictInput):
    name: Optional[NonBlank200] = None
    email: Optional[Annotated[str, StringConstraints(min_length=3, max_length=255)]] = None
    role: Optional[FacultyRole] = None


class FacultyOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None
    role: FacultyRole


# ── TimeSlot ───────────────────────────────────────────────────────────────────

class TimeSlotCreate(_StrictInput):
    label: NonBlank100
    start_time: time
    end_time: time
    sort_order: int = Field(..., ge=0)
    is_break: bool = False

    @model_validator(mode="after")
    def validate_time_range(self) -> "TimeSlotCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TimeSlotUpdate(_StrictInput):
    label: Optional[NonBlank100] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_break: Optional[bool] = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "TimeSlotUpdate":
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TimeSlotOut(_ORM):
    id: int
    label: str
    start_time: time
    end_time: time
    sort_order: int
    is_break: bool


# ── Room ───────────────────────────────────────────────────────────────────────

class RoomCreate(_StrictInput):
    name: NonBlank100


class RoomUpdate(_StrictInput):
    name: Optional[NonBlank100] = None


class RoomOut(_ORM):
    id: int
    name: str


# ── TimetableEntry ─────────────────────────────────────────────────────────────

class EntryCreate(_StrictInput):
    batch_id: PositiveInt
    group_id: Optional[PositiveInt] = None
    subject_id: PositiveInt
    faculty_ids: list[int] = Field(..., min_length=1)
    day: DayOfWeek
    time_slot_id: PositiveInt
    room_id: PositiveInt

    @field_validator("faculty_ids")
    @classmethod
    def no_duplicate_faculty(cls, v: list[int]) -> list[int]:
        if any(fid <= 0 for fid in v):
            raise ValueError("faculty_ids must contain positive IDs")
        if len(v) != len(set(v)):
            raise ValueError("faculty_ids must not contain duplicates")
        return v


class EntryUpdate(_StrictInput):
    batch_id: Optional[PositiveInt] = None
    group_id: Optional[PositiveInt] = None
    subject_id: Optional[PositiveInt] = None
    faculty_ids: Optional[list[int]] = None
    day: Optional[DayOfWeek] = None
    time_slot_id: Optional[PositiveInt] = None
    room_id: Optional[PositiveInt] = None
    version: int = Field(..., ge=1)  # required – optimistic concurrency

    @field_validator("faculty_ids")
    @classmethod
    def no_duplicate_faculty(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is not None:
            if len(v) == 0:
                raise ValueError("faculty_ids must contain at least one ID")
            if any(fid <= 0 for fid in v):
                raise ValueError("faculty_ids must contain positive IDs")
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
    entry: Optional[EntryOut] = None
    message: str = ""
    conflicting_entry: Optional[ConflictingEntry] = None


# ── Settings ───────────────────────────────────────────────────────────────────

class ActiveDaysUpdate(_StrictInput):
    active_days: list[DayOfWeek]

    @field_validator("active_days")
    @classmethod
    def no_duplicate_days(cls, v: list[DayOfWeek]) -> list[DayOfWeek]:
        if len(v) != len(set(v)):
            raise ValueError("active_days must not contain duplicates")
        return v


class ActiveDaysOut(BaseModel):
    active_days: list[DayOfWeek]
