import { forwardRef, useMemo, useState } from 'react';
import { BookOpen, CoffeeIcon, FlaskConical, Plus, X } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import type { Batch, BatchGroup, DayOfWeek, TimeSlot, TimetableEntry } from '../types';
import { darken, fmtSlotRange, hexAlpha, isLightColor } from '../lib/utils';
import { EntryModal } from './EntryModal';
import { getBatchGroups } from '../api';

// ── Internal types ─────────────────────────────────────────────────────────────

interface CellTarget {
  day: DayOfWeek;
  slotId: number;
  batchId?: number;
  groupId?: number;
}

interface TypePickerState {
  day: DayOfWeek;
  slot: TimeSlot;
  batchId: number;
  groupId: number; // the specific group whose row was clicked
}

/** One display row = a (batch, group?) pair, rendered for every active day. */
type GridRow = { batch: Batch; group: BatchGroup | null };

// ── Column sizing ─────────────────────────────────────────────────────────────

const DAY_COL_W   = 90;   // px – sticky left-0
const BATCH_COL_W = 155;  // px – sticky left-[DAY_COL_W]
const SLOT_COL_W  = 175;  // px – each time-slot column

// ── TimetableGrid ─────────────────────────────────────────────────────────────

interface TimetableGridProps {
  entries: TimetableEntry[];
  slots: TimeSlot[];
  activeDays: DayOfWeek[];
  batches: Batch[];
  filterBatchId: number | null;
}

export const TimetableGrid = forwardRef<HTMLDivElement, TimetableGridProps>(
  function TimetableGrid({ entries, slots, activeDays, batches, filterBatchId }, ref) {
    const [modal, setModal] = useState<{
      entry?: TimetableEntry | null;
      cell?: CellTarget;
    } | null>(null);

    const [typePicker, setTypePicker] = useState<TypePickerState | null>(null);

    // Sorted slots (memoised)
    const sortedSlots = useMemo(
      () => [...slots].sort((a, b) => a.sort_order - b.sort_order),
      [slots],
    );

    // Fetch groups for every batch in parallel – cached per batch
    const groupQueries = useQueries({
      queries: batches.map((batch) => ({
        queryKey: ['batch-groups', batch.id],
        queryFn:  () => getBatchGroups(batch.id),
        staleTime: 60_000,
      })),
    });

    const groupsByBatch = useMemo(() => {
      const map = new Map<number, BatchGroup[] | undefined>();
      batches.forEach((batch, i) => {
        const q = groupQueries[i];
        // Keep undefined while the query is still loading so gridRows
        // doesn't prematurely collapse the batch to a no-group row and
        // invalidate the rowSpan on the Day cell.
        map.set(batch.id, q?.isSuccess ? (q.data ?? []) : undefined);
      });
      return map;
    }, [batches, groupQueries]);

    // True while any group query is still pending (first load only)
    const groupsLoading = groupQueries.some((q) => q.isPending);

    // Batches visible in this view
    const batchesToShow = useMemo(
      () => filterBatchId !== null ? batches.filter((b) => b.id === filterBatchId) : batches,
      [batches, filterBatchId],
    );

    /**
     * Flat list of (batch, group|null) rows – the same ordering is reused for
     * every active day, and the "Day" cell uses rowSpan to span all rows.
     */
    const gridRows = useMemo<GridRow[]>(
      () =>
        batchesToShow.flatMap((batch) => {
          // While groups are still loading, treat as no-group to keep rowSpan stable;
          // the pending indicator on the batch cell signals the transient state.
          const groups = groupsByBatch.get(batch.id) ?? [];
          if (groups.length > 0) return groups.map((group) => ({ batch, group }));
          return [{ batch, group: null }];
        }),
      [batchesToShow, groupsByBatch],
    );

    // Lookup: "day:slotId" → TimetableEntry[]
    const lookup = useMemo(() => {
      const map = new Map<string, TimetableEntry[]>();
      for (const e of entries) {
        const key = `${e.day}:${e.time_slot_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
      return map;
    }, [entries]);

    function getSlotEntries(day: DayOfWeek, slotId: number) {
      return lookup.get(`${day}:${slotId}`) ?? [];
    }

    /**
     * Return the entry relevant to this (day, batch, group, slot):
     *  - A theory entry (group_id = null) takes precedence – it applies to ALL rows.
     *  - Otherwise a lab entry matching this specific group.
     *  - For no-group batches, the first matching entry.
     */
    function getCellEntry(
      day: DayOfWeek,
      slotId: number,
      batchId: number,
      groupId: number | null,
    ): TimetableEntry | null {
      const batchEntries = getSlotEntries(day, slotId).filter((e) => e.batch_id === batchId);
      const theory = batchEntries.find((e) => e.group_id == null);
      if (theory) return theory;
      if (groupId != null) return batchEntries.find((e) => e.group_id === groupId) ?? null;
      return batchEntries[0] ?? null;
    }

    function handleCellClick(day: DayOfWeek, slot: TimeSlot, row: GridRow) {
      if (slot.is_break) return;
      const entry = getCellEntry(day, slot.id, row.batch.id, row.group?.id ?? null);
      if (entry) {
        // Edit existing
        setModal({ entry });
      } else if (row.group != null) {
        // Group row is empty → ask Theory or Lab first
        setTypePicker({ day, slot, batchId: row.batch.id, groupId: row.group.id });
      } else {
        // No-group batch, empty → open modal directly
        setModal({ cell: { day, slotId: slot.id, batchId: row.batch.id } });
      }
    }

    const rowsPerDay = gridRows.length;
    const totalWidth =
      DAY_COL_W +
      BATCH_COL_W +
      sortedSlots.reduce((sum, s) => sum + (s.is_break ? 44 : SLOT_COL_W), 0);

    return (
      <>
        {/* Mobile scroll hint */}
        <div className="flex md:hidden items-center gap-2 mb-3 px-1">
          <span className="text-xs text-slate-500 italic">
            Scroll horizontally to view all periods →
          </span>
        </div>

        <div ref={ref} className="overflow-x-auto rounded-xl border border-slate-200 card">
          <table className="border-collapse" style={{ minWidth: totalWidth }}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <thead>
              <tr className="border-b-2 border-slate-200">
                {/* Day corner */}
                <th
                  className="sticky left-0 z-20 bg-white px-3 py-3 text-left text-xs font-semibold
                             text-slate-500 uppercase tracking-wider border-r border-slate-200"
                  style={{ minWidth: DAY_COL_W }}
                >
                  Day
                </th>
                {/* Batch corner */}
                <th
                  className="sticky z-20 bg-white px-3 py-3 text-left text-xs font-semibold
                             text-slate-500 uppercase tracking-wider border-r border-slate-200"
                  style={{ minWidth: BATCH_COL_W, left: DAY_COL_W }}
                >
                  Batch / Group
                </th>
                {/* Slot headers */}
                {sortedSlots.map((slot) => (
                  <th
                    key={slot.id}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider
                               whitespace-nowrap border-r border-slate-200 last:border-r-0
                               ${slot.is_break ? 'text-amber-700 bg-amber-50' : 'text-slate-600'}`}
                    style={{ minWidth: slot.is_break ? 44 : SLOT_COL_W }}
                  >
                    {slot.is_break ? (
                      <div className="flex items-center justify-center">
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

            {/* ── Body ───────────────────────────────────────────────────────── */}
            <tbody>
              {activeDays.flatMap((day, dayIdx) => {
                const dayBg = dayIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

                return gridRows.map((row, rowIdx) => {
                  const isFirst = rowIdx === 0;
                  const isLast  = rowIdx === rowsPerDay - 1;

                  return (
                    <tr
                      key={`${day}-${row.batch.id}-${row.group?.id ?? 'none'}`}
                      className={`border-b border-slate-100 ${isLast ? 'border-b-2 border-b-slate-300' : ''} last:border-b-0`}
                      style={{ backgroundColor: dayBg }}
                    >
                      {/* Day cell – spans all rows in this day group */}
                      {isFirst && (
                        <td
                          rowSpan={rowsPerDay}
                          className="sticky left-0 z-10 px-3 border-r border-slate-200 text-sm
                                     font-bold text-slate-700 whitespace-nowrap align-middle"
                          style={{ backgroundColor: dayBg, verticalAlign: 'middle' }}
                        >
                          {day}
                        </td>
                      )}

                      {/* Batch / Group cell */}
                      <td
                        className="sticky z-10 px-3 py-2 border-r border-slate-200 align-middle"
                        style={{ left: DAY_COL_W, minWidth: BATCH_COL_W, backgroundColor: dayBg }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                            style={{ backgroundColor: row.batch.color }}
                          />
                          <div className="min-w-0 leading-tight">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {row.batch.name}
                            </div>
                            {row.group ? (
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {row.group.name}
                              </div>
                            ) : groupsLoading ? (
                              // Groups query still in-flight — show a shimmer placeholder
                              <div className="mt-0.5 h-2.5 w-14 rounded bg-slate-200 animate-pulse" />
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Time-slot cells */}
                      {sortedSlots.map((slot) => {
                        if (slot.is_break) {
                          return (
                            <td
                              key={slot.id}
                              className="border-r border-slate-200 last:border-r-0 bg-amber-50"
                              style={{ minWidth: 44 }}
                            />
                          );
                        }

                        const entry = getCellEntry(
                          day, slot.id, row.batch.id, row.group?.id ?? null,
                        );

                        return (
                          <td
                            key={slot.id}
                            className="px-1.5 py-1.5 border-r border-slate-200 last:border-r-0 align-top"
                          >
                            {entry ? (
                              <EntryCard
                                entry={entry}
                                onClick={() => handleCellClick(day, slot, row)}
                              />
                            ) : (
                              <button
                                onClick={() => handleCellClick(day, slot, row)}
                                className="w-full flex items-center justify-center gap-1
                                           rounded-lg border border-dashed border-slate-200
                                           text-slate-300 hover:border-brand-400 hover:text-brand-500
                                           hover:bg-brand-50/50 transition-all duration-150 text-xs group"
                                style={{ minHeight: '52px' }}
                              >
                                <Plus size={11} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[11px]">Add</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {/* ── Theory / Lab picker ───────────────────────────────────────────── */}
        {typePicker && (
          <TypePickerModal
            picker={typePicker}
            onTheory={() => {
              const p = typePicker;
              setTypePicker(null);
              // Theory → no group pre-selected, covers all groups automatically
              setModal({ cell: { day: p.day, slotId: p.slot.id, batchId: p.batchId } });
            }}
            onLab={() => {
              const p = typePicker;
              setTypePicker(null);
              // Lab → pre-select the group whose row was clicked
              setModal({ cell: { day: p.day, slotId: p.slot.id, batchId: p.batchId, groupId: p.groupId } });
            }}
            onClose={() => setTypePicker(null)}
          />
        )}

        {/* ── Entry modal ───────────────────────────────────────────────────── */}
        {modal && (
          <EntryModal
            existingEntry={modal.entry ?? null}
            defaultDay={modal.cell?.day}
            defaultSlotId={modal.cell?.slotId}
            defaultBatchId={modal.cell?.batchId}
            defaultGroupId={modal.cell?.groupId}
            onClose={() => setModal(null)}
            onSaved={() => setModal(null)}
          />
        )}
      </>
    );
  },
);

// ── Theory / Lab type picker modal ────────────────────────────────────────────

function TypePickerModal({
  picker,
  onTheory,
  onLab,
  onClose,
}: {
  picker: TypePickerState;
  onTheory: () => void;
  onLab: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-800">Add Class</h3>
          <button
            onClick={onClose}
            className="btn-ghost p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Is this a theory class (shared by all groups) or a lab session for this group only?
        </p>

        {/* Choices */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onTheory}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2
                       border-slate-200 hover:border-brand-400 hover:bg-brand-50
                       transition-all duration-150 group"
          >
            <BookOpen
              size={28}
              className="text-brand-500 group-hover:scale-110 transition-transform"
            />
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">Theory</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                Fills all groups
              </div>
            </div>
          </button>

          <button
            onClick={onLab}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2
                       border-slate-200 hover:border-violet-400 hover:bg-violet-50
                       transition-all duration-150 group"
          >
            <FlaskConical
              size={28}
              className="text-violet-500 group-hover:scale-110 transition-transform"
            />
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">Lab</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                This group only
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onClick }: { entry: TimetableEntry; onClick: () => void }) {
  const bgColor    = hexAlpha(entry.subject.color, 0.13);
  const borderColor = hexAlpha(entry.subject.color, 0.3);
  const textColor  = entry.subject.color;
  const batchBg    = hexAlpha(entry.batch.color, 0.2);
  const batchText  = isLightColor(entry.batch.color)
    ? darken(entry.batch.color, 0.5)
    : entry.batch.color;

  const isTheory = entry.group_id == null;

  return (
    <div
      onClick={onClick}
      className="entry-card flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer"
      style={{ backgroundColor: bgColor, borderColor, borderWidth: '1px', borderStyle: 'solid' }}
    >
      {/* Subject */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold leading-tight truncate" style={{ color: textColor }}>
          {entry.subject.short_code}
        </span>
        {/* Theory / Lab badge */}
        {isTheory ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
            Theory
          </span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold flex-shrink-0">
            Lab
          </span>
        )}
      </div>

      <span className="text-[10px] text-slate-600 leading-tight truncate">
        {entry.subject.name}
      </span>

      {/* Group pill – only for lab entries */}
      {entry.group && (
        <span
          className="badge self-start text-[10px] px-1.5 py-0.5 mt-0.5 rounded-full"
          style={{ backgroundColor: batchBg, color: batchText }}
        >
          {entry.group.name}
        </span>
      )}

      {/* Faculty */}
      <div className="flex flex-col gap-1 w-full mt-0.5">
        {entry.faculties.map((faculty) => (
          <div key={faculty.id} className="flex items-center gap-1.5 text-xs">
            <div
              className={`flex-shrink-0 w-7 h-4 flex items-center justify-center rounded-sm text-[9px] font-bold tracking-wider 
              ${faculty.role === 'teaching_assistant'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {faculty.role === 'teaching_assistant' ? 'TA' : 'Prof.'}
            </div>
            <span className="text-slate-700 truncate flex-1">{faculty.name}</span>
          </div>
        ))}
      </div>

      {/* Room */}
      <span className="text-[10px] text-slate-500 leading-tight truncate flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0" />
        <span className="truncate">{entry.room?.name || 'Unassigned'}</span>
      </span>
    </div>
  );
}
