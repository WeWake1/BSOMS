'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getCategoryHex } from '@/lib/category-colors';
import {
  addMonths, monthStart, monthEnd, monthLabel, monthWindow, parseMonthKey, toMonthKey,
} from '@/lib/stats-utils';
import type { OrderWithCategory } from '@/types/database';

const SELECT = '*, categories ( id, name, color, created_at )';
const WINDOW_SIZE = 6;

interface CategoryInfo {
  id: string;
  name: string;
  color: string;
  total: number; // window-wide total
}

interface ChartRow {
  monthKey: string;
  month: string;       // 'Jan'
  monthFull: string;   // 'January 2026'
  total: number;       // grand total for the month
  /** Name of the topmost non-zero category in this row's stack. Drives
   * which Bar paints the rounded top and renders the total label. */
  _topCat: string;
  // Each category's name → its qty in this month, e.g. { Wooden: 30, Steel: 20 }
  [categoryName: string]: number | string;
}

export function DoorsMade() {
  const [anchor, setAnchor] = useState<string>(() => toMonthKey(new Date()));
  const [orders, setOrders] = useState<OrderWithCategory[] | null>(null);
  const [loading, setLoading] = useState(true);

  const visibleMonths = useMemo(() => monthWindow(anchor, WINDOW_SIZE), [anchor]);
  const fromIso = monthStart(visibleMonths[0]);
  const toIso = monthEnd(visibleMonths[WINDOW_SIZE - 1]);

  // ── Fetch orders for the visible window ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from('orders')
      .select(SELECT)
      .gte('date', fromIso)
      .lte('date', toIso)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Couldn't load Doors Made data");
          setOrders([]);
        } else {
          setOrders((data ?? []) as unknown as OrderWithCategory[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fromIso, toIso]);

  // ── Build chart rows + categories ──────────────────────────────────────
  const crossesYear =
    visibleMonths[0].slice(0, 4) !== visibleMonths[WINDOW_SIZE - 1].slice(0, 4);

  const { rows, categories, isEmpty } = useMemo(() => {
    const ordersSafe = orders ?? [];

    // Find every category present in the window
    const catMap = new Map<string, CategoryInfo>();
    for (const o of ordersSafe) {
      const id = o.category_id;
      const name = o.categories?.name ?? 'Uncategorized';
      const color = getCategoryHex(id, o.categories?.color ?? null);
      if (!catMap.has(id)) catMap.set(id, { id, name, color, total: 0 });
      catMap.get(id)!.total += o.qty;
    }
    const categories = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

    // Initialize per-month rows with every category at 0 so stacks line up
    const rows: ChartRow[] = visibleMonths.map(mKey => {
      const row: ChartRow = {
        monthKey: mKey,
        month: monthLabel(mKey, crossesYear),
        monthFull: parseMonthKey(mKey).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        total: 0,
        _topCat: '',
      };
      for (const c of categories) row[c.name] = 0;
      return row;
    });
    const rowByMonth = new Map(rows.map(r => [r.monthKey, r]));

    for (const o of ordersSafe) {
      const mKey = o.date.slice(0, 7); // YYYY-MM
      const row = rowByMonth.get(mKey);
      if (!row) continue;
      const name = o.categories?.name ?? 'Uncategorized';
      row[name] = (row[name] as number) + o.qty;
      row.total += o.qty;
    }

    // Walk the stack from top to bottom (categories array is desc-by-window-
    // total, last index renders on top of the stack) and record the first
    // category with a non-zero value for each row.
    for (const row of rows) {
      for (let i = categories.length - 1; i >= 0; i--) {
        if ((row[categories[i].name] as number) > 0) {
          row._topCat = categories[i].name;
          break;
        }
      }
    }

    const isEmpty = categories.length === 0 || rows.every(r => r.total === 0);
    return { rows, categories, isEmpty };
  }, [orders, visibleMonths, crossesYear]);

  // Disable "next" if anchor is current month
  const todayKey = toMonthKey(new Date());
  const canGoForward = anchor < todayKey;

  // Window label
  const startLbl = monthLabel(visibleMonths[0], true);
  const endLbl = monthLabel(visibleMonths[WINDOW_SIZE - 1], true);

  const windowTotal = useMemo(
    () => categories.reduce((s, c) => s + c.total, 0),
    [categories],
  );

  const colorByCategory = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.name] = c.color;
    return m;
  }, [categories]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
            Doors Made
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {startLbl} → {endLbl}
            <span className="opacity-50"> · </span>
            <span className="font-semibold text-foreground">{windowTotal.toLocaleString()}</span> doors
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {loading && (
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 border-t-foreground/70 animate-spin mr-1"
              aria-label="Loading"
            />
          )}
          <button
            onClick={() => setAnchor(addMonths(anchor, -WINDOW_SIZE))}
            className="w-8 h-8 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center active:scale-95"
            aria-label="Previous 6 months"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setAnchor(addMonths(anchor, WINDOW_SIZE))}
            disabled={!canGoForward}
            className="w-8 h-8 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:hover:bg-muted/60 disabled:cursor-not-allowed"
            aria-label="Next 6 months"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      {categories.length > 0 && (
        <>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 mt-3">
            Totals · last 6 months
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1.5">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-[11px] font-semibold text-foreground/85">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {c.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Chart */}
      <div
        className={`mt-3 h-[240px] sm:h-[300px] w-full relative transition-opacity ${
          loading && orders ? 'opacity-50' : ''
        }`}
      >
        {loading && !orders ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 border-t-foreground/70 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-semibold text-foreground">No doors made in this window</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different 6-month range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 36, right: 8, left: 0, bottom: 4 }}
              barCategoryGap="22%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tickMargin={6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.22))]}
              />
              <Tooltip
                cursor={{ fill: 'rgba(120, 120, 130, 0.12)', radius: 8 }}
                content={<DoorsTooltip colorByCategory={colorByCategory} />}
                wrapperStyle={{ outline: 'none' }}
              />
              {categories.map((cat) => (
                <Bar
                  key={cat.id}
                  dataKey={cat.name}
                  stackId="a"
                  fill={cat.color}
                  isAnimationActive={false}
                  shape={(p: any) => <StackedBarSegment {...p} catName={cat.name} />}
                >
                  <LabelList
                    dataKey="total"
                    content={(p: any) => <StackedBarTotalLabel {...p} catName={cat.name} />}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/70 mt-2">
        Each bar = total doors made that month, stacked by category.
      </p>
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  colorByCategory: Record<string, string>;
}

function DoorsTooltip({ active, payload, colorByCategory }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const segments = Object.keys(colorByCategory)
    .map(name => ({ name, value: row[name] as number, color: colorByCategory[name] }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl p-3 min-w-[180px]">
      <div className="flex items-baseline justify-between gap-3 pb-2 mb-2 border-b border-border/60">
        <span className="text-xs font-extrabold text-foreground tracking-tight">{row.monthFull}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {row.total > 0 ? 'doors' : ''}
        </span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
        <span className="text-base font-extrabold text-foreground tabular-nums">{row.total.toLocaleString()}</span>
      </div>
      {segments.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No doors this month</p>
      ) : (
        <ul className="space-y-1">
          {segments.map(s => (
            <li key={s.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-semibold text-foreground/90 flex-1 truncate">{s.name}</span>
              <span className="tabular-nums font-bold text-foreground">{s.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Per-row stack rendering ────────────────────────────────────────────────
//
// Each row's _topCat names the topmost non-zero segment. The Bar whose
// dataKey matches that name paints rounded top corners AND renders the
// total label above the stack. Every other Bar paints a plain rect and
// renders no label. This makes both visuals robust to months where the
// smallest-by-window category is zero (e.g. May with no Laminated Groove
// doors) — the previous "label on last Bar" pattern silently disappeared
// for those months because the 0-height segment had no label to attach to.

function StackedBarSegment(props: any) {
  const { x, y, width, height, fill, payload, catName } = props;
  if (!width || height <= 0) return null;
  const isTop = payload?._topCat === catName;
  if (!isTop) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  }
  const r = Math.min(4, height, width / 2);
  const d =
    `M${x},${y + height}` +
    `L${x},${y + r}` +
    `Q${x},${y} ${x + r},${y}` +
    `L${x + width - r},${y}` +
    `Q${x + width},${y} ${x + width},${y + r}` +
    `L${x + width},${y + height}Z`;
  return <path d={d} fill={fill} />;
}

function StackedBarTotalLabel(props: any) {
  const { x, y, width, payload, catName } = props;
  if (payload?._topCat !== catName) return null;
  const total = payload?.total;
  if (!total) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="fill-foreground"
      style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
    >
      {Number(total).toLocaleString()}
    </text>
  );
}
