// ── Hand-crafted types mirroring the FastAPI OpenAPI schema ──────────────────

export type UserRole = 'admin' | 'faculty';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type ConflictStatus = 'ok' | 'conflict' | 'warning';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Batch {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
}

export interface Subject {
  id: number;
  batch_id: number;
  name: string;
  short_code: string;
  color: string;
}

export type FacultyRole = 'professor' | 'teaching_assistant';

export interface FacultyMember {
  id: number;
  name: string;
  email?: string | null;
  role: FacultyRole;
}

export interface TimeSlot {
  id: number;
  label: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  sort_order: number;
  is_break: boolean;
}

export interface TimetableEntry {
  id: number;
  batch_id: number;
  subject_id: number;
  faculty_id: number;
  day: DayOfWeek;
  time_slot_id: number;
  version: number;
  created_at: string;
  updated_at: string;
  batch: Batch;
  subject: Subject;
  faculty: FacultyMember;
  time_slot: TimeSlot;
}

export interface ConflictingEntry {
  batch: string;
  subject: string;
  time_slot: string;
  day: string;
}

export interface EntryCheckResponse {
  status: ConflictStatus;
  message: string;
  conflicting_entry?: ConflictingEntry | null;
}

export interface EntryCreateResponse {
  status: 'ok' | 'warning';
  entry: TimetableEntry;
  message: string;
  conflicting_entry?: ConflictingEntry | null;
}

export interface ActiveDaysOut {
  active_days: DayOfWeek[];
}

// ── Form payloads ─────────────────────────────────────────────────────────────

export interface BatchCreate { name: string; color: string; is_active?: boolean }
export interface BatchUpdate { name?: string; color?: string; is_active?: boolean }
export interface SubjectCreate { batch_id: number; name: string; short_code: string; color: string }
export interface SubjectUpdate { name?: string; short_code?: string; color?: string }
export interface FacultyCreate { name: string; email?: string; role?: FacultyRole }
export interface FacultyUpdate { name?: string; email?: string; role?: FacultyRole }
export interface TimeSlotCreate { label: string; start_time: string; end_time: string; sort_order: number; is_break?: boolean }
export interface TimeSlotUpdate { label?: string; start_time?: string; end_time?: string; sort_order?: number; is_break?: boolean }
export interface EntryCreate { batch_id: number; subject_id: number; faculty_id: number; day: DayOfWeek; time_slot_id: number }
export interface EntryUpdate { batch_id?: number; subject_id?: number; faculty_id?: number; day?: DayOfWeek; time_slot_id?: number; version: number }
