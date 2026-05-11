'use client';

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface Props {
  data: { day: string; count: number }[];
}

export function DayOfWeekPanel({ data }: Props) {
  const max = Math.max(1, ...data.map(d => d.count));
  const total = data.reduce((a, b) => a + b.count, 0);
  const peak = data.reduce((p, d) => (d.count > p.count ? d : p), data[0] ?? { day: '—', count: 0 });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Day-of-Week</h2>
          <p className="text-xs text-muted-foreground mt-0.5">When orders come in</p>
        </div>
        {total > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Peak</p>
            <p className="text-sm font-extrabold text-foreground">{peak.day} <span className="text-muted-foreground/70 text-xs font-semibold tabular-nums">· {peak.count}</span></p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="flex-1 min-h-[160px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl mt-3">
          No data
        </div>
      ) : (
        <div className="flex-1 min-h-[180px] -mx-2 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  padding: '6px 10px',
                }}
                labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 700 }}
                formatter={(value) => [`${value} orders`, ''] as [string, string]}
                separator=""
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill="var(--primary)"
                    fillOpacity={d.count === max ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
