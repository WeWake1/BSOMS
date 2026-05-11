'use client';

import { cn } from '@/lib/utils';
import { getCategoryColor, type CategoryColorKey } from '@/lib/category-colors';
import type { CategoryStats } from '@/lib/stats-utils';
import { formatDays } from '@/lib/stats-utils';

interface Props {
  data: CategoryStats[];
}

export function CategoryInsights({ data }: Props) {
  // Sort by orders descending so the order matches the bar chart by default
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div className="mb-3">
        <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Category Insights</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Per-category averages</p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 min-h-[140px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No data
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_repeat(3,_auto)] gap-3 px-1 pb-2 border-b border-border">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Category</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-12">Avg qty</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-12">Days</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-12">Overdue</span>
          </div>

          <ul className="divide-y divide-border/60">
            {sorted.map(c => {
              const color = getCategoryColor(c.id, c.color as CategoryColorKey | null);
              const overdueTone =
                c.overdueRate >= 30 ? 'text-rose-700 dark:text-rose-300'
                : c.overdueRate >= 15 ? 'text-amber-700 dark:text-amber-300'
                : 'text-foreground';
              return (
                <li key={c.id} className="grid grid-cols-[1fr_repeat(3,_auto)] items-center gap-3 px-1 py-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color.dot)} />
                    <span className="text-xs font-semibold text-foreground truncate">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground tabular-nums text-right w-12">{c.avgQty.toFixed(1)}</span>
                  <span className="text-xs font-bold text-foreground tabular-nums text-right w-12">{formatDays(c.avgDaysToDispatch)}</span>
                  <span className={cn('text-xs font-bold tabular-nums text-right w-12', overdueTone)}>
                    {c.overdueRate.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
