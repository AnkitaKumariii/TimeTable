import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Save, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

import {
  createBatch, createEntriesBulk, createFaculty, createSubject, createRoom,
  deleteEntry, getBatches, getFaculty, getSubjects, getRooms,
  updateEntry, getEntries, getBatchGroups, getTimeSlots,
} from '../api';
import type {
  Batch, ConflictingEntry, DayOfWeek, FacultyMember, Room,
  Subject, TimetableEntry,
} from '../types';
import { Combobox } from './Combobox';
import { HardConflictAlert, SoftWarningAlert } from './ConflictNotification';

// Inline quick-create mini-form
interface QuickCreateProps {
  type: 'batch' | 'subject' | 'faculty' | 'room';
  initialName: string;
  batchId?: number;
  onCreated: (id: number) => void;
  onCancel: () => void;
}

function QuickCreate({ type, initialName, batchId, onCreated, onCancel }: QuickCreateProps) {
  const [name, setName] = useState(initialName);
  const [shortCode, setShortCode] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [hoursPerWeek, setHoursPerWeek] = useState('4');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleCreate() {
    setLoading(true);
    try {
      let created: Batch | Subject | FacultyMember | Room;
      if (type === 'batch') {
        created = await createBatch({ name, color });
        qc.invalidateQueries({ queryKey: ['batches'] });
      } else if (type === 'subject') {
        if (!batchId) throw new Error("Batch required");
        const hpw = Number(hoursPerWeek);
        if (hoursPerWeek.trim() === '' || !Number.isInteger(hpw) || hpw <= 0) {
          toast.error('Hours per week must be a positive integer.');
          return;
        }
        created = await createSubject({ batch_id: batchId, name, short_code: shortCode || name.slice(0, 6).toUpperCase(), color, hours_per_week: hpw, type: 'theory' });
        qc.invalidateQueries({ queryKey: ['subjects'] });
      } else if (type === 'room') {
        created = await createRoom({ name });
        qc.invalidateQueries({ queryKey: ['rooms'] });
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
          <div className="space-y-2">
            <input
              className="input text-xs h-8 w-full"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              placeholder="Short code (e.g. PAIML)…"
              maxLength={10}
            />
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="qc-hpw" className="text-xs text-slate-500">Hours per week</label>
              <input
                id="qc-hpw"
                type="number"
                min="1"
                className="input text-xs h-8 w-16"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
              />
            </div>
          </div>
        )}
        {type !== 'faculty' && type !== 'room' && (
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
  /** Pre-select a lab group when opening from a group skeleton */
  defaultGroupId?: number;
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
  defaultGroupId,
  onClose,
  onSaved,
}: EntryModalProps) {
  const qc = useQueryClient();

  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: getBatches });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => getSubjects() });
  const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: getFaculty });
  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: getRooms });
  const { data: entries = [] } = useQuery({ queryKey: ['timetable-entries'], queryFn: () => getEntries() });
  const { data: slots = [] } = useQuery({ queryKey: ['time-slots'], queryFn: getTimeSlots });

  const [batchId, setBatchId] = useState<number | null>(existingEntry?.batch_id ?? defaultBatchId ?? null);
  const [groupId, setGroupId] = useState<number | null>(existingEntry?.group_id ?? defaultGroupId ?? null);
  const [subjectId, setSubjectId] = useState<number | null>(existingEntry?.subject_id ?? null);

  const { data: groups = [] } = useQuery({
    queryKey: ['batch-groups', batchId],
    queryFn: () => batchId ? getBatchGroups(batchId) : Promise.resolve([]),
    enabled: !!batchId,
  });

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const [facultyIds, setFacultyIds] = useState<(number | null)[]>(
    existingEntry?.faculties?.map(f => f.id) ?? []
  );
  // Count of extra slots beyond the fixed 2 Profs + 2 TAs
  const [extraSlots, setExtraSlots] = useState(Math.max(0, (existingEntry?.faculties?.length ?? 0) - 4));
  const [roomId, setRoomId] = useState<number | null>(existingEntry?.room_id ?? null);
  const [day] = useState<DayOfWeek>(existingEntry?.day ?? defaultDay ?? 'Monday');
  const [slotId, setSlotId] = useState<number | null>(existingEntry?.time_slot_id ?? defaultSlotId ?? null);

  const [conflict, setConflict] = useState<ConflictState>({ kind: 'none' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [quickCreate, setQuickCreate] = useState<{ type: 'batch' | 'subject' | 'faculty' | 'room'; initial: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  // True when the currently selected group already has a lab entry for this subject
  // (on any day), meaning saving would be blocked anyway. Used to grey out Save.
  //
  // Exception: when editing an entry that has NOT changed its subject or group, the
  // sibling auto-fill slots (same subject_id + group_id, different time_slot_id) are
  // legitimate — skip the conflict check in that case.
  const editingUnchangedAssignment =
    !!existingEntry &&
    existingEntry.subject_id === subjectId &&
    existingEntry.group_id === groupId;

  const isGroupConflicted =
    !editingUnchangedAssignment &&
    selectedSubject?.type === 'lab' &&
    groupId != null &&
    entries.some(
      (e) => e.subject_id === subjectId && e.group_id === groupId && e.id !== existingEntry?.id,
    );

  const isComplete =
    batchId != null &&
    subjectId != null &&
    facultyIds.some(id => id != null) &&
    roomId != null &&
    day != null &&
    slotId != null &&
    selectedSubject != null &&
    (selectedSubject.type !== 'lab' || (groupId != null && !isGroupConflicted));
  const isEditing = !!existingEntry;

  const filteredSubjects = batchId ? subjects.filter((s) => s.batch_id === batchId) : [];

  function handleBatchChange(newBatchId: string | number) {
    const id = newBatchId as number;
    if (id !== batchId) { setSubjectId(null); setGroupId(null); }
    setBatchId(id);
    setConflict({ kind: 'none' });
  }

  async function save(force = false) {
    if (!isComplete) return;
    setSaveStatus('saving');
    setConflict({ kind: 'none' });

    try {
      if (isEditing) {
        const res = await updateEntry(existingEntry.id, {
          batch_id: batchId!,
          group_id: selectedSubject?.type === 'lab' ? groupId : null,
          subject_id: subjectId!,
          faculty_ids: selectedSubject?.type === 'theory'
            ? facultyIds.filter((id): id is number => id !== null).slice(0, 1)
            : facultyIds.filter((id): id is number => id !== null),
          room_id: roomId!,
          day: day!,
          time_slot_id: slotId!,
          version: existingEntry.version,
        }, force);

        if (res.status === 'warning' && !force) {
          setSaveStatus('idle');
          setConflict({ kind: 'warning', message: res.message, conflicting: res.conflicting_entry });
          return;
        }
        setSaveStatus('saved');
        qc.invalidateQueries({ queryKey: ['timetable-entries'] });
        toast.success('Entry updated');
        onSaved();
      } else {
        // New entry creation — use bulk endpoint to ensure "all-or-nothing" auto-fill for labs
        const payloads = [];
        const basePayload = {
          batch_id: batchId!,
          group_id: selectedSubject?.type === 'lab' ? groupId : null,
          subject_id: subjectId!,
          faculty_ids: selectedSubject?.type === 'theory'
            ? facultyIds.filter((id): id is number => id !== null).slice(0, 1)
            : facultyIds.filter((id): id is number => id !== null),
          room_id: roomId!,
          day: day!,
          time_slot_id: slotId!,
        };
        payloads.push(basePayload);

        let isAutoFilling = false;
        if (selectedSubject?.type === 'lab' && selectedSubject.hours_per_week > 1) {
          const currentSlot = slots.find((s) => s.id === slotId);
          if (!currentSlot) {
            setSaveStatus('idle');
            toast.error('Selected time slot not found. Please refresh and try again.');
            return;
          }
          const sortedAfter = slots
            .filter((s) => s.sort_order > currentSlot.sort_order)
            .sort((a, b) => a.sort_order - b.sort_order);
          
          const nextSlots = [];
          let lastOrder = currentSlot.sort_order;
          
          for (const s of sortedAfter) {
            if (s.is_break || s.sort_order !== lastOrder + 1) break;
            nextSlots.push(s);
            lastOrder = s.sort_order;
            if (nextSlots.length === selectedSubject.hours_per_week - 1) break;
          }
          
          const requiredExtra = selectedSubject.hours_per_week - 1;
          if (nextSlots.length < requiredExtra) {
            setSaveStatus('idle');
            toast.error(
              `Cannot fit ${selectedSubject.hours_per_week}-hour lab here. Only ${nextSlots.length + 1} consecutive slot(s) available before a break or end of day.`
            );
            return;
          }
          
          for (const slot of nextSlots) {
            payloads.push({ ...basePayload, time_slot_id: slot.id });
          }
          isAutoFilling = true;
        }

        const res = await createEntriesBulk(payloads, force);

        // If not forced and backend returned a single warning response
        if (!Array.isArray(res) && res.status === 'warning') {
          setSaveStatus('idle');
          setConflict({ kind: 'warning', message: res.message, conflicting: res.conflicting_entry });
          return;
        }

        setSaveStatus('saved');
        qc.invalidateQueries({ queryKey: ['timetable-entries'] });
        
        if (isAutoFilling) {
          toast.success(`Lab scheduled — ${payloads.length} consecutive slots filled`);
        } else {
          toast.success('Entry added');
        }
        onSaved();
      }
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

  async function handleChange() {
    // handleChange is effectively `save(false)` now, handled cleanly by the above logic.
    // It's called when a user clicks a quick-change option directly.
    return save(false);
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

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel !max-w-xl !max-h-[98vh] min-h-[600px]">
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
          {(!defaultBatchId && !existingEntry) && (
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
          )}

          {/* Subject */}
          <div className={!batchId ? "opacity-50 pointer-events-none" : ""}>
            <label className="label">Subject {!batchId && "(Select a batch first)"}</label>
            <div className="flex flex-wrap gap-2">
              {filteredSubjects.map((s) => {
                const isSelected = subjectId === s.id;
                const usageCount = entries.filter((e) => e.subject_id === s.id && (!existingEntry || e.id !== existingEntry.id)).length;
                // Labs: each group has its own hours_per_week quota, so total capacity = hours × groups.
                // Theory: global limit = hours_per_week.
                const numGroups = s.type === 'lab' ? (groups.length || 1) : 1;
                const effectiveLimit = s.hours_per_week * numGroups;
                const isOverLimit = usageCount >= effectiveLimit;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSubjectId(s.id); setConflict({ kind: 'none' }); if (s.type === 'theory') setGroupId(null); }}
                    className={`flex flex-col items-start px-3 py-2 rounded-lg border transition-all text-left min-w-[100px]
                      ${isSelected
                        ? 'border-brand-500/60 ring-1 ring-brand-500/60'
                        : isOverLimit
                          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    style={isSelected ? { borderColor: s.color, backgroundColor: `${s.color}15`, outlineColor: s.color } : {}}
                  >
                    <span className="text-xs font-bold" style={{ color: isSelected ? s.color : 'inherit' }}>{s.short_code}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{s.name}</span>
                    <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded font-mono ${isOverLimit && !isSelected ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {usageCount}/{effectiveLimit} hrs{numGroups > 1 ? ` (${s.hours_per_week}×${numGroups})` : ''}
                    </span>
                  </button>
                );
              })}
              {batchId && (
                <button
                  type="button"
                  onClick={() => setQuickCreate({ type: 'subject', initial: '' })}
                  className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-all text-xs min-h-[46px]"
                >
                  <Plus size={14} />
                  <span>New Subject</span>
                </button>
              )}
            </div>
            {quickCreate?.type === 'subject' && batchId && (
              <div className="mt-3">
                <QuickCreate
                  type="subject"
                  initialName={quickCreate.initial}
                  batchId={batchId}
                  onCreated={(id) => { setSubjectId(id); setQuickCreate(null); }}
                  onCancel={() => setQuickCreate(null)}
                />
              </div>
            )}
          </div>

          {/* Lab Group */}
          {selectedSubject?.type === 'lab' && (
            <div className="animate-slide-up">
              <label className="label">Lab Group</label>
              {groups.length === 0 ? (
                <p className="text-xs text-amber-600 mt-1">No groups available in this batch. Add groups in Settings.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const isSelected = groupId === g.id;
                    // A group is "already scheduled" if it has any entry for this lab subject
                    // (on any day), excluding the entry currently being edited.
                    const scheduledEntry = entries.find(
                      (e) => e.subject_id === subjectId && e.group_id === g.id && e.id !== existingEntry?.id
                    );
                    const isScheduled = !!scheduledEntry;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          if (!isScheduled) { setGroupId(g.id); setConflict({ kind: 'none' }); }
                        }}
                        disabled={isScheduled}
                        title={isScheduled ? `Already scheduled on ${scheduledEntry.day}` : undefined}
                        className={`flex flex-col items-start px-3 py-2 rounded-lg border transition-all text-left min-w-[90px]
                          ${
                            isSelected
                              ? 'border-brand-500/60 ring-1 ring-brand-500/60 bg-brand-50'
                              : isScheduled
                                ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-brand-600' : isScheduled ? 'text-slate-400' : 'text-slate-700'
                          }`}
                        >
                          {g.name}
                        </span>
                        {isScheduled ? (
                          <span className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono">
                            ✓ {scheduledEntry.day}
                          </span>
                        ) : isSelected ? (
                          <span className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded bg-brand-100 text-brand-600 font-mono">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Faculty */}
          <div>
            <label className="label">
              {selectedSubject?.type === 'lab' ? 'Faculty' : 'Faculty'}
            </label>
            
            {selectedSubject?.type === 'lab' ? (
              <div className="space-y-4">

                {/* ── Professors (role-filtered) ────────────────────── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Professors
                  </p>
                  {[0, 1].map((index) => (
                    <Combobox
                      key={`prof-${index}`}
                      id={`modal-faculty-prof-${index}`}
                      options={faculty
                        .filter(f => f.role === 'professor')
                        .map(f => ({ value: f.id, label: f.name, sublabel: 'Prof.' }))}
                      value={facultyIds[index] ?? null}
                      onChange={(v) => {
                        const newIds = [...facultyIds];
                        newIds[index] = v as number;
                        setFacultyIds(newIds);
                        setConflict({ kind: 'none' });
                      }}
                      placeholder={`Professor ${index + 1}…`}
                      onAddNew={(q) => setQuickCreate({ type: 'faculty', initial: q })}
                      addNewLabel="Add new professor"
                    />
                  ))}
                </div>

                {/* ── Teaching Assistants (role-filtered) ───────────── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Teaching Assistants
                  </p>
                  {[2, 3].map((index) => (
                    <Combobox
                      key={`ta-${index}`}
                      id={`modal-faculty-ta-${index - 2}`}
                      options={faculty
                        .filter(f => f.role === 'teaching_assistant')
                        .map(f => ({ value: f.id, label: f.name, sublabel: 'TA' }))}
                      value={facultyIds[index] ?? null}
                      onChange={(v) => {
                        const newIds = [...facultyIds];
                        newIds[index] = v as number;
                        setFacultyIds(newIds);
                        setConflict({ kind: 'none' });
                      }}
                      placeholder={`Teaching Assistant ${index - 1}…`}
                      onAddNew={(q) => setQuickCreate({ type: 'faculty', initial: q })}
                      addNewLabel="Add new TA"
                    />
                  ))}
                </div>

                {/* ── Additional faculty (optional, any role) ────────── */}
                {extraSlots > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                      Additional Faculty
                    </p>
                    {Array.from({ length: extraSlots }).map((_, i) => {
                      const index = 4 + i;
                      return (
                        <Combobox
                          key={`extra-${index}`}
                          id={`modal-faculty-extra-${i}`}
                          options={faculty.map(f => ({
                            value: f.id,
                            label: f.name,
                            sublabel: f.role === 'teaching_assistant' ? 'TA' : 'Prof.',
                          }))}
                          value={facultyIds[index] ?? null}
                          onChange={(v) => {
                            const newIds = [...facultyIds];
                            newIds[index] = v as number;
                            setFacultyIds(newIds);
                            setConflict({ kind: 'none' });
                          }}
                          placeholder={`Additional faculty ${i + 1}…`}
                          onAddNew={(q) => setQuickCreate({ type: 'faculty', initial: q })}
                          addNewLabel="Add new faculty"
                        />
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setExtraSlots(s => s + 1)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add more faculty
                </button>
              </div>
            ) : (
              <Combobox
                id="modal-faculty"
                options={faculty.map((f) => ({
                  value: f.id,
                  label: f.name,
                  sublabel: f.role === 'teaching_assistant' ? 'TA' : 'Prof.',
                }))}
                value={facultyIds[0] ?? null}
                onChange={(v) => { 
                  setFacultyIds([v as number]); 
                  setConflict({ kind: 'none' }); 
                }}
                placeholder="Select faculty…"
                onAddNew={(q) => setQuickCreate({ type: 'faculty', initial: q })}
                addNewLabel="Add new faculty"
              />
            )}

            {quickCreate?.type === 'faculty' && (
              <QuickCreate
                type="faculty"
                initialName={quickCreate.initial}
                onCreated={(id) => {
                  if (selectedSubject?.type === 'lab') {
                    // Find first empty slot or add a new extra one
                    const emptyIdx = facultyIds.findIndex(f => f == null);
                    if (emptyIdx !== -1) {
                      const newIds = [...facultyIds];
                      newIds[emptyIdx] = id;
                      setFacultyIds(newIds);
                    } else {
                      setFacultyIds([...facultyIds, id]);
                      setExtraSlots(s => s + 1);
                    }
                  } else {
                    setFacultyIds([id]);
                  }
                  setQuickCreate(null);
                }}
                onCancel={() => setQuickCreate(null)}
              />
            )}
          </div>

          {/* Room */}
          <div>
            <label className="label">Room</label>
            <Combobox
              id="modal-room"
              options={rooms.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
              value={roomId}
              onChange={(v) => { setRoomId(v as number); setConflict({ kind: 'none' }); }}
              placeholder="Select room…"
              onAddNew={(q) => setQuickCreate({ type: 'room', initial: q })}
              addNewLabel="Add new room"
            />
            {quickCreate?.type === 'room' && (
              <QuickCreate
                type="room"
                initialName={quickCreate.initial}
                onCreated={(id) => { setRoomId(id); setQuickCreate(null); }}
                onCancel={() => setQuickCreate(null)}
              />
            )}
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
