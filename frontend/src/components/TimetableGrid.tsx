import { useState } from 'react';
import { Plus, CoffeeIcon } from 'lucide-react';
import type { Batch, DayOfWeek, TimeSlot, TimetableEntry } from '../types';
import { hexAlpha, fmtSlotRange, isLightColor, darken } from '../lib/utils';
import { EntryModal } from './EntryModal';

interface CellTarget {
  day: DayOfWeek;
  slotId: number;
  batchId?: number;
}

interface TimetableGridProps {
  entries: TimetableEntry[];
  slots: TimeSlot[];
  activeDays: DayOfWeek[];
  batches: Batch[];
  filterBatchId: number | null;
}

export function TimetableGrid({
  entries,
  slots,
  activeDays,
  batches,
  filterBatchId,
}: TimetableGridProps) {
  const [modal, setModal] = useState<{
    entry?: TimetableEntry | null;
    cell?: CellTarget;
  } | null>(null);

  const sortedSlots = [...slots].sort((a, b) => a.sort_order - b.sort_order);

  // Build a lookup: day → slotId → TimetableEntry[]
  const lookup = new Map<string, TimetableEntry[]>();
  for (const e of entries) {
    const key = `${e.day}:${e.time_slot_id}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(e);
  }

  function getEntries(day: DayOfWeek, slotId: number): TimetableEntry[] {
    return lookup.get(`${day}:${slotId}`) ?? [];
  }

  function openCell(day: DayOfWeek, slot: TimeSlot, existingEntry?: TimetableEntry, batchIdOverride?: number) {
    if (slot.is_break) return;
    if (existingEntry) {
      setModal({ entry: existingEntry });
    } else {
      setModal({ cell: { day, slotId: slot.id, batchId: batchIdOverride ?? filterBatchId ?? undefined } });
    }
  }

  const colWidth = 180;
  const dayColWidth = 110;

  return (
    <>
      {/* Scroll hint on mobile */}
      <div className="flex md:hidden items-center gap-2 mb-3 px-1">
        <span className="text-xs text-slate-500 italic">
          Scroll horizontally to view all periods →
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 card">
        <table className="border-collapse" style={{ minWidth: dayColWidth + sortedSlots.length * colWidth }}>
          <thead>
            <tr className="border-b border-slate-200">
              {/* Corner */}
              <th
                className="sticky left-0 z-20 bg-white px-4 py-3 text-left text-xs font-semibold
                           text-slate-500 uppercase tracking-wider whitespace-nowrap border-r border-slate-200"
                style={{ minWidth: dayColWidth }}
              >
                Day / Period
              </th>
              {sortedSlots.map((slot) => (
                <th
                  key={slot.id}
                  className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider
                             whitespace-nowrap border-r border-slate-200 last:border-r-0
                             ${slot.is_break ? 'text-amber-700 bg-amber-50 px-1' : 'text-slate-600'}`}
                  style={{ minWidth: slot.is_break ? 40 : colWidth }}
                >
                  {slot.is_break ? (
                    <div className="flex items-center justify-center h-full">
                      <CoffeeIcon size={14} className="opacity-70" />
                    </div>
                  ) : (
                    <>
                      <span className="block">{slot.label}</span>
                      <span className="block font-normal normal-case tracking-normal mt-0.5 text-slate-500">
                        {fmtSlotRange(slot.start_time, slot.end_time)}
                      </span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day, rowIdx) => (
              <tr
                key={day}
                className={`border-b border-slate-200 last:border-b-0 ${rowIdx % 2 === 0 ? '' : 'bg-slate-50'}`}
              >
                {/* Day label */}
                <td
                  className="sticky left-0 z-10 px-4 py-3 border-r border-slate-200
                             bg-white text-sm font-semibold text-slate-700 whitespace-nowrap"
                  style={rowIdx % 2 !== 0 ? { backgroundColor: '#f8fafc' } : {}}
                >
                  {day}
                </td>
                {sortedSlots.map((slot) => {
                  if (slot.is_break) {
                    return (
                      <td
                        key={slot.id}
                        className="px-1 py-2 border-r border-slate-200 last:border-r-0
                                   bg-amber-50 text-center"
                      >
                      </td>
                    );
                  }

                  const cellEntries = getEntries(day, slot.id);
                  const isEmpty = cellEntries.length === 0;

                  return (
                    <td
                      key={slot.id}
                      className="px-2 py-2 border-r border-slate-200 last:border-r-0 align-top"
                      style={{ minHeight: 80 }}
                    >
                      <div className="flex flex-col gap-1 min-h-[60px]">
                        {/* Display existing entries */}
                        {cellEntries.map((entry) => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            onClick={() => openCell(day, slot, entry)}
                          />
                        ))}
                        
                        {/* If viewing a single batch, show one Add button if empty */}
                        {filterBatchId !== null && isEmpty && (
                          <button
                            onClick={() => openCell(day, slot)}
                            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-brand-500/50 hover:text-brand-600 hover:bg-brand-50 min-h-[56px] transition-all duration-150 text-xs group"
                          >
                            <Plus size={12} className="group-hover:scale-110 transition-transform" />
                            <span>Add</span>
                          </button>
                        )}

                        {/* If viewing All Batches, show templates for any batch that has no entry here */}
                        {filterBatchId === null && batches.map(batch => {
                          const hasEntry = cellEntries.some(e => e.batch.id === batch.id);
                          if (hasEntry) return null;
                          return (
                            <EmptyBatchCard
                              key={batch.id}
                              batch={batch}
                              onClick={() => openCell(day, slot, undefined, batch.id)}
                            />
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <EntryModal
          existingEntry={modal.entry ?? null}
          defaultDay={modal.cell?.day}
          defaultSlotId={modal.cell?.slotId}
          defaultBatchId={modal.cell?.batchId}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </>
  );
}

// ── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onClick }: { entry: TimetableEntry; onClick: () => void }) {
  const bgColor = hexAlpha(entry.subject.color, 0.15);
  const borderColor = hexAlpha(entry.subject.color, 0.35);
  const textColor = entry.subject.color;
  const batchBg = hexAlpha(entry.batch.color, 0.25);
  const batchText = isLightColor(entry.batch.color) ? darken(entry.batch.color, 0.5) : entry.batch.color;

  return (
    <div
      onClick={onClick}
      className="entry-card flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Subject name */}
      <span className="text-xs font-bold leading-tight truncate" style={{ color: textColor }}>
        {entry.subject.short_code}
      </span>
      <span className="text-[10px] text-slate-600 leading-tight truncate">
        {entry.subject.name}
      </span>

      {/* Batch pill */}
      <span
        className="badge self-start text-[10px] px-1.5 py-0.5 mt-0.5 rounded-full"
        style={{ backgroundColor: batchBg, color: batchText }}
      >
        {entry.batch.name}
      </span>

      {/* Faculty */}
      <span className="text-[10px] leading-tight truncate mt-0.5 flex items-center gap-1">
        <span className={`font-semibold px-1 py-0.5 rounded text-[9px] leading-none
          ${entry.faculty.role === 'teaching_assistant'
            ? 'bg-teal-100 text-teal-700'
            : 'bg-brand-100 text-brand-700'
          }`}>
          {entry.faculty.role === 'teaching_assistant' ? 'TA' : 'Prof.'}
        </span>
        <span className="text-slate-700 truncate">{entry.faculty.name}</span>
      </span>
    </div>
  );
}

// ── Empty Batch Card ──────────────────────────────────────────────────────────

function EmptyBatchCard({ batch, onClick }: { batch: Batch; onClick: () => void }) {
  const batchBg = hexAlpha(batch.color, 0.05);
  const borderColor = hexAlpha(batch.color, 0.4);
  const textColor = isLightColor(batch.color) ? darken(batch.color, 0.6) : darken(batch.color, 0.2);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1 py-1 px-1.5 rounded cursor-pointer border border-dashed group transition-all"
      style={{
        backgroundColor: batchBg,
        borderColor: borderColor,
        color: textColor,
        minHeight: '24px'
      }}
      title={`Add subject for ${batch.name}`}
    >
      <Plus size={10} className="group-hover:scale-125 transition-transform opacity-70" />
      <span className="text-[10px] font-semibold leading-none truncate">
        {batch.name}
      </span>
    </button>
  );
}
