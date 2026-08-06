import { AlertTriangle, XCircle, X } from 'lucide-react';
import type { ConflictingEntry } from '../types';

interface HardConflictProps {
  message: string;
  conflicting?: ConflictingEntry | null;
  onClose: () => void;
}

export function HardConflictAlert({ message, conflicting, onClose }: HardConflictProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-700 mb-1">Scheduling Conflict</p>
          <p className="text-xs text-red-700 leading-relaxed">{message}</p>
          {conflicting && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {conflicting.batch}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {conflicting.day}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {conflicting.time_slot}
              </span>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Change the faculty member or pick a different time slot to proceed.
          </p>
        </div>
        <button onClick={onClose} className="text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface SoftWarningProps {
  message: string;
  conflicting?: ConflictingEntry | null;
  onAddAnyway: () => void;
  onChooseDifferent: () => void;
  loading?: boolean;
}

export function SoftWarningAlert({
  message,
  conflicting,
  onAddAnyway,
  onChooseDifferent,
  loading,
}: SoftWarningProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-700 mb-1">Back-to-Back Warning</p>
          <p className="text-xs text-amber-600 leading-relaxed">{message}</p>
          {conflicting && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {conflicting.batch}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {conflicting.time_slot}
              </span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onAddAnyway}
              disabled={loading}
              className="btn btn-sm bg-amber-100 hover:bg-amber-200 text-amber-800
                         border border-amber-200 hover:border-amber-300 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Add Anyway'}
            </button>
            <button
              type="button"
              onClick={onChooseDifferent}
              className="btn btn-sm btn-secondary"
            >
              Choose Different Slot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
