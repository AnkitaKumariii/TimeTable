from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Batch, Subject, TimetableEntry, User
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

    if "short_code" in data:
        conflict = (
            db.query(Subject)
            .filter(
                Subject.batch_id == subject.batch_id,
                Subject.short_code == data["short_code"],
                Subject.id != subject_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Subject '{data['short_code']}' already exists in this batch",
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

    db.query(TimetableEntry).filter(TimetableEntry.subject_id == subject_id).delete()
    db.delete(subject)
    db.commit()
