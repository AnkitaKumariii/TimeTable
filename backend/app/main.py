"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import auth, batches, faculty, subjects, time_slots, timetable

settings = get_settings()


def _seed_admin() -> None:
    """Create the admin user on first run if they don't exist yet."""
    from app.auth import get_password_hash
    from app.models import User, UserRole

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == settings.admin_username).first():
            admin = User(
                username=settings.admin_username,
                hashed_password=get_password_hash(settings.admin_password),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"[NitaTime] Admin user '{settings.admin_username}' created.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (idempotent) then seed admin
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    yield


app = FastAPI(
    title="NitaTime API",
    version="1.0.0",
    description="College timetable management API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi import APIRouter
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ── API Routers ────────────────────────────────────────────────────────────────
api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(batches.router)
api_router.include_router(subjects.router)
api_router.include_router(faculty.router)
api_router.include_router(time_slots.router)
api_router.include_router(timetable.router)

@api_router.get("/health", tags=["health"])
def health_check():
    """Render health check endpoint — no auth required."""
    return {"status": "ok", "service": "NitaTime API"}

app.include_router(api_router)

# ── Frontend Serving ───────────────────────────────────────────────────────────
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve specific static files from root if they exist (like favicon, robots.txt)
        potential_file = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(potential_file):
            return FileResponse(potential_file)
        
        # Fallback to index.html for React Router SPA
        return FileResponse(os.path.join(frontend_dist, "index.html"))
