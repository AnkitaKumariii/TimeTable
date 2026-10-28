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
  initialType?: 'theory' | 'lab';
}

interface TypePickerState {
  day: DayOfWeek;
  slot: TimeSlot;
  batchId: number;
  /** Groups that don't yet have a lab entry in this slot */
  availableGroups: BatchGroup[];
}

/** One display row = one batch (groups are stacked inside the cell, not as rows). */
type GridRow = { batch: Batch };

// ── Column sizing ─────────────────────────────────────────────────────────────

const DAY_COL_W   = 90;   // px – sticky left-0
const BATCH_COL_W = 155;  // px – sticky left-[DAY_COL_W]
const SLOT_COL_W  = 185;  // px – slightly wider for stacked labs

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

    const sortedSlots = useMemo(
      () => [...slots].sort((a, b) => a.sort_order - b.sort_order),
      [slots],
    );

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
        map.set(batch.id, q?.isSuccess ? (q.data ?? []) : undefined);
      });
      return map;
    }, [batches, groupQueries]);

    const groupsLoading = groupQueries.some((q) => q.isPending);

    const batchesToShow = useMemo(
      () => filterBatchId !== null ? batches.filter((b) => b.id === filterBatchId) : batches,
      [batches, filterBatchId],
    );

    const gridRows = useMemo<GridRow[]>(
      () => batchesToShow.map((batch) => ({ batch })),
      [batchesToShow],
    );

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

    function getBatchCellEntries(day: DayOfWeek, slotId: number, batchId: number) {
      const batchEntries = getSlotEntries(day, slotId).filter((e) => e.batch_id === batchId);
      const theory = batchEntries.find((e) => e.group_id == null) ?? null;
      // Sort labs deterministically by group_id so consecutive slots stack groups in identical vertical order
      const labs   = batchEntries
        .filter((e) => e.group_id != null)
        .sort((a, b) => (a.group_id ?? 0) - (b.group_id ?? 0));
      return { theory, labs };
    }

    /** Calculates span info for consecutive multi-slot classes across columns. */
    function getSpanInfo(day: DayOfWeek, slotIdx: number, entry: TimetableEntry) {
      let startIdx = slotIdx;
      while (startIdx > 0) {
        const prevSlot = sortedSlots[startIdx - 1];
        const currSlot = sortedSlots[startIdx];
        if (!prevSlot || prevSlot.is_break || prevSlot.sort_order !== currSlot.sort_order - 1) break;
        const hasPrev = getSlotEntries(day, prevSlot.id).some(
          (e) =>
            e.batch_id === entry.batch_id &&
            e.subject_id === entry.subject_id &&
            e.group_id === entry.group_id,
        );
        if (!hasPrev) break;
        startIdx--;
      }

      let endIdx = slotIdx;
      while (endIdx < sortedSlots.length - 1) {
        const nextSlot = sortedSlots[endIdx + 1];
        const currSlot = sortedSlots[endIdx];
        if (!nextSlot || nextSlot.is_break || nextSlot.sort_order !== currSlot.sort_order + 1) break;
        const hasNext = getSlotEntries(day, nextSlot.id).some(
          (e) =>
            e.batch_id === entry.batch_id &&
            e.subject_id === entry.subject_id &&
            e.group_id === entry.group_id,
        );
        if (!hasNext) break;
        endIdx++;
      }

      const totalSlots = endIdx - startIdx + 1;
      const currentSlotIndex = slotIdx - startIdx + 1;

      let spanState: 'single' | 'start' | 'middle' | 'end' = 'single';
      if (totalSlots > 1) {
        if (currentSlotIndex === 1) spanState = 'start';
        else if (currentSlotIndex === totalSlots) spanState = 'end';
        else spanState = 'middle';
      }

      return { totalSlots, currentSlotIndex, spanState };
    }

    function handleAddClick(day: DayOfWeek, slot: TimeSlot, batch: Batch) {
      if (slot.is_break) return;
      const groups = groupsByBatch.get(batch.id) ?? [];
      if (groups.length === 0) {
        setModal({ cell: { day, slotId: slot.id, batchId: batch.id, initialType: 'theory' } });
      } else {
        const { labs } = getBatchCellEntries(day, slot.id, batch.id);
        const availableGroups = groups.filter((g) => !labs.some((l) => l.group_id === g.id));
        setTypePicker({ day, slot, batchId: batch.id, availableGroups });
      }
    }

    function handleLabAddClick(day: DayOfWeek, slot: TimeSlot, batch: Batch, availableGroups: BatchGroup[]) {
      if (availableGroups.length === 0) return;
      const nextGroup = availableGroups[0];
      setModal({
        cell: { day, slotId: slot.id, batchId: batch.id, groupId: nextGroup.id, initialType: 'lab' },
      });
    }

    const rowsPerDay = gridRows.length;
    const totalWidth =
      DAY_COL_W +
      BATCH_COL_W +
      sortedSlots.reduce((sum, s) => sum + (s.is_break ? 44 : SLOT_COL_W), 0);

    return (
      <>
        <div className="flex md:hidden items-center gap-2 mb-3 px-1">
          <span className="text-xs text-slate-500 italic">
            Scroll horizontally to view all periods →
          </span>
        </div>

        <div ref={ref} className="overflow-x-auto rounded-xl border border-slate-200 card">
          <table className="border-collapse" style={{ minWidth: totalWidth }}>
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th
                  className="sticky left-0 z-20 bg-white px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200"
                  style={{ minWidth: DAY_COL_W }}
                >
                  Day
                </th>
                <th
                  className="sticky z-20 bg-white px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200"
                  style={{ minWidth: BATCH_COL_W, left: DAY_COL_W }}
                >
                  Batch
                </th>
                {sortedSlots.map((slot) => (
                  <th
                    key={slot.id}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-r border-slate-200 last:border-r-0 ${slot.is_break ? 'text-amber-700 bg-amber-50' : 'text-slate-600'}`}
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

            <tbody>
              {activeDays.flatMap((day, dayIdx) => {
                const dayBg = dayIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

                return gridRows.map((row, rowIdx) => {
                  const isFirst = rowIdx === 0;
                  const isLast  = rowIdx === rowsPerDay - 1;
                  const groups  = groupsByBatch.get(row.batch.id) ?? [];

                  return (
                    <tr
                      key={`${day}-${row.batch.id}`}
                      className={`border-b border-slate-100 ${isLast ? 'border-b-2 border-b-slate-300' : ''} last:border-b-0`}
                      style={{ backgroundColor: dayBg }}
                    >
                      {isFirst && (
                        <td
                          rowSpan={rowsPerDay}
                          className="sticky left-0 z-10 px-3 border-r border-slate-200 text-sm font-bold text-slate-700 whitespace-nowrap align-middle"
                          style={{ backgroundColor: dayBg, verticalAlign: 'middle' }}
                        >
                          {day}
                        </td>
                      )}

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
                            {groupsLoading && (
                              <div className="mt-0.5 h-2.5 w-14 rounded bg-slate-200 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </td>

                      {sortedSlots.map((slot, slotIdx) => {
                        if (slot.is_break) {
                          return (
                            <td
                              key={slot.id}
                              className="border-r border-slate-200 last:border-r-0 bg-amber-50"
                              style={{ minWidth: 44 }}
                            />
                          );
                        }

                        const { theory, labs } = getBatchCellEntries(day, slot.id, row.batch.id);
                        const availableGroups  = groups.filter((g) => !labs.some((l) => l.group_id === g.id));
                        const allGroupsFilled  = groups.length > 0 && availableGroups.length === 0;

                        return (
                          <td
                            key={slot.id}
                            className="border-r border-slate-200 last:border-r-0 align-top px-1.5 py-1.5"
                          >
                            {theory ? (
                              (() => {
                                const span = getSpanInfo(day, slotIdx, theory);
                                return (
                                  <EntryCard
                                    entry={theory}
                                    spanState={span.spanState}
                                    spanIndex={span.currentSlotIndex}
                                    totalSpan={span.totalSlots}
                                    onClick={() => setModal({ entry: theory })}
                                  />
                                );
                              })()
                            ) : labs.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {labs.map((lab) => {
                                  const span = getSpanInfo(day, slotIdx, lab);
                                  return (
                                    <EntryCard
                                      key={lab.id}
                                      entry={lab}
                                      showGroupBadge
                                      spanState={span.spanState}
                                      spanIndex={span.currentSlotIndex}
                                      totalSpan={span.totalSlots}
                                      onClick={() => setModal({ entry: lab })}
                                    />
                                  );
                                })}
                                {/* Secondary + button for next available group */}
                                <button
                                  disabled={allGroupsFilled}
                                  onClick={() => !allGroupsFilled && handleLabAddClick(day, slot, row.batch, availableGroups)}
                                  title={allGroupsFilled ? 'All groups are already scheduled' : `Add lab for ${availableGroups[0]?.name ?? 'next group'}`}
                                  className={`w-full flex items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-all duration-150 ${allGroupsFilled ? 'border-slate-100 text-slate-200 cursor-not-allowed' : 'border-violet-300 text-violet-400 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50/50 cursor-pointer group'}`}
                                  style={{ minHeight: '28px' }}
                                >
                                  <Plus size={11} className={!allGroupsFilled ? 'group-hover:scale-110 transition-transform' : ''} />
                                  <span className="text-[10px]">
                                    {allGroupsFilled ? 'All groups filled' : `${availableGroups[0]?.name ?? 'Group'} lab`}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddClick(day, slot, row.batch)}
                                className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 text-slate-300 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50/50 transition-all duration-150 text-xs group"
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

        {typePicker && (
          <TypePickerModal
            hasGroups={typePicker.availableGroups.length > 0}
            onTheory={() => {
              const p = typePicker;
              setTypePicker(null);
              setModal({ cell: { day: p.day, slotId: p.slot.id, batchId: p.batchId, initialType: 'theory' } });
            }}
            onLab={() => {
              const p = typePicker;
              setTypePicker(null);
              setModal({
                cell: { day: p.day, slotId: p.slot.id, batchId: p.batchId, initialType: 'lab' },
              });
            }}
            onClose={() => setTypePicker(null)}
          />
        )}

        {modal && (
          <EntryModal
            existingEntry={modal.entry ?? null}
            defaultDay={modal.cell?.day}
            defaultSlotId={modal.cell?.slotId}
            defaultBatchId={modal.cell?.batchId}
            defaultGroupId={modal.cell?.groupId}
            defaultType={modal.cell?.initialType}
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
  onTheory,
  onLab,
  hasGroups,
  onClose,
}: {
  onTheory: () => void;
  onLab: () => void;
  hasGroups: boolean;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-800">Add Class</h3>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Is this a theory class (shared by all groups) or a lab session for a specific group?
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onTheory}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all duration-150 group"
          >
            <BookOpen size={28} className="text-brand-500 group-hover:scale-110 transition-transform" />
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">Theory</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">Shared by all groups</div>
            </div>
          </button>

          <button
            onClick={hasGroups ? onLab : undefined}
            disabled={!hasGroups}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all duration-150 group ${hasGroups ? 'border-slate-200 hover:border-violet-400 hover:bg-violet-50 cursor-pointer' : 'border-slate-100 opacity-40 cursor-not-allowed'}`}
          >
            <FlaskConical size={28} className={hasGroups ? 'text-violet-500 group-hover:scale-110 transition-transform' : 'text-slate-400'} />
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">Lab</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                {hasGroups ? 'Per group session' : 'Add groups in Settings'}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onClick,
  showGroupBadge = false,
  spanState = 'single',
  spanIndex = 1,
  totalSpan = 1,
}: {
  entry: TimetableEntry;
  onClick: () => void;
  showGroupBadge?: boolean;
  spanState?: 'single' | 'start' | 'middle' | 'end';
  spanIndex?: number;
  totalSpan?: number;
}) {
  const bgColor     = hexAlpha(entry.subject.color, 0.13);
  const borderColor = hexAlpha(entry.subject.color, 0.3);
  const textColor   = entry.subject.color;
  const batchBg     = hexAlpha(entry.batch.color, 0.2);
  const batchText   = isLightColor(entry.batch.color) ? darken(entry.batch.color, 0.5) : entry.batch.color;

  const isTheory = entry.group_id == null;

  const isStart = spanState === 'start';
  const isMiddle = spanState === 'middle';
  const isEnd = spanState === 'end';
  const isSpanned = isStart || isMiddle || isEnd;

  let borderRadius = '8px';
  if (isStart) borderRadius = '8px 0 0 8px';
  else if (isMiddle) borderRadius = '0px';
  else if (isEnd) borderRadius = '0 8px 8px 0';

  const cardStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius,
    position: 'relative',
  };

  if (isStart) {
    cardStyle.borderRight = 'none';
    cardStyle.marginRight = '-7px';
    cardStyle.zIndex = 10;
  } else if (isMiddle) {
    cardStyle.borderLeft = 'none';
    cardStyle.borderRight = 'none';
    cardStyle.marginLeft = '-7px';
    cardStyle.marginRight = '-7px';
    cardStyle.zIndex = 10;
  } else if (isEnd) {
    cardStyle.borderLeft = 'none';
    cardStyle.marginLeft = '-7px';
    cardStyle.zIndex = 10;
  }

  return (
    <div
      onClick={onClick}
      className={`entry-card flex flex-col gap-1 p-2.5 cursor-pointer ${
        isSpanned ? 'hover:scale-100 hover:shadow-md hover:brightness-[0.98]' : ''
      }`}
      style={cardStyle}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold leading-tight truncate flex items-center gap-1" style={{ color: textColor }}>
          {isMiddle || isEnd ? (
            <>
              <span className="opacity-50 text-[10px]">→</span>
              <span>{entry.subject.short_code}</span>
            </>
          ) : (
            entry.subject.short_code
          )}
        </span>
        {isSpanned && (isMiddle || isEnd) ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100/90 text-violet-700 font-semibold flex-shrink-0">
            Cont. ({spanIndex}/{totalSpan})
          </span>
        ) : isTheory ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
            {totalSpan > 1 ? `Theory • ${totalSpan}h` : 'Theory'}
          </span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold flex-shrink-0">
            {totalSpan > 1 ? `Lab • ${totalSpan}h` : 'Lab'}
          </span>
        )}
      </div>

      <span className="text-[10px] text-slate-600 leading-tight truncate">{entry.subject.name}</span>

      {showGroupBadge && entry.group && (
        <span
          className="badge self-start text-[10px] px-1.5 py-0.5 mt-0.5 rounded-full font-semibold"
          style={{ backgroundColor: batchBg, color: batchText }}
        >
          {entry.group.name}
        </span>
      )}

      <div className="flex flex-col gap-1 w-full mt-0.5">
        {entry.faculties.map((faculty) => (
          <div key={faculty.id} className="flex items-center gap-1.5 text-xs">
            <div
              className={`flex-shrink-0 w-7 h-4 flex items-center justify-center rounded-sm text-[9px] font-bold tracking-wider ${faculty.role === 'teaching_assistant' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}
            >
              {faculty.role === 'teaching_assistant' ? 'TA' : 'Prof.'}
            </div>
            <span className="text-slate-700 truncate flex-1">{faculty.name}</span>
          </div>
        ))}
      </div>

      <span className="text-[10px] text-slate-500 leading-tight truncate flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0" />
        <span className="truncate">{entry.room?.name || 'Unassigned'}</span>
      </span>
    </div>
  );
}
