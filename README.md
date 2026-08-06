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
| Deploy | Render (backend) + Cloudflare Pages (frontend) |

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

## Deployment

### Backend → Render

1. Push code to GitHub
2. Create a new Web Service on Render, point to `backend/` directory
3. Render uses `render.yaml` for config automatically
4. Set environment variables in Render dashboard:
   - `DATABASE_URL` (Turso URL)
   - `TURSO_AUTH_TOKEN`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
   - `CORS_ORIGINS` (your Cloudflare Pages URL)
5. Health check: `/health`

> ⚠️ **Cold start**: Render free tier spins down after 15 minutes of inactivity.
> First request after idle takes **30–60 seconds**. The frontend shows a loading state
> while this happens. Consider adding a cron job to ping `/health` every 10 minutes
> if you need faster wake-up times.

### Frontend → Cloudflare Pages

1. Connect your GitHub repo in Cloudflare Pages
2. Set build settings:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Root directory**: `frontend`
3. Add environment variable:
   - `VITE_API_URL` = `https://your-render-service.onrender.com`
4. The `_redirects` file in `public/` handles SPA routing

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
