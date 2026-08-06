from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Faculty, User
from app.schemas import FacultyCreate, FacultyOut, FacultyUpdate

router = APIRouter(prefix="/faculty", tags=["faculty"])


@router.get("", response_model=List[FacultyOut])
def list_faculty(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Faculty).order_by(Faculty.name).all()


@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
def create_faculty(
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if payload.email and db.query(Faculty).filter(Faculty.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    faculty = Faculty(**payload.model_dump())
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return faculty


@router.get("/{faculty_id}", response_model=FacultyOut)
def get_faculty_member(
    faculty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    return faculty


@router.patch("/{faculty_id}", response_model=FacultyOut)
def update_faculty(
    faculty_id: int,
    payload: FacultyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faculty, field, value)
    db.commit()
    db.refresh(faculty)
    return faculty


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(
    faculty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(faculty)
    db.commit()
