# NitaTime 🕒

A modern, robust, and dynamic college timetable management system designed specifically for NIT Agartala and scalable to any institution. NitaTime simplifies the complex task of academic scheduling with an intuitive drag-and-drop interface, intelligent conflict detection, and a unified, highly-performant architecture.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React-61dafb.svg)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)
![Turso](https://img.shields.io/badge/database-Turso-4ade80.svg)

---

## ✨ Core Features

### 🎛️ Interactive Scheduling Grid
- **Visual Timetable**: View and manage the entire college schedule on a dynamic weekly grid.
- **Context-Aware Mapping**: Seamlessly filter views by specific batches, faculties, or days.
- **Smart Validation**: Forms intelligently adapt based on the selected subject type (theory vs. lab) and automatically constrain available choices.

### 📚 Advanced Batch & Group Management
- **Multi-Batch Architecture**: Effortlessly manage timetables across multiple distinct cohorts (e.g. M.TECH-AI-1, B.TECH-CSE-3).
- **🧪 Lab Groups (Batch Groups)**: Divide batches into smaller subgroups to schedule concurrent lab sessions. Allows for precise handling of resource-intensive sessions where only a portion of the batch is occupied.
- **Subject Constraints**: Bind specific subjects to batches, categorize them as `Theory` or `Lab`, and enforce weekly hour limits per subject.

### ⚠️ Intelligent Conflict Detection
NitaTime ensures a flawless schedule by validating constraints in real-time before persisting any entry:
- **Hard Conflicts**: Strictly prevents assigning the same faculty to different batches at the exact same time, and ensures rooms are not double-booked. Concurrently running lab groups within the same batch are gracefully handled.
- **Soft Warnings**: Gently alerts the admin if a faculty member has consecutive back-to-back classes, allowing for an optional override if the schedule permits.
- **Optimistic Concurrency**: Employs row-level versioning. If multiple admins modify the schedule simultaneously, the system ensures changes aren't silently overwritten.

### ⚙️ Comprehensive Administrative Control
- **Secure Single Admin Login**: Centralized JWT-based control over the entire schedule to prevent unauthorized modifications.
- **Settings Dashboard**: Fully configure Batches, Faculty roles, Active Days, Rooms, and specific Time Slots directly from the UI.
- **Dynamic Active Days**: Toggle which days of the week are active (e.g., enable Saturday schedules on the fly).

### 🐳 Unified Deployment
- **Single Container**: Delivered as a multi-stage Docker container serving both the FastAPI backend and the static React frontend assets—eliminating the need for complex microservice orchestrations.
- **Edge Database Integration**: Native support for **Turso (libsql)** for blazing-fast, edge-replicated production data storage, while supporting local SQLite for rapid development.

---

## 💻 Tech Stack

| Layer | Technology | Description |
|-------|------------|-------------|
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance async Python framework for the API. |
| **Database ORM**| [SQLAlchemy](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/) | Robust data modeling and schema migrations. |
| **Database** | SQLite / [Turso](https://turso.tech/) | Local SQLite for dev, libSQL via Turso for edge production. |
| **Auth** | JWT | Secure Bearer token authentication. |
| **Frontend** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) | Lightning-fast UI rendering and bundling. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework for a responsive, modern design. |
| **State Mgt** | [TanStack Query](https://tanstack.com/query) | Powerful asynchronous state management and data fetching. |
| **Deploy** | Docker | Unified multi-stage container build. |

---

## 🏗️ Architecture

NitaTime is built on a unified monolith pattern for simplicity and speed. The FastAPI backend serves the REST API on `/api/*` and acts as a static file server for the compiled React frontend, ensuring CORS issues are non-existent in production and deployment is a breeze.

For a detailed view of the system components, data models, and conflict resolution logic, please refer to our **[Architecture Documentation](./architecture.md)**.

---

## 🚀 Local Development Setup

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit env
cp .env.example .env
# Edit .env — set ADMIN_USERNAME and ADMIN_PASSWORD at minimum

# Run database migrations
alembic upgrade head

# Seed default data (time slots + admin user)
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```
Interactive API docs are available at: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env
cp .env.example .env.local
# Default: VITE_API_URL=http://localhost:8000

# Start dev server
npm run dev
```
The App is available at: `http://localhost:5173`

---

## ☁️ Turso Setup (Production Database)

NitaTime uses Turso for serverless edge database hosting.

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
```env
DATABASE_URL=libsql://nitatime-<org>.turso.io
TURSO_AUTH_TOKEN=<token from above>
```

---

## 📦 Deployment (Docker)

NitaTime is packaged as a unified Docker container. You only need to deploy a single service.

1. **Push your code to GitHub.**
2. **Choose your hosting platform:**
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

> ⚠️ **Cold start Note**: If you are using a free tier on services like Render, the app will spin down after 15 minutes of inactivity. The first request after being idle may take **30–60 seconds** to wake up.

---

## 📂 Project Structure

```
TimeTable/
├── architecture.md      # Diagrams & In-depth Design Docs
├── backend/
│   ├── app/
│   │   ├── main.py      # FastAPI application & Static Serving
│   │   ├── models.py    # SQLAlchemy Data Models
│   │   ├── schemas.py   # Pydantic Validation Schemas
│   │   ├── auth.py      # JWT Authentication Middleware
│   │   ├── deps.py      # FastAPI Injected Dependencies
│   │   └── routers/     # REST API Resource Endpoints
│   ├── alembic/         # Alembic DB Migration Scripts
│   ├── seed.py          # One-time Database Seeding Script
│   └── requirements.txt # Python Dependencies
└── frontend/
    └── src/
        ├── api/         # Frontend API Client & Endpoints
        ├── components/  # Reusable UI Components (Grid, Modals)
        ├── pages/       # High-Level Views (Timetable, Settings)
        ├── types/       # Global TypeScript Interface Definitions
        └── lib/         # Utility Helpers
```
