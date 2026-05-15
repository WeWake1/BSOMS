'use client';

import { getCategoryColor, type CategoryColorKey } from '@/lib/category-colors';
import type { CategoryStats } from '@/lib/stats-utils';
import { HorizontalBarChart, type BarItem } from './horizontal-bar-chart';

interface Props {
  data: CategoryStats[];
  totalOrders: number;
}

export function CategoryPerformance({ data, totalOrders }: Props) {
  const sorted = [...data].sort((a, b) => b.totalQty - a.totalQty);

  const items: BarItem[] = sorted.map(c => {
    const color = getCategoryColor(c.id, c.color as CategoryColorKey | null);
    return {
      key: c.id,
      label: c.name,
      value: c.totalQty,
      dotColor: color.dot,
      barColor: color.dot,
    };
  });

  const valueFormatter = (v: number) => v.toLocaleString();

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Category Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total quantity by category · {totalOrders} orders · {data.length} {data.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <HorizontalBarChart
          items={items}
          valueFormatter={valueFormatter}
          labelWidth="clamp(110px, 34%, 170px)"
          stretch
        />
      </div>
    </div>
  );
}
