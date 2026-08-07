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
    Client[Browser / User]:::client

    %% Docker Container (Unified Deployment)
    subgraph Container [Unified Docker Container]
        direction TB
        Static[React + Vite Frontend\n(Served as Static Files)]:::frontend
        FastAPI[FastAPI Backend]:::backend
        
        Static -.->|API Calls\nJSON over HTTP| FastAPI
    end
    class Container docker

    %% Database Layer
    DB[(Database\nSQLite / Turso)]:::database

    %% Connections
    Client -->|HTTP Request| Static
    Client -->|REST API Requests| FastAPI
    FastAPI <-->|SQLAlchemy ORM| DB
```

## Data Model Architecture

The database follows a relational model centered around timetable entries.

```mermaid
erDiagram
    users ||--o{ timetable_entries : "may manage"
    batches ||--o{ timetable_entries : has
    subjects ||--o{ timetable_entries : includes
    faculty ||--o{ timetable_entries : teaches
    time_slots ||--o{ timetable_entries : occurs_at

    users {
        int id PK
        string username
        string role "admin | faculty"
    }

    batches {
        int id PK
        string name "e.g. M.TECH-AI-1"
    }

    subjects {
        int id PK
        string name
        string short_code
        string color
    }

    faculty {
        int id PK
        string name
    }

    time_slots {
        int id PK
        string period
        boolean is_break
        int sort_order
    }

    timetable_entries {
        int id PK
        int batch_id FK
        int subject_id FK
        int faculty_id FK
        int time_slot_id FK
        string day
    }

    settings {
        string key PK
        json value
    }
```

## Conflict Detection Flow

The system employs conflict resolution logic when assigning a faculty to a time slot.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB

    User->>Frontend: Saves Timetable Entry
    Frontend->>Backend: POST /timetable-entries
    Backend->>DB: Check Faculty Schedule
    DB-->>Backend: Existing Faculty Entries

    alt Hard Conflict (Same time slot, different batch)
        Backend-->>Frontend: HTTP 409 (Conflict)
        Frontend-->>User: Show Error (Cannot override)
    else Soft Warning (Adjacent time slot, different batch)
        Backend-->>Frontend: HTTP 200 { status: "warning" }
        Frontend-->>User: Prompt: "Add Anyway" / "Cancel"
        opt User chooses "Add Anyway"
            User->>Frontend: Confirm Force Add
            Frontend->>Backend: POST /timetable-entries?force=true
            Backend->>DB: Save Entry
            DB-->>Backend: Success
            Backend-->>Frontend: HTTP 200 OK
        end
    else No Conflict
        Backend->>DB: Save Entry
        DB-->>Backend: Success
        Backend-->>Frontend: HTTP 200 OK
        Frontend-->>User: Entry Saved!
    end
```
