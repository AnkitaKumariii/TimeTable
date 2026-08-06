// ── Colour utilities ──────────────────────────────────────────────────────────

/** Darken a hex colour by a percentage (0–1). */
export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Add alpha to a hex colour. */
export function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = n >> 16;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Determine if a colour is light (for text contrast decisions). */
export function isLightColor(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = n >> 16;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
}

// ── Time formatting ───────────────────────────────────────────────────────────

/** Format HH:MM:SS → "9:00 AM" */
export function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Format slot start–end times */
export function fmtSlotRange(start: string, end: string): string {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#a855f7', '#84cc16',
];

export const ALL_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Axis label index for a day. */
export function dayIndex(day: string): number {
  return ALL_DAYS.indexOf(day as typeof ALL_DAYS[number]);
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
