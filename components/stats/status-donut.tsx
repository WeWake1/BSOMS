'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

interface Props {
  data: { status: OrderStatus; count: number }[];
}

const STATUS_FILL: Record<OrderStatus, string> = {
  'Pending':     'var(--status-pending, oklch(74% 0.19 72))',
  'In Progress': 'var(--primary)',
  'Packing':     'oklch(62% 0.22 295)',
  'Dispatched':  'oklch(65% 0.18 145)',
};

const STATUS_DOT: Record<OrderStatus, string> = {
  'Pending':     'bg-amber-500',
  'In Progress': 'bg-primary',
  'Packing':     'bg-purple-500',
  'Dispatched':  'bg-emerald-500',
};

export function StatusDonut({ data }: Props) {
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div>
        <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Status</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Where this period&apos;s orders sit</p>
      </div>

      {total === 0 ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl mt-3">
          No data
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center mt-2 gap-3">
          <div className="relative w-full max-w-[180px] aspect-square mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter(d => d.count > 0)}
                  dataKey="count"
                  nameKey="status"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive
                  animationDuration={500}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {data.filter(d => d.count > 0).map((d, i) => (
                    <Cell key={i} fill={STATUS_FILL[d.status]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    padding: '6px 10px',
                  }}
                  formatter={(value, name) => [`${value} orders`, name] as [string, string]}
                  separator=": "
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{total}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">total</span>
            </div>
          </div>

          {/* Legend — compact, 2 cols */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 w-full">
            {data.map(d => {
              const pct = total === 0 ? 0 : Math.round((d.count / total) * 100);
              return (
                <li key={d.status} className="flex items-center gap-1.5 text-[11px]">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[d.status])} />
                  <span className="text-muted-foreground truncate">{d.status}</span>
                  <span className="ml-auto font-bold text-foreground tabular-nums shrink-0">{d.count}</span>
                  <span className="text-muted-foreground/70 tabular-nums shrink-0 w-7 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
