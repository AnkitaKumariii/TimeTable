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
- **Bulk API Endpoint:** Introduced a new backend endpoint at `POST /api/timetable/entries/bulk` that accepts multiple entry payloads.
- **Atomic Transactions:** The bulk endpoint validates all consecutive slots inside a single database transaction. If *any* of the automated slots hits a hard conflict (such as a room being occupied or a faculty member double-booked), the entire transaction is rolled back, and the UI displays the exact backend error message indicating the conflict reason.
- **Intelligent Warnings:** Minor adjacency warnings (like a faculty member teaching back-to-back classes) apply only when the neighboring class belongs to a *different* batch; consecutive lab hours for the same batch do not trigger them. Any warning encountered during bulk creation causes the transaction to roll back and is presented to the user for confirmation before allowing a forced save.

## 4. Multi-Faculty Support (Many-to-Many)

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

### Timetable Grid
- Entry cards on the grid now render a stacked list of all assigned faculty members, each displaying their role badge (Prof. / TA) alongside their name.

## Manual Verification
- Verified that scheduling a 2-hour lab accurately consumes 2 consecutive slots.
- Verified that attempting to schedule a lab in a room that is booked on the 2nd hour results in an all-or-nothing rollback and surfaces the exact error message.
- Verified that `TimetableGrid` renders correctly with stable `rowSpans` even during network latency (using shimmer loading placeholders).
- Verified that the Professor dropdowns only show `professor`-role faculty and the TA dropdowns only show `teaching_assistant`-role faculty.
- Verified that assigning a faculty member to two entries at the same time slot in any batch (including parallel groups) triggers a hard conflict.
- All 23 backend pytest tests pass.
