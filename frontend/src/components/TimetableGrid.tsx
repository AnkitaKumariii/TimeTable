import { useState } from 'react';
import { Plus, CoffeeIcon } from 'lucide-react';
import type { DayOfWeek, TimeSlot, TimetableEntry } from '../types';
import { hexAlpha, fmtSlotRange } from '../lib/utils';
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
  filterBatchId: number | null;
}

export function TimetableGrid({
  entries,
  slots,
  activeDays,
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

  function openCell(day: DayOfWeek, slot: TimeSlot, existingEntry?: TimetableEntry) {
    if (slot.is_break) return;
    if (existingEntry) {
      setModal({ entry: existingEntry });
    } else {
      setModal({ cell: { day, slotId: slot.id, batchId: filterBatchId ?? undefined } });
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

      <div className="overflow-x-auto rounded-xl border border-[#2d3148] card">
        <table className="border-collapse" style={{ minWidth: dayColWidth + sortedSlots.length * colWidth }}>
          <thead>
            <tr className="border-b border-[#2d3148]">
              {/* Corner */}
              <th
                className="sticky left-0 z-20 bg-[#1a1d27] px-4 py-3 text-left text-xs font-semibold
                           text-slate-500 uppercase tracking-wider whitespace-nowrap border-r border-[#2d3148]"
                style={{ minWidth: dayColWidth }}
              >
                Day / Period
              </th>
              {sortedSlots.map((slot) => (
                <th
                  key={slot.id}
                  className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider
                             whitespace-nowrap border-r border-[#2d3148] last:border-r-0
                             ${slot.is_break ? 'text-amber-400/70 bg-amber-500/5' : 'text-slate-400'}`}
                  style={{ minWidth: colWidth }}
                >
                  <span className="block">{slot.label}</span>
                  <span className={`block font-normal normal-case tracking-normal mt-0.5
                    ${slot.is_break ? 'text-amber-400/50' : 'text-slate-500'}`}>
                    {fmtSlotRange(slot.start_time, slot.end_time)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day, rowIdx) => (
              <tr
                key={day}
                className={`border-b border-[#2d3148] last:border-b-0 ${rowIdx % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
              >
                {/* Day label */}
                <td
                  className="sticky left-0 z-10 px-4 py-3 border-r border-[#2d3148]
                             bg-[#1a1d27] text-sm font-semibold text-slate-300 whitespace-nowrap"
                  style={rowIdx % 2 !== 0 ? { backgroundColor: 'rgba(255,255,255,0.015)' } : {}}
                >
                  {day}
                </td>
                {sortedSlots.map((slot) => {
                  if (slot.is_break) {
                    return (
                      <td
                        key={slot.id}
                        className="px-2 py-2 border-r border-[#2d3148] last:border-r-0
                                   bg-amber-500/5 text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5 text-amber-500/50">
                          <CoffeeIcon size={13} />
                          <span className="text-xs">Break</span>
                        </div>
                      </td>
                    );
                  }

                  const cellEntries = getEntries(day, slot.id);
                  const isEmpty = cellEntries.length === 0;

                  return (
                    <td
                      key={slot.id}
                      className="px-2 py-2 border-r border-[#2d3148] last:border-r-0 align-top"
                      style={{ minHeight: 80 }}
                    >
                      <div className="flex flex-col gap-1.5 min-h-[60px]">
                        {cellEntries.map((entry) => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            onClick={() => openCell(day, slot, entry)}
                          />
                        ))}
                        {(isEmpty || !filterBatchId) && (
                          <button
                            onClick={() => openCell(day, slot)}
                            className={`flex items-center justify-center gap-1 rounded-lg border border-dashed
                                       transition-all duration-150 text-xs group
                                       ${isEmpty
                                         ? 'border-[#2d3148] text-slate-600 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 min-h-[56px]'
                                         : 'border-[#2d3148] text-slate-600 hover:border-brand-500/40 hover:text-brand-400 h-6'
                                       }`}
                          >
                            <Plus size={12} className="group-hover:scale-110 transition-transform" />
                            {isEmpty && <span>Add</span>}
                          </button>
                        )}
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
  const batchText = entry.batch.color;

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
      <span className="text-[10px] text-slate-300/80 leading-tight truncate">
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
      <span className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">
        {entry.faculty.name}
      </span>
    </div>
  );
}
