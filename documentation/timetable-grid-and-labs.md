# Walkthrough: Timetable Grid Redesign & Automated Lab Scheduling

I have completed the major layout overhaul and implemented robust automation for scheduling lab groups. Here is a summary of the new features and architectural changes:

## 1. Timetable Grid Redesign
- **Batch / Group Hierarchy:** The main timetable view has been completely redesigned. The vertical axis now displays the `Day` spanning across a dedicated `Batch / Group` column.
- **Dedicated Group Rows:** Instead of a single row per batch with overlapping cards, each Batch Group gets its own explicit row. Empty slots render as clickable `+ Add` placeholders for *every* group.
- **Theory vs. Lab Picker:** Clicking an empty group slot prompts a mini-modal asking whether you are adding a **Theory** class (which automatically applies to all groups in that batch) or a **Lab** class (which applies only to the specific group row you clicked).
- **Visual Improvements:** Added "Theory" (blue) and "Lab" (violet) badges to the entry cards. Lab cards display a group pill, while theory cards span all group rows implicitly without needing the pill.

## 2. Automated Lab Scheduling
- **Consecutive Auto-Fill:** When scheduling a lab subject (e.g., a 3-hour lab), the system automatically attempts to book the required consecutive non-break slots after the initial slot.
- **Contiguous Slot Enforcement:** The auto-fill logic strictly adheres to contiguous time slots. It will safely halt before any break periods or misaligned sort orders, ensuring a lab isn't split across a break unless manually forced.
- **Group-Aware Weekly Limits:** The frontend now calculates effective capacity for lab subjects as `hours_per_week × number_of_groups`. The subject selection chips display this effective limit (e.g., `2/4 hrs (2×2)`), allowing subsequent groups to be scheduled even after the first group completes its weekly quota.
- **Independent Backend Quotas:** The backend validation logic was split so theory subjects enforce a global `hours_per_week` limit, whereas lab subjects enforce the limit *per group*.

## 3. "All-or-Nothing" Transactional Safety
- **Bulk Creation Endpoint:** `POST /api/timetable/entries/bulk` accepts a list of entry payloads for consecutive lab auto-fills.
- **Bulk Update Endpoint:** `PUT /api/timetable/entries/bulk` accepts a list of updated entries for atomic multi-period session edits, preventing version desynchronization or partial state.
- **Atomic Rollback on Error or Warning:** Both bulk endpoints validate all consecutive slots inside a single database transaction. If *any* slot encounters a hard conflict (room occupied, faculty double-booked, group conflict, or limit exceeded) or an unforced soft warning, the entire transaction is rolled back (`db.rollback()`), guaranteeing that no partial, orphaned, or misaligned slots remain.
- **Context-Aware Error Messages:** Conflict messages explicitly report the period label and time window where the issue was detected (e.g. `conflict in Period 3 (11:00 AM–12:00 PM)`).

## 4. Enhanced Consecutive Booking Soft Warnings
- **Cross-Subject Adjacency Detection:** Soft warnings for back-to-back faculty bookings now detect adjacent periods across **different subjects within the same batch** (e.g. Prof teaching Theory in Period 1 and Lab in Period 2) as well as across different batches.
- **False Alarm Suppression:** The same multi-period lab session (same batch, same subject, same group) is recognized as contiguous periods of a single session and does not trigger false warnings during auto-fill.
- **Admin Override:** Back-to-back warnings can be bypassed when intentional by confirming via `force=true`.

## 5. Lab Group Locking & Distinctive Visual Styling
- **Slot Group Locking:** Once a lab group is assigned to a slot, other group options in the entry modal become disabled, locked, and unclickable (`pointer-events-none`) to prevent accidental group swapping.
- **Distinctive Group Tags (Option A):**
  - **Group 1:** Teal theme (`bg-teal-50 text-teal-800 border-teal-300`) with a teal indicator dot (`bg-teal-500`).
  - **Group 2:** Amber theme (`bg-amber-50 text-amber-900 border-amber-300`) with an amber indicator dot (`bg-amber-500`).
  - **Group 3 & 4+:** Dedicated Purple and Rose themes with cyclic palette fallback for custom groups.
  - Applied consistently across grid entry cards, modal group selectors, and settings panels.

## 6. Multi-Faculty Support (Many-to-Many)

### Database Architecture
- **Association Table:** `TimetableEntry` now stores faculty via a many-to-many relationship using a `timetable_entry_faculty` join table, replacing the previous single `faculty_id` column.
- **Cascade Deletes:** Deleting a faculty member automatically clears their association from all timetable entries without orphaning records.

### Backend Validation
- **Cross-Batch Conflict Detection:** Faculty double-booking is detected across **all** batches at the same slot — including parallel groups running simultaneously in different batches.
- **Theory Limit Enforced:** Theory subjects are restricted to exactly **1** assigned faculty. The API returns a `422` error if more are provided.
- **Duplicate & Empty Guards:** The `faculty_ids` list is validated to contain at least one entry and must not include duplicate IDs.
- **Blank Name Guard:** Batch group names are trimmed and rejected if they are blank or whitespace-only.

### Frontend — Lab Faculty Template
When adding or editing a **Lab** entry, the Faculty section displays three structured groups:

| Section | Dropdowns | Filter |
|---|---|---|
| 🟣 **Professors** | 2 (fixed) | Only faculty with role `professor` |
| 🟡 **Teaching Assistants** | 2 (fixed) | Only faculty with role `teaching_assistant` |
| ⚪ **Additional Faculty** | 0+ (expandable) | Any role |

- The **"Add more faculty"** button appends additional optional slots one at a time.
- All slots are individually optional — no single slot is required to be filled.
- At least one faculty across all slots must be selected before saving.
- When editing an entry that previously had more than 4 faculties, the extra slots are automatically shown.

## 7. Subject Hours/Week Semantics & Safe Updates
- **Per-Group Lab Quota vs. Global Theory Quota:** Lab `hours_per_week` governs the weekly schedule budget for *each individual lab group* (e.g., a 2-hour lab gives 2 scheduled hours to Group 1 and 2 scheduled hours to Group 2). Theory `hours_per_week` governs the total weekly periods across the entire batch.
- **Subject Edit Integrity & Safety Guards:**
  - `PATCH /api/subjects/{id}` strictly rejects reducing `hours_per_week` below the count of already scheduled periods (per-group for labs, total for theory) with HTTP 400 and an informative error message.
  - Modifying a subject's type (`lab` ↔ `theory`) is blocked with HTTP 400 when timetable entries exist for the subject.
  - Reassigning a subject to another batch is blocked with HTTP 400 when entries exist for the subject.
- **Payload Resiliency & Error Reporting:**
  - `BatchesPage.tsx` strips `batch_id` prior to dispatching subject updates, avoiding Pydantic `extra="forbid"` rejections.
  - `SubjectUpdate` schema in `backend/app/schemas.py` accepts optional `batch_id` to maintain client compatibility.
  - `BatchesPage.tsx` extracts human-readable validation error messages instead of displaying `[object Object]` toast errors.

### Timetable Grid
- Entry cards on the grid now render a stacked list of all assigned faculty members, each displaying their role badge (Prof. / TA) alongside their name.

## Manual Verification
- Verified that scheduling a 2-hour lab accurately consumes 2 consecutive slots.
- Verified that attempting to schedule a lab in a room that is booked on the 2nd hour results in an all-or-nothing rollback and surfaces the exact error message.
- Verified that `TimetableGrid` renders correctly with stable `rowSpans` even during network latency (using shimmer loading placeholders).
- Verified that the Professor dropdowns only show `professor`-role faculty and the TA dropdowns only show `teaching_assistant`-role faculty.
- Verified that assigning a faculty member to two entries at the same time slot in any batch (including parallel groups) triggers a hard conflict.
- Verified that back-to-back classes for the same faculty across different subjects in the same batch trigger a soft warning with override support.
- Verified that lab group slots lock other groups once assigned.
- Verified atomic all-or-nothing rollback on both bulk creation and bulk session editing.
- All 34 backend pytest tests pass.
