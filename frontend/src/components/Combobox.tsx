import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ComboboxOption {
  value: number | string;
  label: string;
  sublabel?: string;
  color?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: number | string | null;
  onChange: (value: number | string) => void;
  placeholder?: string;
  onAddNew?: (query: string) => void;
  addNewLabel?: string;
  disabled?: boolean;
  id?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  onAddNew,
  addNewLabel = 'Add new',
  disabled,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleSelect(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function handleAddNew() {
    onAddNew?.(query);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'input w-full flex items-center justify-between text-left pr-2 h-9',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'border-brand-500 ring-1 ring-brand-500/40',
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            />
          )}
          <span className={cn(selected ? 'text-slate-200' : 'text-slate-500')}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.sublabel && (
            <span className="text-slate-500 text-xs">{selected.sublabel}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-slate-500 flex-shrink-0 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full card shadow-2xl border-[#3d4168] animate-slide-up overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[#2d3148]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="input text-xs pl-7 h-7 py-0"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                  if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0]);
                }}
              />
            </div>
          </div>

          {/* Options */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !onAddNew && (
              <li className="px-3 py-2 text-xs text-slate-500">No results</li>
            )}
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left',
                    'hover:bg-white/5 transition-colors',
                    opt.value === value && 'bg-brand-500/10 text-brand-300',
                  )}
                >
                  {opt.color && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-auto text-xs text-slate-500 flex-shrink-0">
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              </li>
            ))}

            {/* Add new */}
            {onAddNew && (
              <li>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-400
                             hover:bg-brand-500/10 transition-colors border-t border-[#2d3148] mt-1 pt-2"
                >
                  <Plus size={13} />
                  {addNewLabel}
                  {query && ` "${query}"`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
