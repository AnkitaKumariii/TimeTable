"""Seed script — run once to populate default time slots and verify admin exists.

Usage:
    cd backend
    python seed.py
"""
from __future__ import annotations

import json
from datetime import time

from app.auth import get_password_hash
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import DayOfWeek, Setting, TimeSlot, User, UserRole

settings = get_settings()


def seed():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Admin user ────────────────────────────────────────────────────────
        if not db.query(User).filter(User.username == settings.admin_username).first():
            db.add(
                User(
                    username=settings.admin_username,
                    hashed_password=get_password_hash(settings.admin_password),
                    role=UserRole.admin,
                    is_active=True,
                )
            )
            print(f"✓ Created admin user '{settings.admin_username}'")
        else:
            print(f"  Admin user '{settings.admin_username}' already exists")

        # ── Default time slots ────────────────────────────────────────────────
        default_slots = [
            TimeSlot(label="Period 1", start_time=time(9, 0),  end_time=time(10, 0), sort_order=1,  is_break=False),
            TimeSlot(label="Period 2", start_time=time(10, 0), end_time=time(11, 0), sort_order=2,  is_break=False),
            TimeSlot(label="Period 3", start_time=time(11, 0), end_time=time(12, 0), sort_order=3,  is_break=False),
            TimeSlot(label="Period 4", start_time=time(12, 0), end_time=time(13, 0), sort_order=4,  is_break=False),
            TimeSlot(label="Lunch",    start_time=time(13, 0), end_time=time(14, 0), sort_order=5,  is_break=True),
            TimeSlot(label="Period 5", start_time=time(14, 0), end_time=time(15, 0), sort_order=6,  is_break=False),
            TimeSlot(label="Period 6", start_time=time(15, 0), end_time=time(16, 0), sort_order=7,  is_break=False),
            TimeSlot(label="Period 7", start_time=time(16, 0), end_time=time(17, 0), sort_order=8,  is_break=False),
            TimeSlot(label="Period 8", start_time=time(17, 0), end_time=time(18, 0), sort_order=9,  is_break=False),
        ]

        existing_count = db.query(TimeSlot).count()
        if existing_count == 0:
            for slot in default_slots:
                db.add(slot)
            print(f"✓ Seeded {len(default_slots)} default time slots")
        else:
            print(f"  {existing_count} time slot(s) already exist — skipping")

        # ── Default active days ───────────────────────────────────────────────
        if not db.query(Setting).filter(Setting.key == "active_days").first():
            db.add(Setting(
                key="active_days",
                value=json.dumps([d.value for d in [
                    DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday,
                    DayOfWeek.Thursday, DayOfWeek.Friday,
                ]]),
            ))
            print("✓ Seeded default active days (Mon–Fri)")

        db.commit()
        print("\n✅ Seed complete.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
