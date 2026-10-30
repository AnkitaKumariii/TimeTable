from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Batch, Subject, SubjectType, TimetableEntry, User
from app.schemas import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=List[SubjectOut])
def list_subjects(
    batch_id: Optional[int] = Query(None, description="Filter subjects by batch"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Subject)
    if batch_id is not None:
        query = query.filter(Subject.batch_id == batch_id)
    return query.order_by(Subject.name).all()


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Batch).filter(Batch.id == payload.batch_id).first():
        raise HTTPException(status_code=404, detail="Batch not found")

    if (
        db.query(Subject)
        .filter(
            Subject.batch_id == payload.batch_id,
            Subject.short_code == payload.short_code,
        )
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Subject '{payload.short_code}' already exists in this batch",
        )

    subject = Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    data = payload.model_dump(exclude_unset=True)

    # 1. Batch change validation
    target_batch_id = data.get("batch_id", subject.batch_id)
    if "batch_id" in data and data["batch_id"] != subject.batch_id:
        if not db.query(Batch).filter(Batch.id == data["batch_id"]).first():
            raise HTTPException(status_code=404, detail="Target batch not found")
        has_entries = db.query(TimetableEntry).filter(TimetableEntry.subject_id == subject_id).first()
        if has_entries:
            raise HTTPException(
                status_code=400,
                detail="Cannot move subject to another batch while timetable entries exist for this subject.",
            )

    # 2. Short code conflict check
    if "short_code" in data or ("batch_id" in data and data["batch_id"] != subject.batch_id):
        check_code = data.get("short_code", subject.short_code)
        conflict = (
            db.query(Subject)
            .filter(
                Subject.batch_id == target_batch_id,
                Subject.short_code == check_code,
                Subject.id != subject_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Subject '{check_code}' already exists in this batch",
            )

    # 3. Subject type change validation
    if "type" in data and data["type"] != subject.type:
        has_entries = db.query(TimetableEntry).filter(TimetableEntry.subject_id == subject_id).first()
        if has_entries:
            raise HTTPException(
                status_code=400,
                detail="Cannot change subject type while timetable entries exist for this subject. Delete the entries first.",
            )

    # 4. Hours per week reduction validation
    if "hours_per_week" in data:
        new_hpw = data["hours_per_week"]
        target_type = data.get("type", subject.type)
        if target_type == SubjectType.lab:
            group_counts = (
                db.query(TimetableEntry.group_id, func.count(TimetableEntry.id))
                .filter(TimetableEntry.subject_id == subject_id)
                .group_by(TimetableEntry.group_id)
                .all()
            )
            for gid, count in group_counts:
                if count > new_hpw:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Cannot reduce hours/week to {new_hpw}: already has "
                            f"{count} hour(s) scheduled for a lab group. Delete some entries first."
                        ),
                    )
        else:
            usage_count = db.query(TimetableEntry).filter(TimetableEntry.subject_id == subject_id).count()
            if usage_count > new_hpw:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot reduce hours/week to {new_hpw}: already has "
                        f"{usage_count} hour(s) scheduled. Delete some entries first."
                    ),
                )

    for field, value in data.items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    db.delete(subject)
    db.commit()
