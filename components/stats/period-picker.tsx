'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  buildPeriod, toISODate, addDays, toMonthKey, addMonths, parseMonthKey, monthLabel,
  type Period, type PeriodPreset,
} from '@/lib/stats-utils';

interface Props {
  period: Period;
  onChange: (p: Period) => void;
}

type DropdownKey = 'month' | 'year' | 'custom' | null;

const MONTH_OPTIONS_COUNT = 18; // current month + 17 prior
const YEAR_OPTIONS_COUNT = 6;   // current year + 5 prior

export function PeriodPicker({ period, onChange }: Props) {
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [customFrom, setCustomFrom] = useState(period.from);
  const [customTo, setCustomTo] = useState(period.to);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close any open dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const today = useMemo(() => new Date(), []);
  const todayIso = toISODate(today);
  const currentMonthKey = toMonthKey(today);
  const currentYear = today.getFullYear();

  // Derive selected month-key / year for display when active
  const selectedMonthKey = period.preset === 'month' ? period.from.slice(0, 7) : currentMonthKey;
  const selectedYear = period.preset === 'year' ? Number(period.from.slice(0, 4)) : currentYear;

  const monthOptions = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < MONTH_OPTIONS_COUNT; i++) arr.push(addMonths(currentMonthKey, -i));
    return arr;
  }, [currentMonthKey]);

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < YEAR_OPTIONS_COUNT; i++) arr.push(currentYear - i);
    return arr;
  }, [currentYear]);

  const applyCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onChange(buildPeriod('custom', { from: customFrom, to: customTo }));
    setOpenDropdown(null);
  };

  const applyLast6Months = () => {
    onChange(buildPeriod('custom', { from: addDays(todayIso, -181), to: todayIso }));
    setOpenDropdown(null);
  };

  // Active state helpers
  const isWeekActive = period.preset === 'week';
  const isMonthActive = period.preset === 'month';
  const isYearActive = period.preset === 'year';
  const isCustomActive = period.preset === 'custom';

  // Chevron icon
  const Chevron = ({ open }: { open: boolean }) => (
    <svg
      className={cn('w-3 h-3 transition-transform', open && 'rotate-180')}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const pillBase = "shrink-0 h-9 rounded-full text-xs font-bold tracking-tight border transition-all duration-150 active:scale-95 flex items-center gap-1.5";
  const pillActive = "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30";
  const pillInactive = "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30";

  return (
    <div
      ref={containerRef}
      className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-3 pb-3 bg-background/85 backdrop-blur-md border-b border-border/50"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {/* Week */}
          <button
            onClick={() => { onChange(buildPeriod('week')); setOpenDropdown(null); }}
            className={cn(pillBase, 'px-3.5', isWeekActive ? pillActive : pillInactive)}
          >
            Week
          </button>

          {/* Month — pill + chevron dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                if (!isMonthActive) onChange(buildPeriod('month'));
                setOpenDropdown(openDropdown === 'month' ? null : 'month');
              }}
              className={cn(pillBase, 'pl-3.5 pr-2.5', isMonthActive ? pillActive : pillInactive)}
            >
              <span>
                {isMonthActive
                  ? parseMonthKey(selectedMonthKey).toLocaleDateString('en-US', { month: 'short', year: selectedMonthKey.slice(0, 4) === String(currentYear) ? undefined : '2-digit' })
                  : 'Month'}
              </span>
              <Chevron open={openDropdown === 'month'} />
            </button>

            {openDropdown === 'month' && (
              <div className="absolute left-0 top-full mt-2 w-[180px] bg-card border border-border rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 max-h-[280px] overflow-y-auto">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">Select month</p>
                {monthOptions.map(mKey => {
                  const isSelected = isMonthActive && mKey === selectedMonthKey;
                  const isCurrent = mKey === currentMonthKey;
                  return (
                    <button
                      key={mKey}
                      onClick={() => { onChange(buildPeriod('month', { monthKey: mKey })); setOpenDropdown(null); }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between',
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span>
                        {parseMonthKey(mKey).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Now</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Year — pill + chevron dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                if (!isYearActive) onChange(buildPeriod('year'));
                setOpenDropdown(openDropdown === 'year' ? null : 'year');
              }}
              className={cn(pillBase, 'pl-3.5 pr-2.5', isYearActive ? pillActive : pillInactive)}
            >
              <span>{isYearActive ? selectedYear : 'Year'}</span>
              <Chevron open={openDropdown === 'year'} />
            </button>

            {openDropdown === 'year' && (
              <div className="absolute left-0 top-full mt-2 w-[140px] bg-card border border-border rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">Select year</p>
                {yearOptions.map(yr => {
                  const isSelected = isYearActive && yr === selectedYear;
                  const isCurrent = yr === currentYear;
                  return (
                    <button
                      key={yr}
                      onClick={() => { onChange(buildPeriod('year', { year: yr })); setOpenDropdown(null); }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between',
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span>{yr}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Now</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Custom — outside scroll context so popover renders correctly */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setCustomFrom(period.from);
              setCustomTo(period.to);
              setOpenDropdown(openDropdown === 'custom' ? null : 'custom');
            }}
            className={cn(pillBase, 'px-3.5', isCustomActive ? pillActive : pillInactive)}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="hidden sm:inline">
              {isCustomActive ? `${period.from} → ${period.to}` : 'Custom'}
            </span>
            <span className="sm:hidden">
              {isCustomActive ? `${period.from.slice(5)}→${period.to.slice(5)}` : 'Custom'}
            </span>
          </button>

          {openDropdown === 'custom' && (
            <div className="absolute right-0 top-full mt-2 w-[280px] bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in zoom-in-95 duration-150">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Quick</p>
              <button
                onClick={applyLast6Months}
                className="w-full text-left text-xs font-semibold text-foreground hover:bg-muted px-2.5 py-2 rounded-lg transition-colors mb-3"
              >
                Last 6 months
              </button>

              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Custom range</p>
              <label className="block text-xs font-semibold text-foreground mb-1">From</label>
              <input
                type="date"
                value={customFrom}
                max={todayIso}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <label className="block text-xs font-semibold text-foreground mb-1">To</label>
              <input
                type="date"
                value={customTo}
                max={todayIso}
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
                  onClick={() => { setCustomFrom(addDays(todayIso, -29)); setCustomTo(todayIso); }}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Reset
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setOpenDropdown(null)}
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

    </div>
  );
}
