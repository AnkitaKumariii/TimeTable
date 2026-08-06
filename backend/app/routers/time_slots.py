from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import TimeSlot, TimetableEntry, User
from app.schemas import TimeSlotCreate, TimeSlotOut, TimeSlotUpdate

router = APIRouter(prefix="/time-slots", tags=["time-slots"])


@router.get("", response_model=List[TimeSlotOut])
def list_time_slots(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    return db.query(TimeSlot).order_by(TimeSlot.sort_order).all()


@router.post("", response_model=TimeSlotOut, status_code=status.HTTP_201_CREATED)
def create_time_slot(
    payload: TimeSlotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(TimeSlot).filter(TimeSlot.sort_order == payload.sort_order).first():
        raise HTTPException(status_code=409, detail="sort_order already taken")
    slot = TimeSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/{slot_id}", response_model=TimeSlotOut)
def get_time_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    return slot


@router.patch("/{slot_id}", response_model=TimeSlotOut)
def update_time_slot(
    slot_id: int,
    payload: TimeSlotUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    data = payload.model_dump(exclude_unset=True)
    # If sort_order changes, ensure it's not taken by another slot
    if "sort_order" in data:
        conflict = (
            db.query(TimeSlot)
            .filter(TimeSlot.sort_order == data["sort_order"], TimeSlot.id != slot_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"sort_order {data['sort_order']} is already used by '{conflict.label}'",
            )
    for field, value in data.items():
        setattr(slot, field, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    db.query(TimetableEntry).filter(TimetableEntry.time_slot_id == slot_id).delete()
    db.delete(slot)
    db.commit()
