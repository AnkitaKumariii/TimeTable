# NitaTime

A college timetable management system for NIT Agartala.
Single admin login, multi-batch scheduling, conflict detection.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + SQLAlchemy + Alembic |
| Database | SQLite (dev) / Turso (prod) |
| Auth | JWT (single admin) |
| Frontend | React + Vite + Tailwind CSS + TanStack Query |
| Deploy | Unified Docker Container (Render / Railway / VPS) |

---

## Local Development

### Backend

```bash
cd backend

# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and edit env
cp .env.example .env
# Edit .env — set ADMIN_USERNAME and ADMIN_PASSWORD at minimum

# 4. Run migrations
alembic upgrade head

# 5. Seed default data (time slots + admin user)
python seed.py

# 6. Start server
uvicorn app.main:app --reload --port 8000
```

API docs at: http://localhost:8000/docs

### Frontend

```bash
cd frontend

# 1. Install
npm install

# 2. Copy env
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000 (default)

# 3. Start dev server
npm run dev
```

App at: http://localhost:5173

---

## Turso Setup (Production Database)

```bash
# Install Turso CLI
brew install tursodatabase/tap/turso  # macOS

# Login
turso auth login

# Create database
turso db create nitatime

# Get connection URL
turso db show nitatime --url
# → libsql://nitatime-<org>.turso.io

# Create auth token
turso db tokens create nitatime
```

Set in Render environment:
```
DATABASE_URL=libsql://nitatime-<org>.turso.io
TURSO_AUTH_TOKEN=<token from above>
```

---

## Deployment (Docker)

NitaTime is packaged as a unified, multi-stage Docker container. The FastAPI backend serves both the API and the compiled React frontend, meaning you only have to deploy a single service.

1. **Push code to GitHub**
2. **Connect to a PaaS** (e.g., Render, Railway, Fly.io) or run on a VPS.
3. Select **Docker** as your runtime.
4. Set the following environment variables in your deployment dashboard:
   - `DATABASE_URL` (Your Turso `libsql://...` URL)
   - `TURSO_AUTH_TOKEN` (Your Turso token)
   - `ADMIN_USERNAME` (Your desired admin login)
   - `ADMIN_PASSWORD` (Your desired admin password)
   - `JWT_SECRET_KEY` (Generate a secure random string)
5. The container exposes port `8000` by default.

> ⚠️ **Cold start**: If you are using a free tier on services like Render, the app will spin down after 15 minutes of inactivity. The first request after being idle may take **30–60 seconds**.

---

## Data Model Overview

```
users          → login accounts (role: admin | faculty)
batches        → student cohorts (e.g. M.TECH-AI-1)
subjects       → courses (name + short_code + color)
faculty        → teachers (separate from login accounts)
time_slots     → periods + breaks (with sort_order for adjacency checks)
timetable_entries → batch × subject × faculty × day × slot
settings       → key-value store (e.g. active_days JSON)
```

## Conflict Logic

When saving an entry, the backend checks in order:

1. **Hard conflict** (HTTP 409): Same faculty already assigned to a **different batch**
   at the exact same day + time slot. Cannot be overridden.

2. **Soft warning** (HTTP 200 with `status: "warning"`): Same faculty has a class in the
   **immediately adjacent** slot (before or after) for a **different batch**. Frontend
   shows "Add Anyway" / "Choose Different Slot" — re-submit with `?force=true` to save.

3. **Optimistic concurrency**: Every update includes the `version` the client last read.
   If it doesn't match, returns HTTP 409 with "changed elsewhere, please retry."

---

## Project Structure

```
TimeTable/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # JWT helpers
│   │   ├── deps.py          # FastAPI dependencies
│   │   └── routers/         # One file per resource
│   ├── alembic/             # DB migrations
│   ├── seed.py              # One-time seed script
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/             # API client functions
        ├── components/      # Grid, Modal, ConflictNotification, Combobox, Layout
        ├── pages/           # TimetablePage + settings sub-pages
        ├── types/           # TypeScript types
        └── lib/             # Utilities
```
