from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.deps import get_current_user, get_db
from app.models import Batch, BatchGroup, TimetableEntry, User
from app.schemas import (
    BatchCreate,
    BatchGroupCreate,
    BatchGroupOut,
    BatchGroupUpdate,
    BatchOut,
    BatchUpdate,
)

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("", response_model=List[BatchOut])
def list_batches(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Batch).order_by(Batch.name).all()


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Batch).filter(Batch.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Batch name already exists")
    batch = Batch(**payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.query(TimetableEntry).filter(TimetableEntry.batch_id == batch_id).delete()
    db.delete(batch)
    db.commit()


# ── Batch Groups ──────────────────────────────────────────────────────────────

@router.get("/{batch_id}/groups", response_model=List[BatchGroupOut])
def list_batch_groups(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(BatchGroup).filter(BatchGroup.batch_id == batch_id).order_by(BatchGroup.name).all()


@router.post("/{batch_id}/groups", response_model=BatchGroupOut, status_code=status.HTTP_201_CREATED)
def create_batch_group(
    batch_id: int,
    payload: BatchGroupCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(BatchGroup).filter(BatchGroup.batch_id == batch_id, BatchGroup.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Group name already exists in this batch")
    group = BatchGroup(batch_id=batch_id, **payload.model_dump())
    db.add(group)
    try:
        db.commit()
        db.refresh(group)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Group name already exists in this batch")
    return group


@router.patch("/{batch_id}/groups/{group_id}", response_model=BatchGroupOut)
def update_batch_group(
    batch_id: int,
    group_id: int,
    payload: BatchGroupUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = db.query(BatchGroup).filter(BatchGroup.id == group_id, BatchGroup.batch_id == batch_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if payload.name:
        if db.query(BatchGroup).filter(BatchGroup.batch_id == batch_id, BatchGroup.name == payload.name, BatchGroup.id != group_id).first():
            raise HTTPException(status_code=409, detail="Group name already exists in this batch")
        group.name = payload.name
        
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{batch_id}/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch_group(
    batch_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = db.query(BatchGroup).filter(BatchGroup.id == group_id, BatchGroup.batch_id == batch_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    db.query(TimetableEntry).filter(TimetableEntry.group_id == group_id).delete()
    db.delete(group)
    db.commit()
