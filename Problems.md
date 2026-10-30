The most urgent issues are around **data integrity, deployment consistency, and timetable-rule enforcement**. The repository already has substantial conflict logic, but several edge cases could still produce incorrect or fragile schedules.

## High-priority issues

### 1. Destructive Alembic migration must never reach production

`backend/alembic/versions/a442757cc914_recreate_subjects_and_entries.py` explicitly drops and recreates `subjects` and `timetable_entries`.

This is marked as a pre-production reset, but it remains dangerous if a deployment runs `alembic upgrade head` against a database containing real timetable data. The downgrade is also intentionally unavailable.

**Action:**

- Verify that this migration has never been applied to a production database.
- Replace destructive migrations with additive migrations for all future schema changes.
- Add a CI check that rejects migrations containing `DROP TABLE`, unless explicitly approved.
- Take a database backup before every production migration.
- Add a migration smoke test against a copy of realistic timetable data.

This is the most serious data-loss risk.

---

### 2. Database behavior differs between SQLite and Turso/libSQL

The application supports both SQLite and Turso, but some integrity rules are implemented through SQLite-specific triggers in `models.py`, including faculty double-booking prevention.

The application-level conflict checks are useful, but they are not enough by themselves under concurrent requests. Two requests can both pass the check before either inserts the entry.

Potential results:

- Two faculties assigned to simultaneous classes.
- Race conditions between concurrent admins.
- Different behavior in local SQLite versus production Turso.

**Action:**

- Confirm that all triggers and constraints used locally are supported and active on Turso/libSQL.
- Add integration tests that run against the actual production database type.
- Enforce critical constraints at the database level where possible.
- Treat application conflict checks as user feedback, not the sole integrity mechanism.
- Add concurrency tests for two simultaneous timetable writes.

---

### 3. Active days are configurable but may not be enforced during entry creation

The backend exposes `/timetable/active-days`, but the timetable entry creation and update logic does not appear to reject entries scheduled on an inactive day.

This means an administrator could disable Saturday and still potentially create or retain Saturday entries.

**Action:**

- Validate `payload.day` against the configured active days in both create and update endpoints.
- Decide what happens when an existing day is disabled:
  - block disabling it while entries exist,
  - warn the administrator,
  - or retain entries but hide them.
- Make the frontend and backend behavior consistent.

---

### 4. Weekly hour limits need clearer semantics for labs

The current logic counts lab hours per group, while theory hours are counted globally. That may be correct, but it creates several questions:

- Does `hours_per_week` mean hours per group or total lab hours?
- Should a two-group lab count as two teaching hours or one session?
- Does auto-fill count all generated entries correctly?
- Can changing a subject from theory to lab invalidate existing entries?
- Can reducing `hours_per_week` below the already scheduled count leave invalid data?

**Action:**

Document the exact rule and enforce it consistently across:

- create,
- update,
- bulk create,
- lab auto-fill,
- subject edit,
- export,
- reporting.

Add tests for multi-group labs and subject-type changes.

**Status: Solved**
- **Lab vs. Theory Hours Semantics**: Clarified and enforced across both backend (`backend/app/routers/timetable.py`, `backend/app/routers/subjects.py`) and frontend (`frontend/src/components/EntryModal.tsx`):
  - For **Labs**, `hours_per_week` is the allotted quota **per group** (each group gets up to `hours_per_week` scheduled periods).
  - For **Theory**, `hours_per_week` is a **global quota** across all entries for that subject in the batch.
- **Subject Update Payload Fix**:
  - `SubjectForm` previously passed `{ batch_id, ... }` to `updateSubject`, triggering Pydantic's `extra="forbid"` on `SubjectUpdate` and failing with HTTP 422 (`[object Object]` toast).
  - Frontend `BatchesPage.tsx` now strips `batch_id` before issuing `PATCH /subjects/{id}` and formats validation errors legibly.
  - `SubjectUpdate` schema in `backend/app/schemas.py` now permits optional `batch_id` for backward compatibility.
- **Integrity Validation on Subject Edits**:
  - `backend/app/routers/subjects.py` prevents reducing `hours_per_week` below existing scheduled entries (per-group for labs, global for theory) with HTTP 400.
  - Prevents altering subject type (`lab` <-> `theory`) when existing timetable entries exist for the subject with HTTP 400.
  - Prevents moving a subject to another batch when existing timetable entries exist with HTTP 400.
- **Automated Tests**:
  - Added test coverage in `backend/tests/test_subjects.py` verifying lab hours updates, batch_id resilience, type-change guards, and hour-reduction rejections.

---

### 5. Lab auto-fill can create partial schedules

The recent implementation auto-fills consecutive lab slots and stops at the first hard conflict. This is user-friendly, but partial success can leave a lab with fewer hours than intended.

For example, a lab requiring three hours may save only two if the third slot conflicts.

**Action:**

- Show the exact number of slots successfully created and the number skipped.
- Provide an explicit “rollback all” option.
- Consider making auto-fill transactional by default: either create all requested slots or create none.
- Prevent a later manual edit from making the schedule exceed the subject’s weekly limit.

**Status:** ✅ Solved

**What was solved:**
1. **Atomic All-or-Nothing Transactional Auto-fill (`/api/timetable/entries/bulk`)**:
   - Lab creation batches all required consecutive periods into a single atomic payload.
   - If any period in the session encounters a hard conflict (room, faculty, group, or day constraint) or an unforced soft warning, the entire database transaction is immediately rolled back (`db.rollback()`), guaranteeing that no partial or orphaned lab slots are ever created.
2. **Context-Aware Conflict & Warning Diagnostics**:
   - When a slot in the consecutive sequence conflicts, the backend labels the exact period and time window where the issue occurred (e.g., `Cannot schedule 3-period lab (all slots rolled back): conflict in Period 3 (11:00 AM–12:00 PM) — ⚠️ Room ... is already occupied`).
3. **Synchronized Multi-Slot Session Editing**:
   - In `EntryModal.tsx`, editing an existing multi-period lab session now updates all contiguous slots of the session in lockstep (preserving individual slot IDs/days while updating faculty, room, and subject).
   - In the modal UI, the current session being edited is excluded from the subject's remaining hours quota so it doesn't self-conflict during updates.
4. **Weekly Limit Enforcement on Edits**:
   - `PUT /entries/{id}` validates `_check_conflicts`, blocking any manual edit or subject reassignment that would cause the subject/group weekly limit to be exceeded.
5. **Comprehensive Automated Test Suite**:
   - Added unit and integration tests in `backend/tests/test_timetable.py`:
     - `test_bulk_create_transactional_rollback_on_conflict`: verifies rollback of earlier valid slots when a later slot conflicts.
     - `test_bulk_create_weekly_limit_enforced`: verifies that bulk lab creations exceeding `hours_per_week` are rejected.
     - `test_update_entry_exceeding_weekly_limit_rejected`: verifies that manual edits cannot breach subject weekly limits.

---

### 6. Update validation is more complex than create validation

The update endpoint calculates “effective” values, which is good, but it has a large number of combinations involving:

- changing batch,
- changing subject,
- changing group,
- changing faculty,
- changing day or slot,
- changing subject type.

These combinations are easy to get wrong.

Important cases to test:

- Moving a lab entry to another batch while retaining the old group.
- Changing a theory entry to a lab subject without supplying a group.
- Changing a lab subject to theory while leaving a group attached.
- Moving an entry into an inactive day.
- Moving an entry when the new subject has already reached its weekly limit.
- Updating a multi-faculty lab to a single faculty.
- Moving an entry into a slot occupied by another group of the same batch.

A shared validation service for create and update would reduce divergence.

---

### 7. Conflict messages can be incomplete for multi-faculty and multi-group entries

The backend returns the first matching conflict using `.first()`. For a lab with multiple faculty members or several groups, users may need to know all affected resources.

Current messages may not clearly identify:

- which selected faculty caused the conflict,
- which lab group conflicts,
- whether the room or faculty is the blocking resource,
- all conflicting entries when more than one exists.

**Action:**

Return structured conflict data such as:

```text
{
  "resource_type": "faculty",
  "resource_id": 12,
  "resource_name": "...",
  "conflicting_entry_id": 44,
  "day": "...",
  "time_slot": "...",
  "batch": "...",
  "group": "..."
}
```

This will also make frontend handling more reliable than parsing human-readable messages.

---

## Important logic and consistency issues

### 8. Architecture documentation is stale

`architecture.md` still describes timetable entries as having a single `faculty_id`, while the current model uses a many-to-many `timetable_entry_faculty` table and `faculties`.

The documentation also does not fully reflect:

- lab groups,
- room constraints,
- multi-faculty labs,
- current migration structure,
- the actual Turso behavior.

**Action:** Update the architecture diagrams and ER model so they match the current database schema. Stale documentation can lead future contributors to reintroduce the old single-faculty design.

**Status:** ✅ Solved

**What was solved:**
1. **ER Model Overhaul**:
   - Updated Mermaid ER diagram in `architecture.md` to reflect the actual schema:
     - `timetable_entry_faculty` junction table representing many-to-many relationships between `timetable_entries` and `faculty`.
     - `batch_groups` linked to `batches` and referenced by `timetable_entries`.
     - `rooms` table linked to `timetable_entries`.
     - `subjects` with `type` (`theory | lab`) and `hours_per_week`.
     - `time_slots` with `label`, `start_time`, `end_time`, `sort_order`, `is_break`.
     - `timetable_entries` with `version`, `room_id`, `group_id`, `day`, and timestamps.
2. **Scheduling Sequence & Endpoints**:
   - Updated sequence diagrams to document the atomic `/api/timetable/entries/bulk` endpoints (POST for auto-fill, PUT for session editing), row-level locks, rollback semantics, and soft back-to-back warning workflows.

---

### 9. Subject and batch deletion need dependency rules

Subjects, batches, groups, faculty, rooms, and time slots are referenced by timetable entries. The application needs a clear policy for deleting or deactivating them.

Potential problems include:

- deleting a batch and unintentionally deleting its full timetable,
- deleting a group that has scheduled lab entries,
- deleting a faculty member who is assigned to historical entries,
- deleting or editing a room used by existing classes,
- deleting a time slot referenced by entries.

**Action:**

Prefer soft deletion or explicit “cannot delete while in use” errors. Add dependency checks and tests for each resource type.

---

### 10. Time-slot validation is incomplete for updates

Create validation checks that `end_time > start_time`, but update validation only performs that check when both start and end times are supplied in the same request.

An update containing only `start_time` or only `end_time` could potentially create an invalid range after merging with existing values.

**Action:** Validate the final effective time range after applying partial updates.

Also consider validating:

- overlapping time slots,
- duplicate or conflicting `sort_order`,
- slots that overlap breaks,
- time slots with inconsistent labels and times.

---

### 11. Bulk creation needs stronger duplicate detection

The bulk endpoint relies on sequential calls to `_create_single_entry`. It should be tested for duplicate entries within the same request, including:

- duplicate theory entries,
- two groups assigned to the same room and slot,
- duplicate faculty assignments,
- duplicate lab groups,
- two entries that conflict only after an earlier payload is flushed.

The current logic may catch many of these, but this is an important area for regression tests because bulk creation and auto-fill are closely related.

---

### 12. Export correctness needs regression coverage

The project recently fixed PDF pagination, font loading, and faculty-role labels. Exports should be treated as a separate correctness surface.

Test that PDF/CSV output correctly represents:

- multiple faculties on lab entries,
- group-specific lab sessions,
- theory entries spanning all groups,
- active versus inactive days,
- room assignments,
- long subject names,
- empty timetable cells,
- different faculty filters.

A timetable that is correct in the web UI but incorrect in a downloaded PDF is still operationally unsafe.

---

## Security and operations

### 13. Authentication configuration needs production safeguards

JWT authentication is present, but production should verify that:

- `JWT_SECRET_KEY` is mandatory and not allowed to use a weak default.
- Admin credentials are not seeded unexpectedly on every startup.
- Tokens have an appropriate expiration time.
- There is a logout or token-revocation strategy if credentials are compromised.
- Password changes are supported.
- Failed login attempts are rate-limited or monitored.
- CORS and proxy settings are restricted for the deployment environment.

---

### 14. Database backup and recovery is not sufficiently operationalized

Because the timetable is the source of truth for academic scheduling, deployment should include:

- automated backups,
- tested restoration,
- migration rollback procedures,
- export of the current timetable before major changes,
- monitoring for database errors,
- alerting when the health endpoint reports availability but the database is unusable.

The health check should ideally verify database connectivity as well as HTTP availability.

---

### 15. CI should run backend, frontend, migration, and build checks

The repository has backend tests, but smooth operation would benefit from a required CI pipeline covering:

- Python tests,
- TypeScript type checking,
- frontend production build,
- linting,
- migration upgrade from empty database,
- migration upgrade from seeded database,
- migration downgrade or documented downgrade limitations,
- Docker build,
- API integration tests against SQLite and Turso-compatible behavior.

The recent history contains several fixes for TypeScript build errors and missing files, so automated checks are particularly important.

## Recommended priority order

1. **Protect production data from destructive migrations.**
2. **Verify Turso/libSQL constraints, triggers, and transaction behavior.**
3. **Enforce active-day rules in the backend.**
4. **Add concurrency and conflict-integrity tests.**
5. **Clarify and test lab weekly-hour and auto-fill semantics.**
6. **Unify create/update validation.**
7. **Fix architecture documentation to match the current many-to-many faculty model.**
8. **Add deletion/deactivation safeguards.**
9. **Harden authentication, backups, and CI/CD.**
10. **Expand PDF/CSV regression tests.**

The repository currently reports no open GitHub issues, so these would be good candidates for creating a prioritized maintenance backlog rather than waiting for user-reported failures. Recent commits also show that the system is actively evolving around labs, faculty roles, concurrency, exports, and database migrations, which makes regression testing and schema safety especially urgent.