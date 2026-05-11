'use client';

import { cn } from '@/lib/utils';
import { formatDays, formatPercent, type SummaryMetrics } from '@/lib/stats-utils';

interface Props {
  current: SummaryMetrics;
  prior: SummaryMetrics;
}

type Row = {
  label: string;
  curr: string;
  priorTxt: string;
  delta: number;
  upIsGood: boolean;
  decimals?: number;
  pctMode?: boolean;
};

function buildRows(current: SummaryMetrics, prior: SummaryMetrics): Row[] {
  return [
    {
      label: 'Total orders',
      curr: current.totalOrders.toLocaleString(),
      priorTxt: prior.totalOrders.toLocaleString(),
      delta: current.totalOrders - prior.totalOrders,
      upIsGood: true,
    },
    {
      label: 'Dispatched',
      curr: current.totalDispatched.toLocaleString(),
      priorTxt: prior.totalDispatched.toLocaleString(),
      delta: current.totalDispatched - prior.totalDispatched,
      upIsGood: true,
    },
    {
      label: 'On-time rate',
      curr: formatPercent(current.onTimeRate, 0),
      priorTxt: formatPercent(prior.onTimeRate, 0),
      delta: (current.onTimeRate ?? 0) - (prior.onTimeRate ?? 0),
      upIsGood: true,
      decimals: 0,
      pctMode: true,
    },
    {
      label: 'Avg fulfillment',
      curr: formatDays(current.avgFulfillmentDays),
      priorTxt: formatDays(prior.avgFulfillmentDays),
      delta: (current.avgFulfillmentDays ?? 0) - (prior.avgFulfillmentDays ?? 0),
      upIsGood: false,
      decimals: 1,
    },
    {
      label: 'Total quantity',
      curr: current.totalQty.toLocaleString(),
      priorTxt: prior.totalQty.toLocaleString(),
      delta: current.totalQty - prior.totalQty,
      upIsGood: true,
    },
  ];
}

export function PeriodComparison({ current, prior }: Props) {
  const rows = buildRows(current, prior);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Period Comparison</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Current vs. equivalent prior window</p>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-1 pb-2 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Metric</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-20 sm:w-24">Prior</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-20 sm:w-24">Current</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right w-16">Δ</span>
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const isFlat = Math.abs(r.delta) < (r.decimals ? Math.pow(10, -r.decimals) / 2 : 0.5);
          const direction = isFlat ? 'flat' : r.delta > 0 ? 'up' : 'down';
          const good = (direction === 'up' && r.upIsGood) || (direction === 'down' && !r.upIsGood);
          const bad = (direction === 'up' && !r.upIsGood) || (direction === 'down' && r.upIsGood);
          const color = isFlat ? 'text-muted-foreground bg-muted'
            : good ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/30'
            : bad ? 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/30'
            : 'text-muted-foreground bg-muted';
          const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '·';
          const abs = Math.abs(r.delta);
          const dt = r.decimals != null ? abs.toFixed(r.decimals) : Math.round(abs).toString();

          return (
            <li key={r.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-1 py-2.5">
              <p className="text-xs font-semibold text-foreground">{r.label}</p>
              <p className="text-xs font-semibold text-muted-foreground text-right tabular-nums w-20 sm:w-24">{r.priorTxt}</p>
              <p className="text-sm font-extrabold text-foreground text-right tabular-nums w-20 sm:w-24">{r.curr}</p>
              <span className={cn('inline-flex items-center justify-end gap-0.5 h-5 w-16 px-1.5 rounded-md text-[10px] font-bold tabular-nums', color)}>
                {arrow}{isFlat ? '0' : dt}{r.pctMode ? 'pp' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
