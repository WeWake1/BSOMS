'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { buildPeriod, type Period, type PeriodPreset, toISODate, addDays } from '@/lib/stats-utils';

interface Props {
  period: Period;
  onChange: (p: Period) => void;
}

const PRESETS: { key: PeriodPreset; label: string; short: string }[] = [
  { key: 'this_week',     label: 'This week',      short: 'Week' },
  { key: 'last_month',    label: 'Last 30 days',   short: '30d' },
  { key: 'last_6_months', label: 'Last 6 months',  short: '6m' },
  { key: 'last_year',     label: 'Last year',      short: '1y' },
];

export function PeriodPicker({ period, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(period.from);
  const [customTo, setCustomTo] = useState(period.to);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [customOpen]);

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) return;
    onChange(buildPeriod('custom', { from: customFrom, to: customTo }));
    setCustomOpen(false);
  };

  const today = toISODate(new Date());

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-3 pb-3 bg-background/85 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center gap-1.5">
        {/* Scrolling preset chips — overflow-x clips its absolute children, so popover MUST live outside this div */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 -mx-1 px-1">
          {PRESETS.map(p => {
            const isActive = period.preset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => onChange(buildPeriod(p.key))}
                className={cn(
                  "shrink-0 h-9 px-3.5 rounded-full text-xs font-bold tracking-tight border transition-all duration-150 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                )}
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.short}</span>
              </button>
            );
          })}
        </div>

        {/* Custom dropdown — outside overflow context so popover renders correctly */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setCustomFrom(period.from);
              setCustomTo(period.to);
              setCustomOpen(v => !v);
            }}
            className={cn(
              "shrink-0 h-9 px-3.5 rounded-full text-xs font-bold tracking-tight border transition-all duration-150 active:scale-95 flex items-center gap-1.5",
              period.preset === 'custom'
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            )}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="hidden sm:inline">
              {period.preset === 'custom' ? `${period.from} → ${period.to}` : 'Custom'}
            </span>
            <span className="sm:hidden">
              {period.preset === 'custom' ? `${period.from.slice(5)}→${period.to.slice(5)}` : 'Custom'}
            </span>
          </button>

          {customOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full mt-2 w-[260px] bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in zoom-in-95 duration-150"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Custom range</p>
              <label className="block text-xs font-semibold text-foreground mb-1">From</label>
              <input
                type="date"
                value={customFrom}
                max={today}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <label className="block text-xs font-semibold text-foreground mb-1">To</label>
              <input
                type="date"
                value={customTo}
                max={today}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {customFrom && customTo && customFrom > customTo && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mb-2">
                  &quot;From&quot; must be on or before &quot;To&quot;.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setCustomFrom(addDays(today, -29)); setCustomTo(today); }}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Reset
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setCustomOpen(false)}
                  className="h-8 px-3 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCustom}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="h-8 px-3 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
