'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getCategoryColor, type CategoryColorKey } from '@/lib/category-colors';
import type { CategoryStats } from '@/lib/stats-utils';
import { HorizontalBarChart, type BarItem } from './horizontal-bar-chart';

type SortKey = 'count' | 'totalQty' | 'avgQty' | 'avgDays' | 'overdueRate';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'count',       label: 'Orders' },
  { key: 'totalQty',    label: 'Total qty' },
  { key: 'avgQty',      label: 'Avg qty' },
  { key: 'avgDays',     label: 'Days' },
  { key: 'overdueRate', label: 'Overdue' },
];

interface Props {
  data: CategoryStats[];
  totalOrders: number;
}

export function CategoryPerformance({ data, totalOrders }: Props) {
  const [sort, setSort] = useState<SortKey>('count');

  const sorted = [...data].sort((a, b) => {
    if (sort === 'count')        return b.count - a.count;
    if (sort === 'totalQty')     return b.totalQty - a.totalQty;
    if (sort === 'avgQty')       return b.avgQty - a.avgQty;
    if (sort === 'avgDays')      return (a.avgDaysToDispatch ?? Infinity) - (b.avgDaysToDispatch ?? Infinity);
    if (sort === 'overdueRate')  return b.overdueRate - a.overdueRate;
    return 0;
  });

  const items: BarItem[] = sorted.map(c => {
    const color = getCategoryColor(c.id, c.color as CategoryColorKey | null);
    const value =
      sort === 'count'       ? c.count :
      sort === 'totalQty'    ? c.totalQty :
      sort === 'avgQty'      ? Number(c.avgQty.toFixed(2)) :
      sort === 'avgDays'     ? Number((c.avgDaysToDispatch ?? 0).toFixed(1)) :
      Number(c.overdueRate.toFixed(1));

    return {
      key: c.id,
      label: c.name,
      value,
      dotColor: color.dot,
      barColor: color.dot, // same Tailwind bg class
    };
  });

  const valueFormatter = (v: number) => {
    if (sort === 'overdueRate') return `${v}%`;
    if (sort === 'avgDays')     return `${v}d`;
    if (sort === 'avgQty')      return v.toString();
    if (sort === 'totalQty')    return v.toLocaleString();
    return v.toString();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Category Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalOrders} orders · {data.length} {data.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg">
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'h-7 px-2.5 rounded-md text-[11px] font-bold tracking-tight transition-all',
                sort === s.key
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <HorizontalBarChart
          items={items}
          valueFormatter={valueFormatter}
          labelWidth="clamp(120px, 28%, 200px)"
        />
      </div>
    </div>
  );
}
