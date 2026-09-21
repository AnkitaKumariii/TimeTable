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
- **Intelligent Warnings:** Minor warnings (like a faculty member teaching back-to-back classes in different batches) are intentionally bypassed during lab auto-fill, as consecutive lab hours are expected behavior.

## Manual Verification
- Verified that scheduling a 2-hour lab accurately consumes 2 consecutive slots.
- Verified that attempting to schedule a lab in a room that is booked on the 2nd hour results in an all-or-nothing rollback and surfaces the exact error message.
- Verified that `TimetableGrid` renders correctly with stable `rowSpans` even during network latency (using shimmer loading placeholders).
