'use client';

import { cn } from '@/lib/utils';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Tailwind bg class for the bar (e.g. 'bg-violet-500'). Defaults to primary. */
  barColor?: string;
  /** Tailwind bg class for a small dot before the label. */
  dotColor?: string;
  /** Small caption shown below the label, muted. */
  caption?: string;
  /** Optional small chip on the right (between bar and value). */
  chip?: { text: string; tone?: 'good' | 'bad' | 'flat' };
}

interface Props {
  items: BarItem[];
  /** Pre-formatted value (right-aligned). Defaults to localised number. */
  valueFormatter?: (v: number) => string;
  /** When true, no max-share normalization — every bar uses its raw value. */
  emptyMessage?: string;
  /** Max number to display before scrolling. Defaults to all. */
  maxRows?: number;
  /** Min label column width. Defaults to clamp(120px, 22%, 180px). */
  labelWidth?: string;
}

export function HorizontalBarChart({
  items,
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = 'No data in this period',
  maxRows,
  labelWidth = 'clamp(110px, 22%, 180px)',
}: Props) {
  const shown = maxRows ? items.slice(0, maxRows) : items;
  const max = Math.max(1, ...shown.map(d => d.value));

  if (shown.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {shown.map((item, i) => {
        const widthPct = (item.value / max) * 100;
        const chipTone =
          item.chip?.tone === 'good' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/30'
          : item.chip?.tone === 'bad' ? 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/30'
          : 'text-muted-foreground bg-muted';

        return (
          <div
            key={item.key}
            className="grid items-center gap-3 py-2 group"
            style={{
              gridTemplateColumns: `${labelWidth} 1fr auto`,
            }}
          >
            {/* Label */}
            <div className="flex items-center gap-1.5 min-w-0">
              {item.dotColor && (
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.dotColor)} aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{item.label}</p>
                {item.caption && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.caption}</p>
                )}
              </div>
            </div>

            {/* Bar (no track — extends from x=0) */}
            <div className="relative h-5 flex items-center">
              <div
                className={cn(
                  'absolute left-0 h-[18px] rounded-[3px] group-hover:opacity-90',
                  item.barColor ?? 'bg-primary',
                )}
                style={{
                  width: `${widthPct}%`,
                  transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                  animationDelay: `${i * 25}ms`,
                }}
              />
            </div>

            {/* Right side: optional chip + value */}
            <div className="flex items-center gap-2 shrink-0">
              {item.chip && (
                <span className={cn('inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums', chipTone)}>
                  {item.chip.text}
                </span>
              )}
              <span className="text-xs font-extrabold text-foreground tabular-nums whitespace-nowrap">
                {valueFormatter(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
