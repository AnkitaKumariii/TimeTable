# NitaTime 🕒

A modern, robust college timetable management system designed specifically for NIT Agartala. 
NitaTime simplifies scheduling with intuitive interfaces, intelligent conflict detection, and a unified architecture.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React-61dafb.svg)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)

## ✨ Features

- **🔐 Secure Single Admin Login**: Centralized control over the entire schedule.
- **📚 Multi-Batch Scheduling**: Effortlessly manage timetables across multiple cohorts (e.g. M.TECH-AI-1).
- **⚠️ Intelligent Conflict Detection**:
  - *Hard Conflicts*: Prevents assigning the same faculty to different batches at the exact same time.
  - *Soft Warnings*: Alerts if a faculty member has consecutive classes, allowing an optional override.
- **⚙️ Comprehensive Settings**: Easily configure Batches, Subjects, Faculty, Active Days, and Time Slots from the UI.
- **⚡ Optimistic Concurrency**: Ensures multiple sessions don't overwrite each other's changes.
- **🐳 Unified Deployment**: Delivered as a single multi-stage Docker container serving both the API and static frontend assets.

## 🏗️ Architecture

For a detailed view of the system components, data models, and conflict resolution logic, please refer to our **[Architecture Documentation](./architecture.md)**.

## 💻 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI + SQLAlchemy + Alembic |
| **Database** | SQLite (Dev) / Turso (Prod) |
| **Auth** | JWT (Single Admin) |
| **Frontend** | React + Vite + Tailwind CSS + TanStack Query |
| **Deploy** | Unified Docker Container (Render / Railway / VPS) |

---

## 🚀 Local Development

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
API docs are available at: http://localhost:8000/docs

### Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env.local
# Default: VITE_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
```
App is available at: http://localhost:5173

---

## ☁️ Turso Setup (Production Database)

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

Set the following in your deployment environment:
```
DATABASE_URL=libsql://nitatime-<org>.turso.io
TURSO_AUTH_TOKEN=<token from above>
```

---

## 📦 Deployment (Docker)

NitaTime is packaged as a unified Docker container. The FastAPI backend serves both the API and the compiled React frontend, meaning you only need to deploy a single service.

1. **Push code to GitHub**
2. **Choose your hosting method:**
   - **PaaS (e.g., Render, Railway, Fly.io)**: Connect your GitHub repo, select **Docker** as your runtime, and configure the environment variables in your deployment dashboard.
   - **VPS (e.g., DigitalOcean, AWS EC2)**: Clone your repo to the server, create an `.env` file, and run:
     ```bash
     docker build -t nitatime . && docker run -p 8000:8000 --env-file .env nitatime
     ```
3. **Required Environment Variables**:
   - `DATABASE_URL` (Your Turso `libsql://...` URL)
   - `TURSO_AUTH_TOKEN` (Your Turso token)
   - `ADMIN_USERNAME` (Your desired admin login)
   - `ADMIN_PASSWORD` (Your desired admin password)
   - `JWT_SECRET_KEY` (Generate a secure random string)

4. The container exposes port `8000` by default.

> ⚠️ **Cold start**: If you are using a free tier on services like Render, the app will spin down after 15 minutes of inactivity. The first request after being idle may take **30–60 seconds**.

---

## 📂 Project Structure

```
TimeTable/
├── architecture.md      # Diagrams & Design docs
├── backend/
│   ├── app/
│   │   ├── main.py      # FastAPI app (API + Static Serving)
│   │   ├── models.py    # SQLAlchemy models
│   │   ├── schemas.py   # Pydantic schemas
│   │   ├── auth.py      # JWT helpers
│   │   ├── deps.py      # FastAPI dependencies
│   │   └── routers/     # Resource endpoints
│   ├── alembic/         # DB migrations
│   ├── seed.py          # One-time seed script
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/         # API client functions
        ├── components/  # Grid, Modal, ConflictNotification, etc.
        ├── pages/       # TimetablePage & Settings Pages (Batches, Subjects, Faculty, etc.)
        ├── types/       # TypeScript types
        └── lib/         # Utilities
```
