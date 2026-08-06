import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getFaculty, createFaculty, updateFaculty, deleteFaculty } from '../../api';
import type { FacultyMember, FacultyCreate } from '../../types';

function FacultyForm({ initial, onSave, onCancel }: {
  initial?: FacultyMember; onSave: (d: FacultyCreate) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try { await onSave({ name: name.trim(), email: email.trim() || undefined }); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-500/30 animate-slide-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Full Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Ranjeet Kumar Rout" />
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="faculty@nita.ac.in" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || loading} className="btn btn-sm btn-primary">
          {loading ? 'Saving…' : initial ? 'Update' : 'Add Faculty'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export function FacultyPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FacultyMember | null>(null);
  const { data: faculty = [], isLoading } = useQuery({ queryKey: ['faculty'], queryFn: getFaculty });

  async function handleCreate(data: FacultyCreate) {
    try {
      await createFaculty(data);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Faculty added');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleUpdate(f: FacultyMember, data: FacultyCreate) {
    try {
      await updateFaculty(f.id, data);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleDelete(f: FacultyMember) {
    if (!confirm(`Remove "${f.name}" from the faculty list?`)) return;
    try {
      await deleteFaculty(f.id);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Removed');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Faculty</h2>
          <p className="text-sm text-slate-500">Teachers and instructors reused across all timetable entries.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Faculty
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-4"><FacultyForm onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {isLoading ? <div className="text-slate-500 text-sm">Loading…</div> : faculty.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 text-sm">No faculty members yet.</div>
      ) : (
        <div className="space-y-2">
          {faculty.map((f) => (
            <div key={f.id}>
              {editing?.id === f.id ? (
                <FacultyForm initial={f} onSave={(d) => handleUpdate(f, d)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="card px-4 py-3 flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
                    {f.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{f.name}</p>
                    {f.email && <p className="text-xs text-slate-500 truncate">{f.email}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(f); setShowForm(false); }} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(f)} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
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
