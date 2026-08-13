import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, RefreshCw } from 'lucide-react';
import { getActiveDays, getBatches, getEntries, getTimeSlots } from '../api';
import { TimetableGrid } from '../components/TimetableGrid';
import type { Batch, DayOfWeek } from '../types';

type FilterMode = 'all' | number;

export function TimetablePage() {
  const [filterBatch, setFilterBatch] = useState<FilterMode>('all');
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: getBatches });
  const { data: slots = [] } = useQuery({ queryKey: ['time-slots'], queryFn: getTimeSlots });
  const { data: activeDaysData } = useQuery({ queryKey: ['active-days'], queryFn: getActiveDays });

  const activeDays: DayOfWeek[] = activeDaysData?.active_days ?? [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  ];

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['timetable-entries', filterBatch],
    queryFn: () => getEntries(filterBatch !== 'all' ? { batch_id: filterBatch } : {}),
    refetchOnWindowFocus: true,
  });

  const selectedBatch: Batch | undefined = batches.find((b) => b.id === filterBatch);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays size={22} className="text-brand-600" />
            Weekly Timetable
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Click any cell to add or edit a class entry
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="btn-ghost p-2 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-brand-600' : ''} />
          </button>

          {/* Batch filter */}
          <div className="relative">
            <button
              id="batch-filter-btn"
              onClick={() => setShowBatchMenu(!showBatchMenu)}
              className="btn btn-secondary min-w-[160px] justify-between"
              style={selectedBatch ? { borderColor: `${selectedBatch.color}60` } : {}}
            >
              <span className="flex items-center gap-2">
                {selectedBatch && (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedBatch.color }}
                  />
                )}
                {filterBatch === 'all' ? 'All Batches' : selectedBatch?.name}
              </span>
              <ChevronDown size={13} className={showBatchMenu ? 'rotate-180' : ''} />
            </button>

            {showBatchMenu && (
              <div className="absolute right-0 mt-1 w-52 card shadow-xl border-slate-300 z-30 animate-slide-up overflow-hidden">
                <ul className="py-1">
                  <li>
                    <button
                      onClick={() => { setFilterBatch('all'); setShowBatchMenu(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100
                        ${filterBatch === 'all' ? 'text-brand-600 bg-brand-500/10' : 'text-slate-600'}`}
                    >
                      All Batches
                    </button>
                  </li>
                  {batches.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => { setFilterBatch(b.id); setShowBatchMenu(false); }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5
                          transition-colors hover:bg-slate-100
                          ${filterBatch === b.id ? 'text-brand-600 bg-brand-500/10' : 'text-slate-600'}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        {b.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      {slots.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarDays size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No time slots configured</p>
          <p className="text-slate-500 text-sm mt-1">
            Go to <strong>Settings → Time Slots</strong> to add periods first.
          </p>
        </div>
      ) : (
        <TimetableGrid
          entries={entries}
          slots={slots}
          activeDays={activeDays}
          batches={batches}
          filterBatchId={filterBatch === 'all' ? null : filterBatch}
        />
      )}
    </div>
  );
}
