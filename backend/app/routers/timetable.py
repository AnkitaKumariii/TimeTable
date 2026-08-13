"""Timetable entries CRUD with hard-conflict detection and soft-warning logic."""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.deps import get_current_user, get_db
from app.models import (
    Batch,
    DayOfWeek,
    Faculty,
    Setting,
    Subject,
    TimeSlot,
    TimetableEntry,
    User,
)
from app.schemas import (
    ActiveDaysOut,
    ActiveDaysUpdate,
    ConflictingEntry,
    EntryCheckResponse,
    EntryCreate,
    EntryCreateResponse,
    EntryOut,
    EntryUpdate,
)

router = APIRouter(prefix="/timetable", tags=["timetable"])

ACTIVE_DAYS_KEY = "active_days"
DEFAULT_ACTIVE_DAYS = [
    DayOfWeek.Monday,
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
    DayOfWeek.Friday,
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_time(t) -> str:
    """Format a time object as '9:00 AM'."""
    if t is None:
        return ""
    if hasattr(t, "strftime"):
        return t.strftime("%I:%M %p").lstrip("0")
    return str(t)


def _slot_label(slot: TimeSlot) -> str:
    return f"{slot.label} ({_fmt_time(slot.start_time)}–{_fmt_time(slot.end_time)})"


def _check_conflicts(
    db: Session,
    faculty_id: int,
    batch_id: int,
    day: DayOfWeek,
    time_slot_id: int,
    subject_id: int,
    exclude_entry_id: Optional[int] = None,
    lock_subject: bool = False,
) -> EntryCheckResponse:
    """Run conflict + adjacency + limit checks. Returns structured result."""

    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    current_slot = db.query(TimeSlot).filter(TimeSlot.id == time_slot_id).first()
    
    subject_q = db.query(Subject).filter(Subject.id == subject_id)
    if lock_subject:
        subject_q = subject_q.with_for_update()
    subject = subject_q.first()

    if not faculty or not current_slot or not subject:
        return EntryCheckResponse(status="ok")

    # ── 0. Weekly Limit Check ──────────────────────────────────────────────────
    usage_q = db.query(TimetableEntry).filter(TimetableEntry.subject_id == subject_id)
    if exclude_entry_id:
        usage_q = usage_q.filter(TimetableEntry.id != exclude_entry_id)
    usage_count = usage_q.count()
    if usage_count >= subject.hours_per_week:
        return EntryCheckResponse(
            status="conflict",
            message=(
                f"⚠️ Cannot add: {subject.name} exceeds its limit of {subject.hours_per_week} hours per week. "
                f"(Currently allotted: {usage_count})"
            )
        )

    # ── 1. Hard conflict: same faculty + same slot + DIFFERENT batch ────────────
    q = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.batch),
            joinedload(TimetableEntry.subject),
            joinedload(TimetableEntry.time_slot),
        )
        .filter(
            TimetableEntry.faculty_id == faculty_id,
            TimetableEntry.day == day,
            TimetableEntry.time_slot_id == time_slot_id,
            TimetableEntry.batch_id != batch_id,
        )
    )
    if exclude_entry_id:
        q = q.filter(TimetableEntry.id != exclude_entry_id)

    conflict = q.first()
    if conflict:
        return EntryCheckResponse(
            status="conflict",
            message=(
                f"⚠️ {faculty.name} is already assigned to "
                f"{conflict.subject.name} for {conflict.batch.name} at this time."
            ),
            conflicting_entry=ConflictingEntry(
                batch=conflict.batch.name,
                subject=conflict.subject.name,
                time_slot=_slot_label(conflict.time_slot),
                day=conflict.day.value,
            ),
        )

    # ── 2. Soft warning: back-to-back across DIFFERENT batches ─────────────────
    # Check PREVIOUS slot (sort_order - 1, skip breaks)
    prev_slot = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.sort_order < current_slot.sort_order,
            TimeSlot.is_break == False,  # noqa: E712
        )
        .order_by(TimeSlot.sort_order.desc())
        .first()
    )
    if prev_slot:
        adj_q = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.batch),
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.time_slot),
            )
            .filter(
                TimetableEntry.faculty_id == faculty_id,
                TimetableEntry.day == day,
                TimetableEntry.time_slot_id == prev_slot.id,
                TimetableEntry.batch_id != batch_id,
            )
        )
        if exclude_entry_id:
            adj_q = adj_q.filter(TimetableEntry.id != exclude_entry_id)

        # Only warn if immediately adjacent (sort_order consecutive)
        if prev_slot.sort_order == current_slot.sort_order - 1:
            adj = adj_q.first()
            if adj:
                return EntryCheckResponse(
                    status="warning",
                    message=(
                        f"⏰ Heads up: {faculty.name} is already teaching "
                        f"{adj.subject.name} for {adj.batch.name} during "
                        f"{_slot_label(prev_slot)}. You're now assigning them "
                        f"for this batch at {_slot_label(current_slot)} — "
                        f"back to back with no gap."
                    ),
                    conflicting_entry=ConflictingEntry(
                        batch=adj.batch.name,
                        subject=adj.subject.name,
                        time_slot=_slot_label(prev_slot),
                        day=adj.day.value,
                    ),
                )

    # Check NEXT slot (sort_order + 1, skip breaks)
    next_slot = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.sort_order > current_slot.sort_order,
            TimeSlot.is_break == False,  # noqa: E712
        )
        .order_by(TimeSlot.sort_order.asc())
        .first()
    )
    if next_slot and next_slot.sort_order == current_slot.sort_order + 1:
        adj_q2 = (
            db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.batch),
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.time_slot),
            )
            .filter(
                TimetableEntry.faculty_id == faculty_id,
                TimetableEntry.day == day,
                TimetableEntry.time_slot_id == next_slot.id,
                TimetableEntry.batch_id != batch_id,
            )
        )
        if exclude_entry_id:
            adj_q2 = adj_q2.filter(TimetableEntry.id != exclude_entry_id)
        adj2 = adj_q2.first()
        if adj2:
            return EntryCheckResponse(
                status="warning",
                message=(
                    f"⏰ Heads up: {faculty.name} is already teaching "
                    f"{adj2.subject.name} for {adj2.batch.name} during "
                    f"{_slot_label(next_slot)}. Assigning them at "
                    f"{_slot_label(current_slot)} will be back to back."
                ),
                conflicting_entry=ConflictingEntry(
                    batch=adj2.batch.name,
                    subject=adj2.subject.name,
                    time_slot=_slot_label(next_slot),
                    day=adj2.day.value,
                ),
            )

    return EntryCheckResponse(status="ok")


def _load_entry(db: Session, entry_id: int) -> TimetableEntry:
    entry = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.batch),
            joinedload(TimetableEntry.subject),
            joinedload(TimetableEntry.faculty),
            joinedload(TimetableEntry.time_slot),
        )
        .filter(TimetableEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


# ── Entries endpoints ──────────────────────────────────────────────────────────

@router.get("/entries", response_model=List[EntryOut])
def list_entries(
    batch_id: Optional[int] = Query(default=None),
    day: Optional[DayOfWeek] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TimetableEntry).options(
        joinedload(TimetableEntry.batch),
        joinedload(TimetableEntry.subject),
        joinedload(TimetableEntry.faculty),
        joinedload(TimetableEntry.time_slot),
    )
    if batch_id is not None:
        q = q.filter(TimetableEntry.batch_id == batch_id)
    if day is not None:
        q = q.filter(TimetableEntry.day == day)
    return q.all()


@router.post(
    "/entries/check",
    response_model=EntryCheckResponse,
    summary="Check for conflicts without saving",
)
def check_entry(
    payload: EntryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Pre-flight check — does NOT create anything."""
    return _check_conflicts(
        db,
        faculty_id=payload.faculty_id,
        batch_id=payload.batch_id,
        day=payload.day,
        time_slot_id=payload.time_slot_id,
        subject_id=payload.subject_id,
    )


@router.post(
    "/entries",
    response_model=EntryCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_entry(
    payload: EntryCreate,
    force: bool = Query(default=False, description="Set true to save despite a warning"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Validate FK existence
    for model, fid, label in [
        (Batch, payload.batch_id, "Batch"),
        (Subject, payload.subject_id, "Subject"),
        (Faculty, payload.faculty_id, "Faculty"),
        (TimeSlot, payload.time_slot_id, "Time slot"),
    ]:
        if not db.query(model).filter(model.id == fid).first():
            raise HTTPException(status_code=404, detail=f"{label} not found")

    # Validate subject belongs to the selected batch
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if subject.batch_id != payload.batch_id:
        raise HTTPException(
            status_code=422,
            detail="Subject does not belong to the selected batch",
        )

    # Check unique constraint (batch + day + slot)
    existing = db.query(TimetableEntry).filter(
        TimetableEntry.batch_id == payload.batch_id,
        TimetableEntry.day == payload.day,
        TimetableEntry.time_slot_id == payload.time_slot_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This batch already has a class at this slot"
        )

    check = _check_conflicts(
        db,
        faculty_id=payload.faculty_id,
        batch_id=payload.batch_id,
        day=payload.day,
        time_slot_id=payload.time_slot_id,
        subject_id=payload.subject_id,
        lock_subject=True,
    )

    # Hard conflict → block
    if check.status == "conflict":
        raise HTTPException(status_code=409, detail=check.message)

    # Soft warning → return 200 with warning info unless forced
    if check.status == "warning" and not force:
        # Return 200 with warning — frontend decides whether to re-submit with force=true
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=200,
            content={
                "status": "warning",
                "message": check.message,
                "conflicting_entry": check.conflicting_entry.model_dump() if check.conflicting_entry else None,
                "entry": None,
            },
        )

    entry = TimetableEntry(**payload.model_dump())
    db.add(entry)
    db.commit()

    full = _load_entry(db, entry.id)
    return EntryCreateResponse(
        status=check.status if check.status == "warning" else "ok",
        entry=EntryOut.model_validate(full),
        message=check.message,
        conflicting_entry=check.conflicting_entry,
    )


@router.put("/entries/{entry_id}", response_model=EntryCreateResponse)
def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Optimistic concurrency check
    if entry.version != payload.version:
        raise HTTPException(
            status_code=409,
            detail="This entry was changed elsewhere — please refresh and retry.",
        )

    update_data = payload.model_dump(exclude_unset=True, exclude={"version"})

    # Determine effective values for conflict check
    eff_faculty_id = update_data.get("faculty_id", entry.faculty_id)
    eff_batch_id = update_data.get("batch_id", entry.batch_id)
    eff_subject_id = update_data.get("subject_id", entry.subject_id)
    eff_day = update_data.get("day", entry.day)
    eff_slot_id = update_data.get("time_slot_id", entry.time_slot_id)

    # Validate subject belongs to the effective batch
    eff_subject = db.query(Subject).filter(Subject.id == eff_subject_id).first()
    if not eff_subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if eff_subject.batch_id != eff_batch_id:
        raise HTTPException(
            status_code=422,
            detail="Subject does not belong to the selected batch",
        )

    check = _check_conflicts(
        db,
        faculty_id=eff_faculty_id,
        batch_id=eff_batch_id,
        day=eff_day,
        time_slot_id=eff_slot_id,
        subject_id=eff_subject_id,
        exclude_entry_id=entry_id,
        lock_subject=True,
    )

    if check.status == "conflict":
        raise HTTPException(status_code=409, detail=check.message)

    if check.status == "warning" and not force:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=200,
            content={
                "status": "warning",
                "message": check.message,
                "conflicting_entry": check.conflicting_entry.model_dump() if check.conflicting_entry else None,
                "entry": None,
            },
        )

    for field, value in update_data.items():
        setattr(entry, field, value)
    entry.version += 1
    db.commit()

    full = _load_entry(db, entry.id)
    return EntryCreateResponse(
        status=check.status if check.status == "warning" else "ok",
        entry=EntryOut.model_validate(full),
        message=check.message,
        conflicting_entry=check.conflicting_entry,
    )


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


# ── Active days config ─────────────────────────────────────────────────────────

@router.get("/active-days", response_model=ActiveDaysOut)
def get_active_days(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    row = db.query(Setting).filter(Setting.key == ACTIVE_DAYS_KEY).first()
    if not row:
        return ActiveDaysOut(active_days=DEFAULT_ACTIVE_DAYS)
    return ActiveDaysOut(active_days=json.loads(row.value))


@router.put("/active-days", response_model=ActiveDaysOut)
def set_active_days(
    payload: ActiveDaysUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.query(Setting).filter(Setting.key == ACTIVE_DAYS_KEY).first()
    serialised = json.dumps([d.value for d in payload.active_days])
    if row:
        row.value = serialised
    else:
        db.add(Setting(key=ACTIVE_DAYS_KEY, value=serialised))
    db.commit()
    return ActiveDaysOut(active_days=payload.active_days)
