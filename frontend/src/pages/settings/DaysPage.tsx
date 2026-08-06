import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getActiveDays, setActiveDays } from '../../api';
import type { DayOfWeek } from '../../types';
import { ALL_DAYS } from '../../lib/utils';

export function DaysPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['active-days'], queryFn: getActiveDays });
  const [selected, setSelected] = useState<DayOfWeek[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.active_days) setSelected(data.active_days);
  }, [data]);

  function toggle(day: DayOfWeek) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    // Sort by canonical order
    const ordered = ALL_DAYS.filter((d) => selected.includes(d)) as DayOfWeek[];
    setSaving(true);
    try {
      await setActiveDays(ordered);
      qc.invalidateQueries({ queryKey: ['active-days'] });
      toast.success('Active days updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-100">Active Days</h2>
        <p className="text-sm text-slate-500">Choose which days are shown in the timetable grid.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {ALL_DAYS.map((day) => {
          const active = selected.includes(day as DayOfWeek);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day as DayOfWeek)}
              className={`card px-4 py-3 flex items-center justify-between transition-all border
                ${active
                  ? 'border-brand-500/60 bg-brand-500/10 text-brand-300'
                  : 'border-[#2d3148] text-slate-500 hover:text-slate-300 hover:border-[#3d4168]'
                }`}
            >
              <span className="text-sm font-medium">{day}</span>
              {active && <Check size={14} className="text-brand-400" />}
            </button>
          );
        })}
      </div>

      <button onClick={handleSave} disabled={saving || selected.length === 0} className="btn btn-primary">
        <Save size={14} />
        {saving ? 'Saving…' : 'Save Active Days'}
      </button>
      {selected.length === 0 && (
        <p className="text-xs text-red-400 mt-2">Select at least one day.</p>
      )}
    </div>
  );
}
