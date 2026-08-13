import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  getBatches, createBatch, updateBatch, deleteBatch,
  getSubjects, createSubject, updateSubject, deleteSubject
} from '../../api';
import type { Batch, BatchCreate, Subject, SubjectCreate } from '../../types';
import { PRESET_COLORS } from '../../lib/utils';

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full transition-transform hover:scale-110 border-2"
          style={{
            backgroundColor: c,
            borderColor: value === c ? '#fff' : 'transparent',
            boxShadow: value === c ? '0 0 0 2px rgba(99,102,241,0.6)' : 'none',
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer bg-transparent border border-slate-200"
        title="Custom color"
      />
    </div>
  );
}

// ── Batch Components ──────────────────────────────────────────────────────────

function BatchForm({ initial, onSave, onCancel }: { initial?: Batch; onSave: (data: BatchCreate) => Promise<void>; onCancel: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave({ name: name.trim(), color });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-500/30 animate-slide-up">
      <div className="flex gap-3">
        <input
          autoFocus
          className="input flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Batch name (e.g. M.TECH-AI-1)"
        />
      </div>
      <div>
        <label className="label">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || loading} className="btn btn-sm btn-primary">
          {loading ? 'Saving…' : initial ? 'Update' : 'Add Batch'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Subject Components ────────────────────────────────────────────────────────

function SubjectForm({ batchId, initial, onSave, onCancel }: {
  batchId: number; initial?: Subject; onSave: (d: SubjectCreate) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [shortCode, setShortCode] = useState(initial?.short_code ?? '');
  const [color, setColor] = useState(initial?.color ?? '#0ea5e9');
  const [hoursPerWeek, setHoursPerWeek] = useState(initial?.hours_per_week?.toString() ?? '4');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !shortCode.trim()) return;
    setLoading(true);
    try { await onSave({ batch_id: batchId, name: name.trim(), short_code: shortCode.trim().toUpperCase(), color, hours_per_week: parseInt(hoursPerWeek) || 0 }); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-slate-50 border border-slate-200 rounded-lg animate-slide-up">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Subject Name</label>
          <input autoFocus className="input text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Machine Learning" />
        </div>
        <div>
          <label className="label">Short Code</label>
          <input className="input text-sm uppercase" value={shortCode} onChange={(e) => setShortCode(e.target.value.toUpperCase())} placeholder="e.g. PAIML" maxLength={10} />
        </div>
        <div>
          <label className="label">Hrs/Week (0=unlimited)</label>
          <input type="number" min="0" className="input text-sm" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || !shortCode.trim() || loading} className="btn btn-sm btn-primary">
          {loading ? 'Saving…' : initial ? 'Update' : 'Add Subject'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

function BatchSubjectsPanel({ batchId }: { batchId: number }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const { data: allSubjects = [], isLoading } = useQuery({ queryKey: ['subjects'], queryFn: () => getSubjects() });
  const subjects = allSubjects.filter(s => s.batch_id === batchId);

  async function handleCreate(data: SubjectCreate) {
    try {
      await createSubject(data);
      qc.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject created');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to create subject') : 'Failed');
    }
  }

  async function handleUpdate(subject: Subject, data: SubjectCreate) {
    try {
      await updateSubject(subject.id, data);
      qc.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleDelete(subject: Subject) {
    if (!window.confirm(`Delete "${subject.name}"? All timetable entries using this subject will also be deleted.`)) return;
    try {
      await deleteSubject(subject.id);
      qc.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  return (
    <div className="pt-3 border-t border-slate-100 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch Subjects</h3>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn-ghost text-xs text-brand-600 px-2 py-1 rounded">
          <Plus size={12} className="inline mr-1" /> Add Subject
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-3"><SubjectForm batchId={batchId} onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {isLoading ? <div className="text-slate-500 text-xs py-2">Loading subjects…</div> : subjects.length === 0 ? (
        <div className="text-center py-4 text-slate-400 text-xs bg-slate-50 rounded border border-dashed border-slate-200">
          No subjects added to this batch yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {subjects.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <SubjectForm batchId={batchId} initial={s} onSave={(d) => handleUpdate(s, d)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded group hover:bg-slate-100 transition-colors">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm font-medium text-slate-700">{s.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 bg-white">{s.short_code}</span>
                  <span className="text-[10px] text-slate-500">{s.hours_per_week > 0 ? `${s.hours_per_week} hrs/wk` : 'No limit'}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button aria-label={`Edit subject ${s.name}`} onClick={() => { setEditing(s); setShowForm(false); }} className="text-slate-400 hover:text-brand-600 p-1"><Edit2 size={12} /></button>
                    <button aria-label={`Delete subject ${s.name}`} onClick={() => handleDelete(s)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);

  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: getBatches });

  async function handleCreate(data: BatchCreate) {
    try {
      await createBatch(data);
      qc.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch created');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to create batch') : 'Failed to create');
    }
  }

  async function handleUpdate(batch: Batch, data: BatchCreate) {
    try {
      await updateBatch(batch.id, data);
      qc.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to update batch') : 'Failed to update');
    }
  }

  async function handleDelete(batch: Batch) {
    if (!window.confirm(`Delete "${batch.name}"? All subjects and timetable entries for this batch will also be deleted.`)) return;
    try {
      await deleteBatch(batch.id);
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success('Batch deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to delete batch') : 'Failed to delete');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Batches & Subjects</h2>
          <p className="text-sm text-slate-500">Manage student cohorts and their respective courses.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Batch
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-4">
          <BatchForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : batches.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 text-sm">No batches yet. Add one above.</div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;
            return (
              <div key={batch.id} className="card p-3 flex flex-col transition-all">
                {editing?.id === batch.id ? (
                  <BatchForm
                    initial={batch}
                    onSave={(d) => handleUpdate(batch, d)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3 group px-1">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} subjects for ${batch.name}`}
                        onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: batch.color }}
                      />
                      <span className="flex-1 text-base font-medium text-slate-800">{batch.name}</span>
                      {!batch.is_active && (
                        <span className="badge bg-slate-100 text-slate-700 text-[10px]">Inactive</span>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                          className="btn-ghost px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 mr-2"
                        >
                          <BookOpen size={13} className="inline mr-1.5" />
                          Subjects
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit batch ${batch.name}`}
                          onClick={() => { setEditing(batch); setShowForm(false); }}
                          className="btn-ghost p-1.5 rounded-lg text-slate-500 hover:text-brand-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete batch ${batch.name}`}
                          onClick={() => handleDelete(batch)}
                          className="btn-ghost p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && <BatchSubjectsPanel batchId={batch.id} />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
