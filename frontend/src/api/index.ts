import { apiClient } from './client';
import type {
  ActiveDaysOut,
  Batch, BatchCreate, BatchUpdate,
  DayOfWeek,
  EntryCreate, EntryCreateResponse, EntryUpdate,
  FacultyCreate, FacultyMember, FacultyUpdate,
  Subject, SubjectCreate, SubjectUpdate,
  TimeSlot, TimeSlotCreate, TimeSlotUpdate,
  TimetableEntry,
  Token, User,
} from '../types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  apiClient.post<Token>('/auth/login', { username, password }).then((r) => r.data);

export const getMe = () =>
  apiClient.get<User>('/auth/me').then((r) => r.data);

// ── Batches ───────────────────────────────────────────────────────────────────
export const getBatches = () =>
  apiClient.get<Batch[]>('/batches').then((r) => r.data);

export const createBatch = (data: BatchCreate) =>
  apiClient.post<Batch>('/batches', data).then((r) => r.data);

export const updateBatch = (id: number, data: BatchUpdate) =>
  apiClient.patch<Batch>(`/batches/${id}`, data).then((r) => r.data);

export const deleteBatch = (id: number) =>
  apiClient.delete(`/batches/${id}`);

// ── Subjects ──────────────────────────────────────────────────────────────────
export const getSubjects = () =>
  apiClient.get<Subject[]>('/subjects').then((r) => r.data);

export const createSubject = (data: SubjectCreate) =>
  apiClient.post<Subject>('/subjects', data).then((r) => r.data);

export const updateSubject = (id: number, data: SubjectUpdate) =>
  apiClient.patch<Subject>(`/subjects/${id}`, data).then((r) => r.data);

export const deleteSubject = (id: number) =>
  apiClient.delete(`/subjects/${id}`);

// ── Faculty ───────────────────────────────────────────────────────────────────
export const getFaculty = () =>
  apiClient.get<FacultyMember[]>('/faculty').then((r) => r.data);

export const createFaculty = (data: FacultyCreate) =>
  apiClient.post<FacultyMember>('/faculty', data).then((r) => r.data);

export const updateFaculty = (id: number, data: FacultyUpdate) =>
  apiClient.patch<FacultyMember>(`/faculty/${id}`, data).then((r) => r.data);

export const deleteFaculty = (id: number) =>
  apiClient.delete(`/faculty/${id}`);

// ── Time Slots ────────────────────────────────────────────────────────────────
export const getTimeSlots = () =>
  apiClient.get<TimeSlot[]>('/time-slots').then((r) => r.data);

export const createTimeSlot = (data: TimeSlotCreate) =>
  apiClient.post<TimeSlot>('/time-slots', data).then((r) => r.data);

export const updateTimeSlot = (id: number, data: TimeSlotUpdate) =>
  apiClient.patch<TimeSlot>(`/time-slots/${id}`, data).then((r) => r.data);

export const deleteTimeSlot = (id: number) =>
  apiClient.delete(`/time-slots/${id}`);

// ── Timetable Entries ─────────────────────────────────────────────────────────
export const getEntries = (params?: { batch_id?: number; day?: DayOfWeek }) =>
  apiClient.get<TimetableEntry[]>('/timetable/entries', { params }).then((r) => r.data);

export const createEntry = (data: EntryCreate, force = false) =>
  apiClient
    .post<EntryCreateResponse>(`/timetable/entries?force=${force}`, data)
    .then((r) => r.data);

export const updateEntry = (id: number, data: EntryUpdate, force = false) =>
  apiClient
    .put<EntryCreateResponse>(`/timetable/entries/${id}?force=${force}`, data)
    .then((r) => r.data);

export const deleteEntry = (id: number) =>
  apiClient.delete(`/timetable/entries/${id}`);

// ── Active Days ───────────────────────────────────────────────────────────────
export const getActiveDays = () =>
  apiClient.get<ActiveDaysOut>('/timetable/active-days').then((r) => r.data);

export const setActiveDays = (active_days: DayOfWeek[]) =>
  apiClient.put<ActiveDaysOut>('/timetable/active-days', { active_days }).then((r) => r.data);
