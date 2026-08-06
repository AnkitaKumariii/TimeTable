import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getBatches, createBatch, updateBatch, deleteBatch } from '../../api';
import type { Batch, BatchCreate } from '../../types';
import { PRESET_COLORS } from '../../lib/utils';

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
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

interface RowFormProps {
  initial?: Batch;
  onSave: (data: BatchCreate) => Promise<void>;
  onCancel: () => void;
}

function BatchForm({ initial, onSave, onCancel }: RowFormProps) {
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

export function BatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);

  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: getBatches });

  async function handleCreate(data: BatchCreate) {
    try {
      await createBatch(data);
      qc.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch created');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed to create');
    }
  }

  async function handleUpdate(batch: Batch, data: BatchCreate) {
    try {
      await updateBatch(batch.id, data);
      qc.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed to update');
    }
  }

  async function handleDelete(batch: Batch) {
    if (!window.confirm(`Delete "${batch.name}"? All timetable entries for this batch will also be deleted.`)) return;
    try {
      await deleteBatch(batch.id);
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success('Batch deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed to delete');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Batches</h2>
          <p className="text-sm text-slate-500">Manage student cohorts and their colors.</p>
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
        <div className="space-y-2">
          {batches.map((batch) => (
            <div key={batch.id}>
              {editing?.id === batch.id ? (
                <BatchForm
                  initial={batch}
                  onSave={(d) => handleUpdate(batch, d)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="card px-4 py-3 flex items-center gap-3 group">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: batch.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-slate-700">{batch.name}</span>
                  {!batch.is_active && (
                    <span className="badge bg-slate-100 text-slate-700 text-[10px]">Inactive</span>
                  )}
                  <div className="flex items-center gap-1 opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(batch); setShowForm(false); }}
                      className="btn-ghost p-1.5 rounded-lg"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(batch)}
                      className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
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
