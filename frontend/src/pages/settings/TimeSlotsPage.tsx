import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, GripVertical, Plus, Trash2, Coffee } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } from '../../api';
import type { TimeSlot, TimeSlotCreate } from '../../types';
import { fmtSlotRange } from '../../lib/utils';

function TimeSlotForm({ initial, maxOrder, onSave, onCancel }: {
  initial?: TimeSlot; maxOrder: number; onSave: (d: TimeSlotCreate) => Promise<void>; onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [start, setStart] = useState(initial?.start_time?.slice(0, 5) ?? '');
  const [end, setEnd] = useState(initial?.end_time?.slice(0, 5) ?? '');
  const [order, setOrder] = useState(initial?.sort_order ?? maxOrder + 1);
  const [isBreak, setIsBreak] = useState(initial?.is_break ?? false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !start || !end) return;
    setLoading(true);
    try {
      await onSave({ label: label.trim(), start_time: start, end_time: end, sort_order: order, is_break: isBreak });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-500/30 animate-slide-up">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Label</label>
          <input autoFocus className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Period 1" />
        </div>
        <div>
          <label className="label">Start Time</label>
          <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">End Time</label>
          <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input type="number" className="input" value={order} onChange={(e) => setOrder(Number(e.target.value))} min={1} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isBreak}
              onChange={(e) => setIsBreak(e.target.checked)}
              className="w-4 h-4 accent-brand-500 rounded"
            />
            <span className="text-sm text-slate-300">Mark as Break (Lunch)</span>
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!label.trim() || !start || !end || loading} className="btn btn-sm btn-primary">
          {loading ? 'Saving…' : initial ? 'Update' : 'Add Slot'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export function TimeSlotsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const { data: slots = [], isLoading } = useQuery({ queryKey: ['time-slots'], queryFn: getTimeSlots });
  const sorted = [...slots].sort((a, b) => a.sort_order - b.sort_order);
  const maxOrder = sorted.length > 0 ? sorted[sorted.length - 1].sort_order : 0;

  async function handleCreate(data: TimeSlotCreate) {
    try {
      await createTimeSlot(data);
      qc.invalidateQueries({ queryKey: ['time-slots'] });
      toast.success('Time slot added');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleUpdate(slot: TimeSlot, data: TimeSlotCreate) {
    try {
      await updateTimeSlot(slot.id, data);
      qc.invalidateQueries({ queryKey: ['time-slots'] });
      toast.success('Updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleDelete(slot: TimeSlot) {
    if (!confirm(`Delete "${slot.label}"?`)) return;
    try {
      await deleteTimeSlot(slot.id);
      qc.invalidateQueries({ queryKey: ['time-slots'] });
      toast.success('Deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Time Slots</h2>
          <p className="text-sm text-slate-500">Configure periods and breaks. Sorted by order number.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Slot
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-4"><TimeSlotForm maxOrder={maxOrder} onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {isLoading ? <div className="text-slate-500 text-sm">Loading…</div> : sorted.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 text-sm">No time slots yet.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((slot) => (
            <div key={slot.id}>
              {editing?.id === slot.id ? (
                <TimeSlotForm initial={slot} maxOrder={maxOrder} onSave={(d) => handleUpdate(slot, d)} onCancel={() => setEditing(null)} />
              ) : (
                <div className={`card px-4 py-3 flex items-center gap-3 group
                  ${slot.is_break ? 'border-amber-500/20 bg-amber-500/5' : ''}`}>
                  <span className="text-xs font-mono text-slate-500 w-6 text-center">{slot.sort_order}</span>
                  {slot.is_break ? <Coffee size={14} className="text-amber-400 flex-shrink-0" /> : (
                    <GripVertical size={14} className="text-slate-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${slot.is_break ? 'text-amber-300' : 'text-slate-200'}`}>
                      {slot.label}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      {fmtSlotRange(slot.start_time, slot.end_time)}
                    </span>
                  </div>
                  {slot.is_break && <span className="badge bg-amber-500/20 text-amber-400 text-[10px]">Break</span>}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(slot); setShowForm(false); }} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(slot)} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
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
