/**
 * Stats utilities — period math, aggregators, formatters.
 * All pure functions — no Supabase, no React.
 */

import type { OrderWithCategory, OrderStatus } from '@/types/database';

// ─── Period types ───────────────────────────────────────────────────────────

export type PeriodPreset = 'week' | 'month' | 'year' | 'custom';

export interface Period {
  preset: PeriodPreset;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (inclusive)
  label: string;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  // Local YYYY-MM-DD (avoid UTC shift)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateLocal(iso: string): Date {
  // Accepts 'YYYY-MM-DD'. Use local midnight to avoid TZ drift.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseDateLocal(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = parseDateLocal(fromIso).getTime();
  const b = parseDateLocal(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

// ─── Period builders ────────────────────────────────────────────────────────

export function buildPeriod(
  preset: PeriodPreset,
  opts?: { from?: string; to?: string; monthKey?: string; year?: number },
): Period {
  const today = new Date();
  const todayIso = toISODate(today);

  if (preset === 'week') {
    // Monday of this week → today (Mon-anchored)
    const day = today.getDay(); // 0=Sun, 1=Mon...
    const daysSinceMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);
    return { preset, from: toISODate(monday), to: todayIso, label: 'This week' };
  }
  if (preset === 'month') {
    // Calendar month: opts.monthKey ('YYYY-MM') or current month
    const key = opts?.monthKey ?? toMonthKey(today);
    const from = monthStart(key);
    const isCurrentMonth = key === toMonthKey(today);
    const to = isCurrentMonth ? todayIso : monthEnd(key);
    const label = parseMonthKey(key).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { preset, from, to, label };
  }
  if (preset === 'year') {
    // Calendar year-to-date for current year, full year for prior years
    const yr = opts?.year ?? today.getFullYear();
    const from = `${yr}-01-01`;
    const isCurrentYear = yr === today.getFullYear();
    const to = isCurrentYear ? todayIso : `${yr}-12-31`;
    return { preset, from, to, label: String(yr) };
  }
  // custom
  const from = opts?.from ?? addDays(todayIso, -29);
  const cTo = opts?.to ?? todayIso;
  return { preset: 'custom', from, to: cTo, label: `${from} → ${cTo}` };
}

/** Equivalent-duration window immediately before `p`. */
export function priorPeriod(p: Period): Period {
  const len = diffDays(p.from, p.to); // 0-indexed
  const priorTo = addDays(p.from, -1);
  const priorFrom = addDays(priorTo, -len);
  return { preset: p.preset, from: priorFrom, to: priorTo, label: `Prior: ${priorFrom} → ${priorTo}` };
}

// ─── Order filters ──────────────────────────────────────────────────────────

/** Filter orders whose `date` (placed) is within [from, to] inclusive. */
export function filterByPlacedDate<T extends { date: string }>(orders: T[], from: string, to: string): T[] {
  return orders.filter(o => o.date >= from && o.date <= to);
}

/** Filter dispatched orders whose `dispatch_date` is within [from, to] inclusive. */
export function filterByDispatchDate<T extends { dispatch_date: string | null; status: OrderStatus }>(orders: T[], from: string, to: string): T[] {
  return orders.filter(o => o.dispatch_date != null && o.status === 'Dispatched' && o.dispatch_date >= from && o.dispatch_date <= to);
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

export function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return (num / denom) * 100;
}

/** Fulfillment time in days: dispatch_date − date. Only for dispatched orders. */
export function fulfillmentDays(order: Pick<OrderWithCategory, 'date' | 'dispatch_date'>): number | null {
  if (!order.dispatch_date) return null;
  return diffDays(order.date, order.dispatch_date);
}

/** Overdue today: due_date < today AND not dispatched. */
export function isOverdueNow(o: Pick<OrderWithCategory, 'due_date' | 'status'>, todayIso: string): boolean {
  return o.status !== 'Dispatched' && o.due_date < todayIso;
}

/** Days overdue (today − due_date). Negative if not overdue. */
export function daysOverdue(o: Pick<OrderWithCategory, 'due_date'>, todayIso: string): number {
  return diffDays(o.due_date, todayIso);
}

// ─── Week bucketing ─────────────────────────────────────────────────────────

export interface WeekBucket {
  weekStart: string; // YYYY-MM-DD (Monday)
  label: string;     // 'Apr 7'
  count: number;
}

/** Returns ordered weekly buckets covering [from, to] (Mon-anchored). */
export function bucketByWeek(orders: Pick<OrderWithCategory, 'date'>[], from: string, to: string): WeekBucket[] {
  // Find Monday on/before `from`
  const start = parseDateLocal(from);
  const dayOfWeek = (start.getDay() + 6) % 7; // 0=Mon..6=Sun
  start.setDate(start.getDate() - dayOfWeek);

  const buckets: WeekBucket[] = [];
  const end = parseDateLocal(to);
  let cursor = new Date(start);

  while (cursor <= end) {
    const weekStart = toISODate(cursor);
    const label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.push({ weekStart, label, count: 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  for (const o of orders) {
    const d = parseDateLocal(o.date);
    const dow = (d.getDay() + 6) % 7;
    const wkStart = new Date(d);
    wkStart.setDate(d.getDate() - dow);
    const key = toISODate(wkStart);
    const bucket = buckets.find(b => b.weekStart === key);
    if (bucket) bucket.count++;
  }

  return buckets;
}

// ─── Daily bucketing (for line chart) ──────────────────────────────────────

export interface DayBucket {
  date: string;     // YYYY-MM-DD
  label: string;    // 'Apr 7' or 'Apr 7, 2024' when year crosses
  orders: number;   // placed-date count
  qty: number;      // sum of qty (placed-date)
  dispatched: number; // dispatch-date count
}

/**
 * Returns one bucket per day in [from, to] inclusive, with three series:
 *  - orders:     count placed that day
 *  - qty:        sum of qty placed that day
 *  - dispatched: count dispatched that day
 */
export function bucketByDay(
  placedOrders: Pick<OrderWithCategory, 'date' | 'qty'>[],
  dispatchedOrders: Pick<OrderWithCategory, 'dispatch_date' | 'status'>[],
  from: string,
  to: string,
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  const crossesYear = fromYear !== toYear;

  const cursor = parseDateLocal(from);
  const end = parseDateLocal(to);
  while (cursor <= end) {
    const date = toISODate(cursor);
    const label = cursor.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(crossesYear ? { year: '2-digit' as const } : {}),
    });
    buckets.set(date, { date, label, orders: 0, qty: 0, dispatched: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const o of placedOrders) {
    const b = buckets.get(o.date);
    if (b) {
      b.orders++;
      b.qty += o.qty;
    }
  }

  for (const o of dispatchedOrders) {
    if (o.status !== 'Dispatched' || !o.dispatch_date) continue;
    const b = buckets.get(o.dispatch_date);
    if (b) b.dispatched++;
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Month-range helpers (for Doors Made chart) ────────────────────────────

/** YYYY-MM key for a date. */
export function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Parse 'YYYY-MM' to local Date at day 1. */
export function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

/** Add N months to a 'YYYY-MM' key, return new 'YYYY-MM'. */
export function addMonths(key: string, n: number): string {
  const d = parseMonthKey(key);
  d.setMonth(d.getMonth() + n);
  return toMonthKey(d);
}

/** First day of month as YYYY-MM-DD. */
export function monthStart(key: string): string {
  return `${key}-01`;
}

/** Last day of month as YYYY-MM-DD. */
export function monthEnd(key: string): string {
  const d = parseMonthKey(key);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // last day of previous month (i.e. our month)
  return toISODate(d);
}

/** Short label for a month key, e.g. 'Jan', or 'Jan ’25' if window crosses years. */
export function monthLabel(key: string, includeYear = false): string {
  const d = parseMonthKey(key);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  if (!includeYear) return month;
  const yy = String(d.getFullYear()).slice(-2);
  return `${month} ’${yy}`;
}

/** Window of N month keys ending at `endKey` (inclusive). */
export function monthWindow(endKey: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(addMonths(endKey, -i));
  return keys;
}

// ─── Day-of-week bucketing ──────────────────────────────────────────────────

export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function bucketByDayOfWeek(orders: Pick<OrderWithCategory, 'date'>[]): { day: string; count: number }[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const o of orders) {
    const d = parseDateLocal(o.date);
    const dow = (d.getDay() + 6) % 7;
    counts[dow]++;
  }
  return DOW_LABELS.map((day, i) => ({ day, count: counts[i] }));
}

// ─── Category aggregation ───────────────────────────────────────────────────

export interface CategoryStats {
  id: string;
  name: string;
  color: string | null;
  count: number;
  share: number;        // 0..100
  delta: number;        // count − priorCount
  deltaPct: number;     // (count − priorCount) / priorCount * 100, or 0 if prior=0
  totalQty: number;     // sum of qty across all orders in this category
  avgQty: number;       // totalQty / count
  avgDaysToDispatch: number | null;
  overdueCount: number;
  overdueRate: number;  // 0..100
}

export function categoryStats(
  current: OrderWithCategory[],
  prior: OrderWithCategory[],
  todayIso: string,
): CategoryStats[] {
  const byCat = new Map<string, CategoryStats>();

  for (const o of current) {
    const id = o.category_id;
    const name = o.categories?.name ?? 'Uncategorized';
    const color = o.categories?.color ?? null;
    if (!byCat.has(id)) {
      byCat.set(id, {
        id, name, color,
        count: 0, share: 0, delta: 0, deltaPct: 0,
        totalQty: 0, avgQty: 0, avgDaysToDispatch: null,
        overdueCount: 0, overdueRate: 0,
      });
    }
    const c = byCat.get(id)!;
    c.count++;
    c.totalQty += o.qty;
    if (isOverdueNow(o, todayIso)) c.overdueCount++;
  }

  // Prior period count by category
  const priorCounts = new Map<string, number>();
  for (const o of prior) {
    priorCounts.set(o.category_id, (priorCounts.get(o.category_id) ?? 0) + 1);
  }

  // avgDaysToDispatch from current-period dispatched orders
  const dispatchedByCat = new Map<string, number[]>();
  for (const o of current) {
    if (o.status === 'Dispatched' && o.dispatch_date) {
      const days = diffDays(o.date, o.dispatch_date);
      const arr = dispatchedByCat.get(o.category_id) ?? [];
      arr.push(days);
      dispatchedByCat.set(o.category_id, arr);
    }
  }

  const total = current.length;
  const cats = Array.from(byCat.values());
  cats.forEach(c => {
    c.share = pct(c.count, total);
    const p = priorCounts.get(c.id) ?? 0;
    c.delta = c.count - p;
    c.deltaPct = p === 0 ? (c.count === 0 ? 0 : 100) : pct(c.count - p, p);
    c.avgQty = c.count === 0 ? 0 : c.totalQty / c.count;
    const days = dispatchedByCat.get(c.id);
    c.avgDaysToDispatch = days && days.length > 0 ? avg(days) : null;
    c.overdueRate = pct(c.overdueCount, c.count);
  });

  return cats.sort((a, b) => b.count - a.count);
}

// ─── Customer aggregation ───────────────────────────────────────────────────

export interface CustomerStats {
  name: string;
  count: number;
  dominantCategory: { id: string; name: string; color: string | null } | null;
}

export function customerStats(current: OrderWithCategory[], topN = 10): CustomerStats[] {
  const byCustomer = new Map<string, { count: number; cats: Map<string, { id: string; name: string; color: string | null; count: number }> }>();

  for (const o of current) {
    const name = o.customer_name;
    if (!byCustomer.has(name)) byCustomer.set(name, { count: 0, cats: new Map() });
    const c = byCustomer.get(name)!;
    c.count++;
    const catId = o.category_id;
    if (!c.cats.has(catId)) {
      c.cats.set(catId, { id: catId, name: o.categories?.name ?? 'Uncategorized', color: o.categories?.color ?? null, count: 0 });
    }
    c.cats.get(catId)!.count++;
  }

  const list: CustomerStats[] = Array.from(byCustomer.entries()).map(([name, data]) => {
    let dominant: CustomerStats['dominantCategory'] = null;
    let max = 0;
    Array.from(data.cats.values()).forEach(cat => {
      if (cat.count > max) { max = cat.count; dominant = { id: cat.id, name: cat.name, color: cat.color }; }
    });
    return { name, count: data.count, dominantCategory: dominant };
  });

  return list.sort((a, b) => b.count - a.count).slice(0, topN);
}

/** Repeat customer rate: % of customers in period who placed >1 order in period. */
export function repeatCustomerRate(current: OrderWithCategory[]): { repeatCount: number; totalCustomers: number; rate: number } {
  const counts = new Map<string, number>();
  for (const o of current) counts.set(o.customer_name, (counts.get(o.customer_name) ?? 0) + 1);
  const total = counts.size;
  let repeat = 0;
  Array.from(counts.values()).forEach(n => { if (n > 1) repeat++; });
  return { repeatCount: repeat, totalCustomers: total, rate: pct(repeat, total) };
}

// ─── Dimension pair aggregation ─────────────────────────────────────────────

export interface DimensionPair {
  pair: string;       // "33"1 × 45"2" or "33"1 only" if width missing
  length: string | null;
  width: string | null;
  count: number;
}

export function dimensionPairs(current: OrderWithCategory[], topN = 10): DimensionPair[] {
  const map = new Map<string, DimensionPair>();
  for (const o of current) {
    const l = (o.length ?? '').trim() || null;
    const w = (o.width ?? '').trim() || null;
    if (!l && !w) continue;
    const key = `${l ?? '—'}|${w ?? '—'}`;
    const pair = l && w ? `${l} × ${w}` : (l ?? w ?? '—');
    if (!map.has(key)) map.set(key, { pair, length: l, width: w, count: 0 });
    map.get(key)!.count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, topN);
}

// ─── Status distribution ────────────────────────────────────────────────────

export const ALL_STATUSES: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

export function statusDistribution(current: OrderWithCategory[]): { status: OrderStatus; count: number }[] {
  const counts: Record<OrderStatus, number> = { 'Pending': 0, 'In Progress': 0, 'Packing': 0, 'Dispatched': 0 };
  for (const o of current) counts[o.status]++;
  return ALL_STATUSES.map(s => ({ status: s, count: counts[s] }));
}

// ─── Top-level metrics ──────────────────────────────────────────────────────

export interface SummaryMetrics {
  totalOrders: number;
  totalDispatched: number;
  overdueCount: number;
  avgFulfillmentDays: number | null;
  totalQty: number;
  avgQtyPerOrder: number;
  onTimeRate: number | null; // 0..100 or null if no dispatched
  avgDaysOverdue: number | null;
}

export function summaryMetrics(
  placedInPeriod: OrderWithCategory[],
  dispatchedInPeriod: OrderWithCategory[],
  allActive: OrderWithCategory[],   // for overdue (today vs due_date), unfiltered
  todayIso: string,
): SummaryMetrics {
  const totalOrders = placedInPeriod.length;
  const totalDispatched = dispatchedInPeriod.length;
  const totalQty = sum(placedInPeriod.map(o => o.qty));

  const fulfillment = dispatchedInPeriod
    .map(o => fulfillmentDays(o))
    .filter((n): n is number => n != null && n >= 0);
  const avgFulfillmentDays = fulfillment.length > 0 ? avg(fulfillment) : null;

  const overdueOrders = allActive.filter(o => isOverdueNow(o, todayIso));
  const overdueCount = overdueOrders.length;
  const avgDaysOverdue = overdueOrders.length > 0
    ? avg(overdueOrders.map(o => daysOverdue(o, todayIso)))
    : null;

  const onTime = dispatchedInPeriod.filter(o => o.dispatch_date && o.dispatch_date <= o.due_date).length;
  const onTimeRate = dispatchedInPeriod.length > 0 ? pct(onTime, dispatchedInPeriod.length) : null;

  return {
    totalOrders, totalDispatched, overdueCount,
    avgFulfillmentDays, totalQty,
    avgQtyPerOrder: totalOrders === 0 ? 0 : totalQty / totalOrders,
    onTimeRate, avgDaysOverdue,
  };
}

// ─── Format helpers ─────────────────────────────────────────────────────────

export function formatDelta(curr: number, prior: number, opts: { suffix?: string; decimals?: number } = {}): { text: string; direction: 'up' | 'down' | 'flat' } {
  const diff = curr - prior;
  const d = opts.decimals ?? 0;
  const suf = opts.suffix ?? '';
  if (Math.abs(diff) < (d === 0 ? 0.5 : Math.pow(10, -d) / 2)) {
    return { text: `±0${suf}`, direction: 'flat' };
  }
  const sign = diff > 0 ? '+' : '−';
  return { text: `${sign}${Math.abs(diff).toFixed(d)}${suf}`, direction: diff > 0 ? 'up' : 'down' };
}

export function formatDeltaPct(curr: number, prior: number): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (prior === 0) {
    if (curr === 0) return { text: '±0%', direction: 'flat' };
    return { text: 'new', direction: 'up' };
  }
  const diff = ((curr - prior) / prior) * 100;
  if (Math.abs(diff) < 0.5) return { text: '±0%', direction: 'flat' };
  const sign = diff > 0 ? '+' : '−';
  return { text: `${sign}${Math.abs(diff).toFixed(0)}%`, direction: diff > 0 ? 'up' : 'down' };
}

export function formatDays(n: number | null): string {
  if (n == null) return '—';
  if (n < 1) return '<1 day';
  return `${n.toFixed(1)} ${n < 1.5 ? 'day' : 'days'}`;
}

export function formatPercent(n: number | null, decimals = 0): string {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}
