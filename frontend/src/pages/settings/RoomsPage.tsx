import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getRooms, createRoom, updateRoom, deleteRoom } from '../../api';
import type { Room, RoomCreate } from '../../types';
import { ConfirmModal } from '../../components/ConfirmModal';

function RoomForm({ initial, onSave, onCancel }: {
  initial?: Room; onSave: (d: RoomCreate) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave({ name: name.trim() });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-500/30 animate-slide-up">
      <div>
        <label className="label">Room Name</label>
        <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 101, Lab A" />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={!name.trim() || loading} className="btn btn-sm btn-primary">
          {loading ? 'Saving…' : initial ? 'Update' : 'Add Room'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

export function RoomsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const { data: rooms = [], isLoading } = useQuery({ queryKey: ['rooms'], queryFn: getRooms });

  async function handleCreate(data: RoomCreate) {
    try {
      await createRoom(data);
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room added');
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function handleUpdate(room: Room, data: RoomCreate) {
    try {
      await updateRoom(room.id, data);
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Updated');
      setEditing(null);
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    }
  }

  async function confirmDelete(room: Room) {
    try {
      await deleteRoom(room.id);
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Deleted');
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? String(err.response?.data?.detail) : 'Failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Rooms</h2>
          <p className="text-sm text-slate-500">Manage physical spaces for classes.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn btn-sm btn-primary">
          <Plus size={13} /> Add Room
        </button>
      </div>

      {showForm && !editing && (
        <div className="mb-4"><RoomForm onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Room"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          confirmText="Delete"
          onConfirm={() => confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {isLoading ? <div className="text-slate-500 text-sm">Loading…</div> : rooms.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 text-sm">No rooms yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rooms.map((room) => (
            <div key={room.id}>
              {editing?.id === room.id ? (
                <RoomForm initial={room} onSave={(d) => handleUpdate(room, d)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="card px-4 py-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                      <MapPin size={16} />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-100 transition-opacity">
                    <button aria-label={`Edit room ${room.name}`} onClick={() => { setEditing(room); setShowForm(false); }} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={13} /></button>
                    <button aria-label={`Delete room ${room.name}`} onClick={() => setDeleting(room)} className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
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
