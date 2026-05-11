'use client';

import { cn } from '@/lib/utils';

export interface StripMetric {
  label: string;
  value: string;          // pre-formatted
  unit?: string;
  delta?: { text: string; direction: 'up' | 'down' | 'flat' };
  upIsGood?: boolean;     // default true
  subtitle?: string;
}

interface Props {
  metrics: StripMetric[];
}

export function MetricStrip({ metrics }: Props) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl overflow-hidden',
        'grid divide-y sm:divide-y-0 divide-border',
        'grid-cols-2 sm:divide-x',
        'sm:grid-cols-3 lg:grid-cols-6',
      )}
    >
      {metrics.map((m, i) => {
        const upIsGood = m.upIsGood ?? true;
        let deltaTone = 'text-muted-foreground';
        if (m.delta) {
          if (m.delta.direction === 'up') deltaTone = upIsGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
          if (m.delta.direction === 'down') deltaTone = upIsGood ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
        }

        return (
          <div
            key={i}
            className="relative px-4 py-3 sm:py-3.5 flex flex-col gap-0.5 group"
          >
            {/* Thin accent at the top of the cell */}
            <span
              className="absolute top-0 left-4 right-4 h-px bg-primary/30 group-hover:bg-primary transition-colors duration-300"
              aria-hidden="true"
            />

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {m.label}
            </p>

            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
                {m.value}
              </span>
              {m.unit && (
                <span className="text-xs font-semibold text-muted-foreground">{m.unit}</span>
              )}
              {m.delta && (
                <span className={cn('text-[10px] font-bold tabular-nums ml-auto pl-1', deltaTone)}>
                  {m.delta.direction === 'up' && '↑'}
                  {m.delta.direction === 'down' && '↓'}
                  {m.delta.text.replace(/^[+\-−]/, '')}
                </span>
              )}
            </div>

            {m.subtitle && (
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                {m.subtitle}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
