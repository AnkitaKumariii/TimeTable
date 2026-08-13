import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, GraduationCap, Plus, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getFaculty, createFaculty, updateFaculty, deleteFaculty } from '../../api';
import type { FacultyMember, FacultyCreate, FacultyRole } from '../../types';

const ROLE_LABELS: Record<FacultyRole, string> = {
  professor: 'Professor',
  teaching_assistant: 'Teaching Assistant',
};

function RoleToggle({ value, onChange }: { value: FacultyRole; onChange: (r: FacultyRole) => void }) {
  return (
    <div role="group" aria-label="Faculty role" className="flex rounded-lg border border-slate-200 overflow-hidden">
      {(['professor', 'teaching_assistant'] as FacultyRole[]).map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors
            ${value === r
              ? 'bg-brand-500 text-white'
              : 'text-slate-500 hover:bg-slate-50'
            }`}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function FacultyForm({ initial, onSave, onCancel }: {
  initial?: FacultyMember; onSave: (d: FacultyCreate) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [role, setRole] = useState<FacultyRole>(initial?.role ?? 'professor');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try { await onSave({ name: name.trim(), email: email.trim() || undefined, role }); }
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
        <div className="col-span-full">
          <label className="label">Role</label>
          <RoleToggle value={role} onChange={setRole} />
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

function FacultyRow({ f, onEdit, onDelete }: { f: FacultyMember; onEdit: () => void; onDelete: () => void }) {
  const isTA = f.role === 'teaching_assistant';
  return (
    <div className="card px-4 py-3 flex items-center gap-3 group">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
        ${isTA ? 'bg-teal-500/20 text-teal-700' : 'bg-brand-500/20 text-brand-600'}`}>
        {f.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
        {f.email && <p className="text-xs text-slate-500 truncate">{f.email}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-100 transition-opacity">
        <button aria-label={`Edit faculty member ${f.name}`} onClick={onEdit} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={13} /></button>
        <button aria-label={`Delete faculty member ${f.name}`} onClick={onDelete} className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export function FacultyPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FacultyMember | null>(null);
  const { data: faculty = [], isLoading } = useQuery({ queryKey: ['faculty'], queryFn: getFaculty });

  const professors = faculty.filter((f) => f.role === 'professor');
  const tas = faculty.filter((f) => f.role === 'teaching_assistant');

  async function handleCreate(data: FacultyCreate) {
    try {
      await createFaculty(data);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Faculty added');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to create faculty') : 'Failed');
    }
  }

  async function handleUpdate(f: FacultyMember, data: FacultyCreate) {
    try {
      await updateFaculty(f.id, data);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to update faculty') : 'Failed');
    }
  }

  async function handleDelete(f: FacultyMember) {
    if (!window.confirm(`Remove "${f.name}" from the faculty list?`)) return;
    try {
      await deleteFaculty(f.id);
      qc.invalidateQueries({ queryKey: ['faculty'] });
      toast.success('Removed');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.detail || 'Failed to delete faculty') : 'Failed');
    }
  }

  function renderSection(title: string, icon: React.ReactNode, list: FacultyMember[]) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h3>
          <span className="ml-auto text-xs text-slate-400 font-medium">{list.length}</span>
        </div>
        {list.length === 0 ? (
          <div className="card p-5 text-center text-slate-400 text-xs border-dashed">No {title.toLowerCase()} added yet.</div>
        ) : (
          <div className="space-y-2">
            {list.map((f) => (
              <div key={f.id}>
                {editing?.id === f.id ? (
                  <FacultyForm initial={f} onSave={(d) => handleUpdate(f, d)} onCancel={() => setEditing(null)} />
                ) : (
                  <FacultyRow f={f} onEdit={() => { setEditing(f); setShowForm(false); }} onDelete={() => handleDelete(f)} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Faculty</h2>
          <p className="text-sm text-slate-500">Professors and Teaching Assistants for your timetable.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Faculty
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-6"><FacultyForm onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          {renderSection('Professors', <GraduationCap size={16} className="text-brand-500" />, professors)}
          <div className="border-t border-slate-100" />
          {renderSection('Teaching Assistants', <UserCheck size={16} className="text-teal-500" />, tas)}
        </div>
      )}
    </div>
  );
}
