import type { RefObject } from 'react';
import type { Batch, DayOfWeek, TimeSlot, TimetableEntry } from '../types';
import { fmtSlotRange } from '../lib/utils';

interface DownloadOptions {
  entries: TimetableEntry[];
  slots: TimeSlot[];
  activeDays: DayOfWeek[];
  batches: Batch[];
  filterBatchId: number | null;
  gridRef: RefObject<HTMLDivElement | null>;
  /** Label used in the filename, e.g. "All Batches" or "CSE-A" */
  label: string;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function buildCsv(
  entries: TimetableEntry[],
  slots: TimeSlot[],
  activeDays: DayOfWeek[],
): string {
  const sortedSlots = [...slots]
    .filter((s) => !s.is_break)
    .sort((a, b) => a.sort_order - b.sort_order);

  const lookup = new Map<string, TimetableEntry[]>();
  for (const e of entries) {
    const key = `${e.day}:${e.time_slot_id}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(e);
  }

  const escape = (v: string) => {
    let sanitized = v;
    if (/^[=+\-@\t\r\n]/.test(sanitized)) {
      sanitized = "'" + sanitized;
    }
    return `"${sanitized.replace(/"/g, '""')}"`;
  };

  const headers = [
    'Day',
    ...sortedSlots.map((s) => escape(`${s.label} (${fmtSlotRange(s.start_time, s.end_time)})`)),
  ].join(',');

  const rows = activeDays.map((day) => {
    const cells = sortedSlots.map((slot) => {
      const cell = lookup.get(`${day}:${slot.id}`) ?? [];
      if (cell.length === 0) return '""';
      const text = cell
        .map((e) => {
          const group = e.group ? ` (${e.group.name})` : '';
          const facultyNames = e.faculties.map(f => f.name).join(', ');
          return `${e.subject.short_code} | ${e.batch.name}${group} | ${facultyNames} | ${e.room?.name ?? 'Unassigned'}`;
        })
        .join(' / ');
      return escape(text);
    });
    return [escape(day), ...cells].join(',');
  });

  return [headers, ...rows].join('\r\n');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexAlphaMix(hex: string, alpha: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  // blend over white
  return [
    Math.round(255 + (r - 255) * alpha),
    Math.round(255 + (g - 255) * alpha),
    Math.round(255 + (b - 255) * alpha),
  ];
}

// ── PDF drawing from data ─────────────────────────────────────────────────────

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildPdf(
  entries: TimetableEntry[],
  slots: TimeSlot[],
  activeDays: DayOfWeek[],
  label: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  let fontName = 'helvetica';

  try {
    const [reg, bold] = await Promise.all([
      fetchFontBase64('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf'),
      fetchFontBase64('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf')
    ]);
    pdf.addFileToVFS('Roboto-Regular.ttf', reg);
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    pdf.addFileToVFS('Roboto-Bold.ttf', bold);
    pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    fontName = 'Roboto';
  } catch (err) {
    console.warn('Failed to load Unicode fonts, falling back to built-in fonts', err);
  }

  // Guard: nothing to draw
  if (slots.length === 0 || activeDays.length === 0) {
    pdf.setFont(fontName, 'normal');
    pdf.text('No timetable data.', 20, 20);
    return pdf.output('blob') as unknown as Blob;
  }

  const sortedSlots = [...slots].sort((a, b) => a.sort_order - b.sort_order);
  const regularSlots = sortedSlots.filter((s) => !s.is_break);

  // Build lookup
  const lookup = new Map<string, TimetableEntry[]>();
  for (const e of entries) {
    const key = `${e.day}:${e.time_slot_id}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(e);
  }
  console.debug('[PDF] entries:', entries.length, 'slots:', slots.length, 'days:', activeDays, 'lookup keys:', [...lookup.keys()]);

  // ── Layout constants (mm) ────────────────────────────────────────────────
  const MARGIN = 10;
  const HEADER_ROW_H = 14;   // column header row height
  const DAY_COL_W = 22;      // "Day" column width
  const BREAK_COL_W = 6;     // break slot column width
  const CELL_PAD = 2;        // inner padding
  const ENTRY_LINE_H = 4;    // line height inside an entry block
  const ENTRY_PAD = 2;       // vertical padding inside entry block
  const ENTRY_GAP = 1.5;     // gap between stacked entries
  const MIN_ROW_H = 20;      // minimum row height

  // ── Page setup ──────────────────────────────────────────────────────────
  const PAGE_W = pdf.internal.pageSize.getWidth();

  // Distribute column widths to fill the page
  const breakCount = sortedSlots.filter((s) => s.is_break).length;
  const regularCount = regularSlots.length;
  const totalBreakW = breakCount * BREAK_COL_W;
  const regularColW = (PAGE_W - 2 * MARGIN - DAY_COL_W - totalBreakW) / regularCount;

  function colX(slotIndex: number): number {
    let x = MARGIN + DAY_COL_W;
    for (let i = 0; i < slotIndex; i++) {
      x += sortedSlots[i].is_break ? BREAK_COL_W : regularColW;
    }
    return x;
  }

  function colW(slot: TimeSlot): number {
    return slot.is_break ? BREAK_COL_W : regularColW;
  }

  // ── Pre-compute row heights and paginate oversized rows ─────────────────
  const oneEntryH = ENTRY_PAD * 2 + 5 * ENTRY_LINE_H; // 24
  const cardTotalH = oneEntryH + ENTRY_GAP;

  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MAX_USABLE_H = PAGE_H - (MARGIN * 2 + HEADER_ROW_H + 10);
  const MAX_ENTRIES_PER_ROW = Math.max(1, Math.floor((MAX_USABLE_H - CELL_PAD * 2) / cardTotalH));

  interface SubRow {
    dayLabel: string;
    cells: TimetableEntry[][];
    rowH: number;
    originalRowIdx: number;
  }
  const displayRows: SubRow[] = [];

  for (let rowIdx = 0; rowIdx < activeDays.length; rowIdx++) {
    const day = activeDays[rowIdx];
    const dayCells = sortedSlots.map(slot => slot.is_break ? [] : (lookup.get(`${day}:${slot.id}`) ?? []));
    
    let maxLen = Math.max(0, ...dayCells.map(c => c.length));
    if (maxLen === 0) {
      displayRows.push({ dayLabel: day, cells: dayCells, rowH: MIN_ROW_H, originalRowIdx: rowIdx });
      continue;
    }

    let startIndex = 0;
    let isFirstSlice = true;
    while (startIndex < maxLen) {
      const sliceCells = dayCells.map(c => c.slice(startIndex, startIndex + MAX_ENTRIES_PER_ROW));
      const sliceMaxLen = Math.max(0, ...sliceCells.map(c => c.length));
      
      let rH = MIN_ROW_H;
      if (sliceMaxLen > 0) {
        rH = CELL_PAD * 2 + sliceMaxLen * oneEntryH + (sliceMaxLen - 1) * ENTRY_GAP;
      }
      
      displayRows.push({
        dayLabel: isFirstSlice ? day : `${day} (cont.)`,
        cells: sliceCells,
        rowH: Math.max(MIN_ROW_H, rH),
        originalRowIdx: rowIdx
      });
      
      startIndex += MAX_ENTRIES_PER_ROW;
      isFirstSlice = false;
    }
  }

  // ── Drawing Helpers ───────────────────────────────────────────────────────
  let curY = MARGIN;
  let pageStartY = MARGIN;

  function drawPageBorders(startY: number, endY: number) {
    // Outer border
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.4);
    const tableH = endY - startY;
    pdf.rect(MARGIN, startY, PAGE_W - 2 * MARGIN, tableH);

    // Vertical column dividers
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(226, 232, 240);
    // Day col divider
    pdf.line(MARGIN + DAY_COL_W, startY, MARGIN + DAY_COL_W, endY);
    // Slot dividers
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const x = colX(i + 1);
      pdf.line(x, startY, x, endY);
    }
  }

  function drawHeader() {
    curY = MARGIN;
    // Draw title
    pdf.setFont(fontName, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Weekly Timetable — ${label}`, MARGIN, curY + 5);
    curY += 10;
    
    pageStartY = curY; // Start of table borders

    // Draw column headers background
    pdf.setFillColor(241, 245, 249);
    pdf.rect(MARGIN, curY, PAGE_W - 2 * MARGIN, HEADER_ROW_H, 'F');

    // "Day / Period" corner
    pdf.setFont(fontName, 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('DAY / PERIOD', MARGIN + CELL_PAD, curY + HEADER_ROW_H / 2 + 2);

    // Slot headers
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const x = colX(i);
      const w = colW(slot);

      if (slot.is_break) {
        pdf.setFillColor(254, 243, 199);
        pdf.rect(x, curY, w, HEADER_ROW_H, 'F');
        continue;
      }

      pdf.setFont(fontName, 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(71, 85, 105);
      const labelText = slot.label.toUpperCase();
      const timeText = fmtSlotRange(slot.start_time, slot.end_time);
      pdf.text(labelText, x + w / 2, curY + 4.5, { align: 'center', maxWidth: w - 2 });
      pdf.setFont(fontName, 'normal');
      pdf.setFontSize(5.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(timeText, x + w / 2, curY + 9.5, { align: 'center', maxWidth: w - 2 });
    }

    // Header bottom border
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, curY + HEADER_ROW_H, PAGE_W - MARGIN, curY + HEADER_ROW_H);
    curY += HEADER_ROW_H;
  }

  // ── Draw document ─────────────────────────────────────────────────────────
  drawHeader();

  for (let idx = 0; idx < displayRows.length; idx++) {
    const row = displayRows[idx];
    const rowH = row.rowH;

    // Page break logic
    if (curY + rowH > PAGE_H - MARGIN) {
      drawPageBorders(pageStartY, curY);
      pdf.addPage();
      drawHeader();
    }

    // Row background (alternating by original row index to keep shading consistent across splits)
    if (row.originalRowIdx % 2 !== 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, curY, PAGE_W - 2 * MARGIN, rowH, 'F');
    }

    // Day label cell
    pdf.setFont(fontName, 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text(row.dayLabel, MARGIN + CELL_PAD, curY + rowH / 2 + 2.5);

    // Slot cells
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const x = colX(i);
      const w = colW(slot);

      if (slot.is_break) {
        pdf.setFillColor(254, 243, 199);
        pdf.rect(x, curY, w, rowH, 'F');
        continue;
      }

      const cellEntries = row.cells[i];
      let entryY = curY + CELL_PAD;

      for (const entry of cellEntries) {
        const oneEntryH = ENTRY_PAD * 2 + 5 * ENTRY_LINE_H;
        const [bgR, bgG, bgB] = hexAlphaMix(entry.subject.color, 0.15);
        const [borderR, borderG, borderB] = hexAlphaMix(entry.subject.color, 0.5);
        const [textR, textG, textB] = hexToRgb(entry.subject.color);

        // Card background + border
        pdf.setFillColor(bgR, bgG, bgB);
        pdf.setDrawColor(borderR, borderG, borderB);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(x + 1, entryY, w - 2, oneEntryH, 1, 1, 'FD');

        const tx = x + 2.5;
        const lineY = (n: number) => entryY + ENTRY_PAD + n * ENTRY_LINE_H + 2.5;

        // Short code
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(6);
        pdf.setTextColor(textR, textG, textB);
        pdf.text(entry.subject.short_code, tx, lineY(0), { maxWidth: w - 4 });

        // Subject name
        pdf.setFont(fontName, 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(entry.subject.name, tx, lineY(1), { maxWidth: w - 4 });

        // Batch pill (draw as small rect)
        const [batchBgR, batchBgG, batchBgB] = hexAlphaMix(entry.batch.color, 0.25);
        const [batchTR, batchTG, batchTB] = hexToRgb(entry.batch.color);
        const batchLabel = entry.batch.name + (entry.group ? ` (${entry.group.name})` : '');
        pdf.setFillColor(batchBgR, batchBgG, batchBgB);
        pdf.setDrawColor(batchBgR, batchBgG, batchBgB);
        pdf.roundedRect(tx, lineY(2) - 2.5, Math.min(batchLabel.length * 1.7 + 2, w - 5), 3.5, 0.8, 0.8, 'F');
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(5);
        pdf.setTextColor(batchTR, batchTG, batchTB);
        pdf.text(batchLabel, tx + 1, lineY(2), { maxWidth: w - 6 });

        // Faculty
        // Just show the primary role if there are multiple
        const primaryFaculty = entry.faculties[0];
        const roleLabel = primaryFaculty?.role === 'teaching_assistant' ? 'TA' : 'Prof.';
        const facultyNames = entry.faculties.map(f => f.name).join(', ');
        
        pdf.setFont(fontName, 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${roleLabel} ${facultyNames}`, tx, lineY(3), { maxWidth: w - 4 });

        // Room
        pdf.setTextColor(100, 116, 139);
        pdf.text(entry.room?.name ?? 'Unassigned', tx, lineY(4), { maxWidth: w - 4 });

        entryY += oneEntryH + ENTRY_GAP;
      }
    }

    // Row bottom border
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, curY + rowH, PAGE_W - MARGIN, curY + rowH);

    curY += rowH;
  }

  // Draw final borders for the last page
  drawPageBorders(pageStartY, curY);

  console.debug('[PDF] done drawing. PAGE_W=%s regularColW=%s curY=%s', PAGE_W, regularColW, curY);

  // jsPDF v4: output('blob') returns a Blob
  const blob = pdf.output('blob') as unknown as Blob;
  console.debug('[PDF] blob size=%s', (blob as Blob).size);
  return blob;
}

// ── Public hook ───────────────────────────────────────────────────────────────

export function useTimetableDownload(opts: DownloadOptions) {
  const { entries, slots, activeDays, label } = opts;
  const slug = sanitizeFilename(label);

  async function downloadCsv() {
    const csv = buildCsv(entries, slots, activeDays);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `timetable_${slug}.csv`);
  }

  async function downloadPdf() {
    try {
      const blob = await buildPdf(entries, slots, activeDays, label);
      triggerDownload(blob, `timetable_${slug}.pdf`);
    } catch (err) {
      console.error('[PDF export] buildPdf failed:', err);
      throw err;
    }
  }

  return { downloadCsv, downloadPdf };
}
