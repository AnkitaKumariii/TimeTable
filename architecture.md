# NitaTime Architecture

This document provides a high-level overview of the NitaTime college timetable management system architecture.

## System Architecture

NitaTime is built using a modern, unified tech stack. In production, it is deployed as a single Docker container where the FastAPI backend serves both the API and the compiled React static files.

```mermaid
flowchart TD
    %% Define Styles
    classDef client fill:#e3f2fd,stroke:#1e88e5,stroke-width:2px;
    classDef docker fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,stroke-dasharray: 5 5;
    classDef frontend fill:#fff3e0,stroke:#fb8c00,stroke-width:2px;
    classDef backend fill:#e8f5e9,stroke:#43a047,stroke-width:2px;
    classDef database fill:#ffebee,stroke:#e53935,stroke-width:2px;

    %% Client Layer
    Client["Browser / User"]:::client

    %% Docker Container (Unified Deployment)
    subgraph Container [Unified Docker Container]
        direction TB
        Static["React + Vite Frontend<br/>(Served as Static Files)"]:::frontend
        FastAPI["FastAPI Backend"]:::backend
        
        Static -.->|"API Calls<br/>JSON over HTTP"| FastAPI
    end
    class Container docker

    %% Database Layer
    DB[("Database<br/>SQLite / Turso")]:::database

    %% Connections
    Client -->|"HTTP Request"| Static
    Client -->|"REST API Requests"| FastAPI
    FastAPI <-->|"SQLAlchemy ORM"| DB
```

## Data Model Architecture

The database follows a relational model centered around timetable entries, supporting multi-faculty assignments, lab sub-groups, and physical rooms.

```mermaid
erDiagram
    users ||--o| faculty : "linked to"
    batches ||--o{ batch_groups : "divided into"
    batches ||--o{ subjects : "offers"
    batches ||--o{ timetable_entries : "has"
    batch_groups ||--o{ timetable_entries : "assigned to"
    subjects ||--o{ timetable_entries : "taught in"
    rooms ||--o{ timetable_entries : "hosted in"
    time_slots ||--o{ timetable_entries : "scheduled at"
    timetable_entries ||--|{ timetable_entry_faculty : "includes"
    faculty ||--|{ timetable_entry_faculty : "assigned via"

    users {
        int id PK
        string username
        string role "admin | faculty"
        boolean is_active
        datetime created_at
    }

    batches {
        int id PK
        string name "e.g. M.TECH-AI-1"
        string color
        boolean is_active
    }

    batch_groups {
        int id PK
        int batch_id FK
        string name "e.g. Group 1"
    }

    subjects {
        int id PK
        int batch_id FK
        string name
        string short_code
        string color
        int hours_per_week
        string type "theory | lab"
    }

    faculty {
        int id PK
        string name
        string email
        string role "professor | teaching_assistant"
        int user_id FK
    }

    rooms {
        int id PK
        string name "e.g. Lab 322"
    }

    time_slots {
        int id PK
        string label "e.g. Period 1"
        time start_time
        time end_time
        int sort_order
        boolean is_break
    }

    timetable_entries {
        int id PK
        int batch_id FK
        int group_id FK
        int subject_id FK
        int room_id FK
        int time_slot_id FK
        string day
        int version
        datetime created_at
        datetime updated_at
    }

    timetable_entry_faculty {
        int entry_id PK, FK
        int faculty_id PK, FK
    }

    settings {
        string key PK
        json value
    }
```

## Conflict Detection & Scheduling Flow

The system employs real-time constraint validation with optimistic locking (`version`), hard conflict prevention, and soft back-to-back warnings.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB

    User->>Frontend: Creates / Auto-fills Session
    Frontend->>Backend: POST /api/timetable/entries/bulk (or single entry)
    Backend->>DB: Lock Subject Row (with_for_update)
    Backend->>DB: Check Faculty Schedule, Room Availability & Limits

    alt Hard Conflict (Room booked, Faculty booked, Group booked, or Limit exceeded)
        Backend-->>DB: Rollback Transaction
        Backend-->>Frontend: HTTP 409 Conflict (detailed error message)
        Frontend-->>User: Show Hard Conflict Alert (cannot override)
    else Soft Warning (Back-to-back adjacent period with different class/subject)
        Backend-->>DB: Rollback Transaction (unless force=true)
        Backend-->>Frontend: HTTP 200 { status: "warning", message: "..." }
        Frontend-->>User: Prompt Warning Dialog: "Add Anyway" or "Cancel"
        opt User chooses "Add Anyway"
            User->>Frontend: Confirm Force Save
            Frontend->>Backend: POST /api/timetable/entries/bulk?force=true
            Backend->>DB: Persist All Slots in Transaction
            Backend-->>DB: Commit Transaction
            Backend-->>Frontend: HTTP 201 Created
            Frontend-->>User: Session Scheduled Successfully!
        end
    else No Conflict
        Backend->>DB: Persist All Slots in Single Transaction
        Backend-->>DB: Commit Transaction
        Backend-->>Frontend: HTTP 201 Created
        Frontend-->>User: Schedule Updated Successfully!
    end
```
