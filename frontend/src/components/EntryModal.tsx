import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

import {
  createBatch, createEntry, createFaculty, createSubject,
  deleteEntry, getBatches, getFaculty, getSubjects, getTimeSlots,
  updateEntry,
} from '../api';
import type {
  Batch, ConflictingEntry, DayOfWeek, FacultyMember,
  Subject, TimetableEntry,
} from '../types';
import { Combobox } from './Combobox';
import { HardConflictAlert, SoftWarningAlert } from './ConflictNotification';
import { fmtSlotRange } from '../lib/utils';

// Inline quick-create mini-form
interface QuickCreateProps {
  type: 'batch' | 'subject' | 'faculty';
  initialName: string;
  batchId?: number;
  onCreated: (id: number) => void;
  onCancel: () => void;
}

function QuickCreate({ type, initialName, batchId, onCreated, onCancel }: QuickCreateProps) {
  const [name, setName] = useState(initialName);
  const [shortCode, setShortCode] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleCreate() {
    setLoading(true);
    try {
      let created: Batch | Subject | FacultyMember;
      if (type === 'batch') {
        created = await createBatch({ name, color });
        qc.invalidateQueries({ queryKey: ['batches'] });
      } else if (type === 'subject') {
        if (!batchId) throw new Error("Batch required");
        created = await createSubject({ batch_id: batchId, name, short_code: shortCode || name.slice(0, 6).toUpperCase(), color });
        qc.invalidateQueries({ queryKey: ['subjects'] });
      } else {
        created = await createFaculty({ name });
        qc.invalidateQueries({ queryKey: ['faculty'] });
      }
      onCreated(created.id);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Failed to create';
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1 p-3 rounded-lg bg-white border border-brand-500/40 animate-slide-up">
      <p className="text-xs font-semibold text-brand-600 mb-2">
        Quick-create {type}
      </p>
      <div className="space-y-2">
        <input
          className="input text-xs h-8"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${type === 'faculty' ? 'Full name' : 'Name'}…`}
          autoFocus
        />
        {type === 'subject' && (
          <input
            className="input text-xs h-8"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            placeholder="Short code (e.g. PAIML)…"
            maxLength={10}
          />
        )}
        {type !== 'faculty' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="btn btn-sm btn-primary flex-1"
        >
          {loading ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface EntryModalProps {
  /** Null = new entry in an empty cell */
  existingEntry?: TimetableEntry | null;
  /** Pre-filled if clicking an empty cell */
  defaultDay?: DayOfWeek;
  defaultSlotId?: number;
  defaultBatchId?: number;
  onClose: () => void;
  onSaved: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type ConflictState =
  | { kind: 'none' }
  | { kind: 'hard'; message: string; conflicting?: ConflictingEntry | null }
  | { kind: 'warning'; message: string; conflicting?: ConflictingEntry | null };

export function EntryModal({
  existingEntry,
  defaultDay,
  defaultSlotId,
  defaultBatchId,
  onClose,
  onSaved,
}: EntryModalProps) {
  const qc = useQueryClient();

  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: getBatches });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => getSubjects() });
  const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: getFaculty });
  const { data: slots = [] } = useQuery({ queryKey: ['time-slots'], queryFn: getTimeSlots });

  const [batchId, setBatchId] = useState<number | null>(existingEntry?.batch_id ?? defaultBatchId ?? null);
  const [subjectId, setSubjectId] = useState<number | null>(existingEntry?.subject_id ?? null);
  const [facultyId, setFacultyId] = useState<number | null>(existingEntry?.faculty_id ?? null);
  const [day, setDay] = useState<DayOfWeek | null>(existingEntry?.day ?? defaultDay ?? null);
  const [slotId, setSlotId] = useState<number | null>(existingEntry?.time_slot_id ?? defaultSlotId ?? null);

  const [conflict, setConflict] = useState<ConflictState>({ kind: 'none' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [quickCreate, setQuickCreate] = useState<{ type: 'batch' | 'subject' | 'faculty'; initial: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const isComplete = batchId != null && subjectId != null && facultyId != null && day != null && slotId != null;
  const isEditing = !!existingEntry;

  const nonBreakSlots = slots.filter((s) => !s.is_break);
  const filteredSubjects = batchId ? subjects.filter((s) => s.batch_id === batchId) : [];

  function handleBatchChange(newBatchId: number) {
    if (newBatchId !== batchId) setSubjectId(null);
    setBatchId(newBatchId);
    setConflict({ kind: 'none' });
  }

  async function save(force = false) {
    if (!isComplete) return;
    setSaveStatus('saving');
    setConflict({ kind: 'none' });

    try {
      let res;
      if (isEditing) {
        res = await updateEntry(existingEntry.id, {
          batch_id: batchId!,
          subject_id: subjectId!,
          faculty_id: facultyId!,
          day: day!,
          time_slot_id: slotId!,
          version: existingEntry.version,
        }, force);
      } else {
        res = await createEntry({
          batch_id: batchId!,
          subject_id: subjectId!,
          faculty_id: facultyId!,
          day: day!,
          time_slot_id: slotId!,
        }, force);
      }

      if (res.status === 'warning') {
        // backend returned a warning even with force=true? shouldn't happen
        // but handle gracefully:
        setSaveStatus('idle');
        setConflict({ kind: 'warning', message: res.message, conflicting: res.conflicting_entry });
        return;
      }

      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success(isEditing ? 'Entry updated' : 'Entry added');
      onSaved();
    } catch (err: unknown) {
      setSaveStatus('error');
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        // 409 from backend = hard conflict or version conflict
        if (err.response?.status === 409) {
          setConflict({ kind: 'hard', message: String(detail) });
        } else {
          toast.error(String(detail));
        }
      }
    }
  }

  async function handleChange() {
    if (!isComplete) return;
    // Check for warning state before saving
    setSaveStatus('saving');
    setConflict({ kind: 'none' });

    try {
      let res;
      if (isEditing) {
        res = await updateEntry(existingEntry.id, {
          batch_id: batchId!,
          subject_id: subjectId!,
          faculty_id: facultyId!,
          day: day!,
          time_slot_id: slotId!,
          version: existingEntry.version,
        }, false);
      } else {
        res = await createEntry({
          batch_id: batchId!,
          subject_id: subjectId!,
          faculty_id: facultyId!,
          day: day!,
          time_slot_id: slotId!,
        }, false);
      }

      if (res.status === 'warning' && res.entry == null) {
        // Server returned warning, no entry saved yet
        setSaveStatus('idle');
        setConflict({ kind: 'warning', message: res.message, conflicting: res.conflicting_entry });
        return;
      }

      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success(isEditing ? 'Entry updated' : 'Entry added');
      onSaved();
    } catch (err: unknown) {
      setSaveStatus('error');
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        if (err.response?.status === 409) {
          setConflict({ kind: 'hard', message: String(detail) });
        } else {
          toast.error(String(detail));
        }
      }
    }
  }

  async function handleDelete() {
    if (!existingEntry) return;
    setDeletePending(true);
    try {
      await deleteEntry(existingEntry.id);
      qc.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success('Entry deleted');
      onClose();
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setDeletePending(false);
    }
  }

  const DAY_OPTIONS = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ] as DayOfWeek[];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">
            {isEditing ? 'Edit Entry' : 'Add Entry'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Batch */}
          <div>
            <label className="label">Batch</label>
            <Combobox
              id="modal-batch"
              options={batches.map((b) => ({ value: b.id, label: b.name, color: b.color }))}
              value={batchId}
              onChange={handleBatchChange}
              placeholder="Select batch…"
              onAddNew={(q) => setQuickCreate({ type: 'batch', initial: q })}
              addNewLabel="Add new batch"
            />
            {quickCreate?.type === 'batch' && (
              <QuickCreate
                type="batch"
                initialName={quickCreate.initial}
                onCreated={(id) => { handleBatchChange(id); setQuickCreate(null); }}
                onCancel={() => setQuickCreate(null)}
              />
            )}
          </div>

          {/* Subject */}
          <div className={!batchId ? "opacity-50 pointer-events-none" : ""}>
            <label className="label">Subject {!batchId && "(Select a batch first)"}</label>
            <Combobox
              id="modal-subject"
              options={filteredSubjects.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.short_code,
                color: s.color,
              }))}
              value={subjectId}
              onChange={(v) => { setSubjectId(v as number); setConflict({ kind: 'none' }); }}
              placeholder={batchId ? "Select subject…" : "Waiting for batch…"}
              onAddNew={(q) => setQuickCreate({ type: 'subject', initial: q })}
              addNewLabel="Add new subject"
            />
            {quickCreate?.type === 'subject' && batchId && (
              <QuickCreate
                type="subject"
                initialName={quickCreate.initial}
                batchId={batchId}
                onCreated={(id) => { setSubjectId(id); setQuickCreate(null); }}
                onCancel={() => setQuickCreate(null)}
              />
            )}
          </div>

          {/* Faculty */}
          <div>
            <label className="label">Faculty</label>
            <Combobox
              id="modal-faculty"
              options={faculty.map((f) => ({ value: f.id, label: f.name }))}
              value={facultyId}
              onChange={(v) => { setFacultyId(v as number); setConflict({ kind: 'none' }); }}
              placeholder="Select faculty…"
              onAddNew={(q) => setQuickCreate({ type: 'faculty', initial: q })}
              addNewLabel="Add new faculty"
            />
            {quickCreate?.type === 'faculty' && (
              <QuickCreate
                type="faculty"
                initialName={quickCreate.initial}
                onCreated={(id) => { setFacultyId(id); setQuickCreate(null); }}
                onCancel={() => setQuickCreate(null)}
              />
            )}
          </div>

          {/* Day */}
          <div>
            <label className="label">Day</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDay(d); setConflict({ kind: 'none' }); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                    ${day === d
                      ? 'bg-brand-500/20 text-brand-700 border-brand-500/60'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot */}
          <div>
            <label className="label">Time Slot</label>
            <div className="flex flex-wrap gap-1.5">
              {nonBreakSlots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSlotId(s.id); setConflict({ kind: 'none' }); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                    ${slotId === s.id
                      ? 'bg-brand-500/20 text-brand-700 border-brand-500/60'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                >
                  {s.label}
                  <span className="ml-1 opacity-60 text-[10px]">
                    {fmtSlotRange(s.start_time, s.end_time)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conflict / warning notifications */}
          {conflict.kind === 'hard' && (
            <HardConflictAlert
              message={conflict.message}
              conflicting={conflict.conflicting}
              onClose={() => setConflict({ kind: 'none' })}
            />
          )}
          {conflict.kind === 'warning' && (
            <SoftWarningAlert
              message={conflict.message}
              conflicting={conflict.conflicting}
              loading={saveStatus === 'saving'}
              onAddAnyway={() => save(true)}
              onChooseDifferent={() => {
                setConflict({ kind: 'none' });
                setSlotId(null);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePending}
                className="btn btn-sm btn-danger"
              >
                <Trash2 size={13} />
                {deletePending ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-sm btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleChange}
              disabled={!isComplete || saveStatus === 'saving' || conflict.kind === 'hard'}
              className="btn btn-sm btn-primary"
            >
              <Save size={13} />
              {saveStatus === 'saving' ? 'Saving…' : isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
