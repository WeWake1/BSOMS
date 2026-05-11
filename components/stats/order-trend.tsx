'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import type { DayBucket } from '@/lib/stats-utils';

type Metric = 'orders' | 'qty' | 'dispatched';

const METRICS: { key: Metric; label: string; }[] = [
  { key: 'orders',     label: 'Orders' },
  { key: 'qty',        label: 'Quantity' },
  { key: 'dispatched', label: 'Dispatched' },
];

interface Props {
  data: DayBucket[];
  title?: string;
  subtitle?: string;
}

export function OrderTrend({ data, title = 'Order Trend', subtitle = 'Daily activity across the selected period' }: Props) {
  const [metric, setMetric] = useState<Metric>('orders');

  const total = useMemo(() => data.reduce((acc, d) => acc + d[metric], 0), [data, metric]);
  const peak = useMemo(() => data.reduce((p, d) => (d[metric] > p[metric] ? d : p), data[0] ?? { date: '', label: '', orders: 0, qty: 0, dispatched: 0 }), [data, metric]);

  const isEmpty = data.length === 0 || total === 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        {/* Metric toggle */}
        <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg shrink-0">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                'h-7 px-2.5 rounded-md text-[11px] font-bold tracking-tight transition-all',
                metric === m.key
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary line */}
      <div className="flex items-baseline gap-3 mt-2 mb-3">
        <span className="text-2xl font-extrabold text-foreground tabular-nums">{total.toLocaleString()}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">total</span>
        {!isEmpty && (
          <>
            <span className="text-[11px] text-muted-foreground/50">·</span>
            <span className="text-[11px] text-muted-foreground">
              peak <span className="font-bold text-foreground">{peak[metric]}</span> on{' '}
              <span className="font-semibold text-foreground">{peak.label}</span>
            </span>
          </>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 -mx-2 min-h-[200px]">
        {isEmpty ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl mx-2">
            No orders in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }}
                minTickGap={28}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.6 }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.15)',
                  padding: '6px 10px',
                }}
                labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700, marginBottom: 2 }}
                formatter={(value) => [`${value}`, ''] as [string, string]}
                separator=""
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#trendFill)"
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2, fill: 'var(--primary)' }}
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
