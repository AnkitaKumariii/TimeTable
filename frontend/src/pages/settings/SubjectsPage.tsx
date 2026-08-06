import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../../api';
import type { Subject, SubjectCreate } from '../../types';
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
          style={{ backgroundColor: c, borderColor: value === c ? '#fff' : 'transparent', boxShadow: value === c ? '0 0 0 2px rgba(99,102,241,0.6)' : 'none' }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer bg-transparent border border-[#2d3148]" />
    </div>
  );
}

function SubjectForm({ initial, onSave, onCancel }: {
  initial?: Subject; onSave: (d: SubjectCreate) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [shortCode, setShortCode] = useState(initial?.short_code ?? '');
  const [color, setColor] = useState(initial?.color ?? '#0ea5e9');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !shortCode.trim()) return;
    setLoading(true);
    try { await onSave({ name: name.trim(), short_code: shortCode.trim().toUpperCase(), color }); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-500/30 animate-slide-up">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Subject Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Machine Learning" />
        </div>
        <div>
          <label className="label">Short Code</label>
          <input className="input uppercase" value={shortCode} onChange={(e) => setShortCode(e.target.value.toUpperCase())} placeholder="e.g. PAIML" maxLength={10} />
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

export function SubjectsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const { data: subjects = [], isLoading } = useQuery({ queryKey: ['subjects'], queryFn: getSubjects });

  async function handleCreate(data: SubjectCreate) {
    try {
      await createSubject(data);
      qc.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject created');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
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
    if (!confirm(`Delete "${subject.name}"?`)) return;
    try {
      await deleteSubject(subject.id);
      qc.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Subjects</h2>
          <p className="text-sm text-slate-500">Reusable courses. Pick from dropdowns when building the timetable.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Subject
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-4"><SubjectForm onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {isLoading ? <div className="text-slate-500 text-sm">Loading…</div> : subjects.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 text-sm">No subjects yet.</div>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <SubjectForm initial={s} onSave={(d) => handleUpdate(s, d)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="card px-4 py-3 flex items-center gap-3 group">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm font-medium text-slate-200">{s.name}</span>
                  <span className="text-xs font-mono text-slate-500 px-2 py-0.5 rounded bg-[#12152a]">{s.short_code}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(s); setShowForm(false); }} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(s)} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
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
