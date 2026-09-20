# PDF (and CSV) Export — Full Engineering Log

This document records every approach tried, why each one failed, what was learned, and the final solution that works. Written as a post-mortem so future contributors don't repeat the same mistakes.

---

## Feature Goal

Add a **Download** button to the Weekly Timetable page that lets the user export the timetable as:
- A **CSV** file (structured, one row per day, one column per period)
- A **PDF** file (visual, coloured, matching the on-screen layout as closely as possible)

---

## Scope of Changes

| File | Change |
|---|---|
| `frontend/src/hooks/useTimetableDownload.ts` | New hook — all export logic lives here |
| `frontend/src/pages/TimetablePage.tsx` | Download button + dropdown added to header |
| `frontend/src/components/TimetableGrid.tsx` | Converted to `forwardRef` so a ref could be passed in for PDF capture (later abandoned for PDF, kept for potential future use) |
| `backend/app/database.py` | Fixed Turso connection pool panic (separate but discovered during this work) |

---

## Attempt 1 — `html2canvas` on the live DOM element

### What we tried
Captured the `TimetableGrid` outer `<div>` using `html2canvas`, fitted the resulting image onto a landscape A4 `jsPDF` page.

```ts
const canvas = await html2canvas(el, { scale: 2, useCORS: true });
const imgData = canvas.toDataURL('image/png');
pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
```

### What happened
- **Horizontal clipping**: only the visible portion of the timetable (what fits in the viewport) was captured. The right-hand slots were cut off.
- **Vertical clipping**: cell content inside each row was also cut off mid-card.

### Why it failed
`html2canvas` reads `el.offsetWidth` and `el.offsetHeight` to size the canvas. The grid wrapper has `overflow-x: auto`, so `offsetWidth` equals the viewport width, not the full table width. The scroll container hides the rest — `html2canvas` never sees it.

---

## Attempt 2 — Mutating the live element's styles before capture

### What we tried
Before calling `html2canvas`, we set `overflow: visible`, pinned `width` to `el.scrollWidth`, `height` to `el.scrollHeight`, and passed those same values as `width`/`height`/`windowWidth`/`windowHeight` to `html2canvas`. Restored styles after.

```ts
el.style.overflow = 'visible';
el.style.width = `${el.scrollWidth}px`;
el.style.height = `${el.scrollHeight}px`;
// ...
el.offsetHeight; // force reflow
const canvas = await html2canvas(el, { width: fullW, height: fullH, ... });
```

### What happened
- Horizontal clipping was partially fixed — more columns appeared.
- Vertical clipping persisted — row heights were still wrong, cards still cut off.

### Why it failed
The browser had already computed and committed `<tr>` row heights at the original scroll-constrained layout. Changing the container's `overflow` and `width` after the fact does not trigger a re-layout of the table's internal row heights — those are locked in from the initial render. `html2canvas` captured the pixels at those already-committed dimensions.

Additionally, `scrollTop`/`scrollLeft` resetting helped but did not fix the core layout issue.

---

## Attempt 3 — Deep-cloning the element into an off-screen wrapper

### What we tried
Instead of mutating the live element, we cloned the entire grid DOM subtree into a hidden off-screen `position: fixed` container with no size constraints, waited two animation frames for the browser to do a fresh layout, then captured the clone.

```ts
const clone = el.cloneNode(true) as HTMLElement;
clone.style.overflow = 'visible';
clone.style.width = 'max-content';
clone.style.height = 'auto';
// remove sticky positioning from cells
clone.querySelectorAll('[class*="sticky"]').forEach(el => el.style.position = 'relative');
wrapper.appendChild(clone);
document.body.appendChild(wrapper);
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const canvas = await html2canvas(clone, { width: clone.scrollWidth, height: clone.scrollHeight });
document.body.removeChild(wrapper);
```

### What happened
Still cut off. The clone appeared correct in the DOM inspector but `html2canvas` still captured partial content.

### Why it failed
HTML `<table>` layout is one of the most complex layout algorithms in the browser. Even in an unconstrained clone, `html2canvas` relies on the browser's computed styles — specifically `getComputedStyle` on each element. The cloned elements inherit their computed `height` from the stylesheet (which was calculated for the original scroll context), not from fresh layout. The `<tr>` heights are driven by the original element's constraint, not re-computed for the clone.

Additionally, `html2canvas` has known limitations with `position: sticky`, `overflow`, and table layout edge cases.

**Root conclusion: `html2canvas` is fundamentally unreliable for complex, scrollable, table-based layouts.** It works well for simple, fully-visible, fixed-size DOM snapshots. It is not suitable for timetables.

---

## Attempt 4 (Final) — Build the PDF programmatically from data using jsPDF

### What we tried
Abandoned DOM capture entirely. Instead of taking a screenshot, we draw the PDF directly from the in-memory `TimetableEntry[]`, `TimeSlot[]`, and `DayOfWeek[]` data using `jsPDF`'s drawing API — rectangles, text, lines.

### How it works

```
buildPdf(entries, slots, activeDays, label)
  ↓
  1. Build a lookup Map<"day:slotId", TimetableEntry[]>
  2. Compute page layout:
     - PAGE_W from jsPDF (landscape A3)
     - regularColW = (PAGE_W - margins - dayCol - breakCols) / regularSlotCount
  3. Pre-compute row heights:
     - Each row height = max cell content height across all slots in that row
     - content height = entries × (5 lines × lineHeight + padding) + gaps
  4. Draw title text
  5. Draw column header row (slot labels + time ranges)
  6. For each active day:
     a. Draw alternating row background
     b. Draw day label
     c. For each slot:
        - If break: amber fill
        - If regular: look up entries, draw each as a rounded coloured card with:
          subject short_code (bold, subject colour)
          subject full name
          batch pill (coloured rounded rect)
          faculty name with role badge
          room name
  7. Draw outer border and vertical column dividers
  8. Return pdf.output('blob')
```

### Why this works
- **No DOM dependency** — the data is already fetched and in memory in `TimetablePage`. The PDF is built from the same source of truth that drives the UI.
- **No size constraints** — jsPDF draws on a virtual page of any size. We use landscape A3 so even wide timetables with many periods fit.
- **Column widths are computed dynamically** — they always fill the page regardless of how many periods exist.
- **Row heights auto-size** — pre-computed from entry count before drawing begins, so nothing is ever clipped.
- **No browser layout involved** — pure maths and drawing calls.

### Key jsPDF API notes (v4.x)

```ts
// Import (lazy, only loads when user clicks Download PDF)
const { jsPDF } = await import('jspdf');

// Create landscape A3
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

// Drawing
pdf.setFillColor(r, g, b);
pdf.rect(x, y, w, h, 'F');            // filled rect
pdf.roundedRect(x, y, w, h, rx, ry, 'FD'); // filled + stroked rounded rect
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(8);
pdf.setTextColor(r, g, b);
pdf.text('string', x, y, { align: 'center', maxWidth: w });
pdf.line(x1, y1, x2, y2);

// Output
const blob = pdf.output('blob');  // returns a real Blob in v4
```

### Colour utilities

```ts
// Convert hex colour to [r, g, b]
function hexToRgb(hex): [number, number, number]

// Alpha-blend a hex colour over white background
// Used to replicate the UI's hexAlpha() for backgrounds and borders
function hexAlphaMix(hex, alpha): [number, number, number]
```

---

## CSV Export

CSV was straightforward and worked on the first attempt. No `html2canvas` involved.

- Builds a `Map<"day:slotId", TimetableEntry[]>` lookup
- Iterates `activeDays × regularSlots`, writes one row per day
- Each cell: `"SUBJECT | BATCH (GROUP) | FACULTY | ROOM"`, multiple entries joined with ` / `
- All values RFC-4180 escaped (quotes doubled)
- Output: `text/csv;charset=utf-8;` Blob, triggers browser download

---

## Backend Fix — Turso Connection Pool Panic

Discovered during this work: the backend was intermittently returning **500 Internal Server Error** on `/api/batches`, which caused the timetable to show no data (React Query cached the empty response).

### Root cause

```
pyo3_runtime.PanicException: called `Option::unwrap()` on a `None` value
```

SQLAlchemy's default connection pool (`QueuePool`) keeps connections alive and reuses them across requests. The `libsql-experimental` driver creates a WebSocket connection to Turso when `libsql.connect()` is called. After a period of inactivity, Turso closes that WebSocket. When SQLAlchemy later tries to reuse the pooled connection (which is now dead), it calls `.cursor()` on the closed connection — the Rust driver inside `libsql-experimental` tries to `unwrap()` an `Option` that is `None` (the connection handle) and panics.

### Fix

```python
# database.py
from sqlalchemy.pool import NullPool

engine = create_engine(
    "sqlite://",
    creator=_creator,
    poolclass=NullPool,   # ← this line
    connect_args={"check_same_thread": False},
)
```

`NullPool` disables connection reuse entirely — every request opens a fresh connection and closes it when done. This is slightly more overhead per request, but Turso connections are cheap (WebSocket handshake is fast) and it completely eliminates the stale-connection panic.

---

## Dependency Notes

| Package | Version | Purpose | Still used? |
|---|---|---|---|
| `html2canvas` | `^1.4.1` | DOM screenshot for PDF | No — kept in `package.json` but not imported |
| `jspdf` | `^4.2.1` | PDF generation | Yes — lazy-imported in `useTimetableDownload.ts` |

`html2canvas` can be removed from `package.json` if desired — it is no longer imported anywhere.

---

## Lessons Learned

1. **`html2canvas` is not suitable for scrollable table layouts.** It cannot re-layout a table that was originally rendered inside a scroll container. `scrollWidth`/`scrollHeight` manipulation does not force a re-layout of `<tr>` heights.

2. **Cloning elements does not give you a fresh layout.** `getComputedStyle` on a cloned element returns the styles computed for the original. The browser does not re-run the table layout algorithm just because you moved the clone somewhere else.

3. **For complex, data-driven documents, generate the PDF from data — not from screenshots.** It is more code upfront but completely reliable, infinitely scalable, and produces crisp vector output rather than a blurry rasterised screenshot.

4. **SQLAlchemy's connection pool is incompatible with `libsql-experimental`.** Always use `NullPool` (or set `pool_pre_ping=True` as a weaker mitigation) when using `libsql-experimental` as the DBAPI driver.

5. **jsPDF v4 uses named ESM export `{ jsPDF }`.** Dynamic `import('jspdf')` gives `{ jsPDF }` — not a default export. The `output('blob')` method returns a real `Blob` in v4 (unlike older versions where it returned a string).
