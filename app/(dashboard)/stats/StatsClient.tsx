'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { fetchStatsData, type StatsDatasets } from '@/lib/supabase/stats-queries';
import {
  buildPeriod, priorPeriod, summaryMetrics, categoryStats, customerStats,
  repeatCustomerRate, dimensionPairs, statusDistribution, bucketByDay, bucketByDayOfWeek,
  toISODate, formatDeltaPct, formatDelta,
  type Period,
} from '@/lib/stats-utils';
import { getCategoryColor, type CategoryColorKey } from '@/lib/category-colors';
import { PeriodPicker } from '@/components/stats/period-picker';
import { MetricStrip, type StripMetric } from '@/components/stats/metric-strip';
import { OrderTrend } from '@/components/stats/order-trend';
import { StatusDonut } from '@/components/stats/status-donut';
import { CategoryPerformance } from '@/components/stats/category-performance';
import { DoorsMade } from '@/components/stats/doors-made';
import { HorizontalBarChart, type BarItem } from '@/components/stats/horizontal-bar-chart';
import { DayOfWeekPanel } from '@/components/stats/day-of-week';
import { PeriodComparison } from '@/components/stats/period-comparison';
import { StatsSkeleton } from '@/components/stats/skeleton';
import type { AuthUser } from '@/lib/auth';

export function StatsClient({ user }: { user: AuthUser }) {
  const [period, setPeriod] = useState<Period>(() => buildPeriod('month'));
  const [data, setData] = useState<StatsDatasets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const ds = await fetchStatsData(p);
      setData(ds);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load stats');
      toast.error("Couldn't load statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const today = useMemo(() => toISODate(new Date()), []);
  const prior = useMemo(() => priorPeriod(period), [period]);

  const derived = useMemo(() => {
    if (!data) return null;
    const current = summaryMetrics(data.placedInPeriod, data.dispatchedInPeriod, data.allActive, today);
    const priorMetrics = summaryMetrics(data.placedInPrior, data.dispatchedInPrior, [], today);
    const cats = categoryStats(data.placedInPeriod, data.placedInPrior, today);
    const customers = customerStats(data.placedInPeriod, 10);
    const repeat = repeatCustomerRate(data.placedInPeriod);
    const dims = dimensionPairs(data.placedInPeriod, 10);
    const statusDist = statusDistribution(data.placedInPeriod);
    const daily = bucketByDay(data.placedInPeriod, data.dispatchedInPeriod, period.from, period.to);
    const dow = bucketByDayOfWeek(data.placedInPeriod);
    return { current, priorMetrics, cats, customers, repeat, dims, statusDist, daily, dow };
  }, [data, today, period]);

  // ── Build top metric strip ───────────────────────────────────────────────
  const metrics: StripMetric[] = useMemo(() => {
    if (!derived) return [];
    const { current, priorMetrics } = derived;
    return [
      {
        label: 'Total orders',
        value: current.totalOrders.toLocaleString(),
        delta: formatDeltaPct(current.totalOrders, priorMetrics.totalOrders),
        upIsGood: true,
      },
      {
        label: 'Dispatched',
        value: current.totalDispatched.toLocaleString(),
        delta: formatDeltaPct(current.totalDispatched, priorMetrics.totalDispatched),
        upIsGood: true,
      },
      {
        label: 'On-time',
        value: current.onTimeRate == null ? '—' : `${Math.round(current.onTimeRate)}`,
        unit: current.onTimeRate == null ? undefined : '%',
        delta: (current.onTimeRate != null && priorMetrics.onTimeRate != null)
          ? formatDelta(current.onTimeRate, priorMetrics.onTimeRate, { suffix: 'pp', decimals: 0 })
          : undefined,
        upIsGood: true,
      },
      {
        label: 'Avg fulfillment',
        value: current.avgFulfillmentDays == null ? '—' : current.avgFulfillmentDays.toFixed(1),
        unit: current.avgFulfillmentDays == null ? undefined : 'd',
        delta: (current.avgFulfillmentDays != null && priorMetrics.avgFulfillmentDays != null)
          ? formatDelta(current.avgFulfillmentDays, priorMetrics.avgFulfillmentDays, { suffix: 'd', decimals: 1 })
          : undefined,
        upIsGood: false,
      },
      {
        label: 'Overdue',
        value: current.overdueCount.toLocaleString(),
        subtitle: current.avgDaysOverdue == null ? 'All on track' : `avg ${current.avgDaysOverdue.toFixed(1)}d late`,
        // Overdue compares against itself (no prior) — just show the count.
      },
      {
        label: 'Total qty',
        value: current.totalQty.toLocaleString(),
        delta: formatDeltaPct(current.totalQty, priorMetrics.totalQty),
        upIsGood: true,
      },
    ];
  }, [derived]);

  // ── Bar-chart inputs ─────────────────────────────────────────────────────
  const customerItems: BarItem[] = useMemo(() => {
    if (!derived) return [];
    return derived.customers.map(c => {
      const color = c.dominantCategory
        ? getCategoryColor(c.dominantCategory.id, c.dominantCategory.color as CategoryColorKey | null)
        : null;
      return {
        key: c.name,
        label: c.name,
        value: c.count,
        barColor: color?.dot ?? 'bg-primary',
        dotColor: color?.dot,
        caption: c.dominantCategory ? `mostly ${c.dominantCategory.name}` : undefined,
      };
    });
  }, [derived]);

  const dimensionItems: BarItem[] = useMemo(() => {
    if (!derived) return [];
    return derived.dims.map(d => ({
      key: d.pair,
      label: d.pair,
      value: d.count,
      barColor: 'bg-primary',
    }));
  }, [derived]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-12">
      {/* Top bar */}
      <div className="flex items-start gap-3 mb-4">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center transition-colors shrink-0"
          aria-label="Back to dashboard"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2 leading-tight">
            Statistics
            <span className="inline-flex items-center h-4 px-1.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest">
              Admin
            </span>
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-1 tabular-nums">
            <span className="font-semibold text-foreground">{period.label}</span>
            <span className="opacity-50"> · </span>
            {period.from} → {period.to}
            <span className="opacity-50"> · vs </span>
            {prior.from} → {prior.to}
          </p>
        </div>
      </div>

      {/* Sticky period picker */}
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* Error */}
      {error && !loading && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl mt-4 text-sm font-medium">
          Couldn&apos;t load statistics. Please refresh the page.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {loading || !derived ? (
          <StatsSkeleton />
        ) : (
          <>
            {/* Strip — top */}
            <MetricStrip metrics={metrics} />

            {/* Category Performance + Doors Made — paired */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <CategoryPerformance data={derived.cats} totalOrders={derived.current.totalOrders} />
              </div>
              <div className="lg:col-span-7">
                <DoorsMade />
              </div>
            </div>

            {/* Order Trend + Day-of-Week — grouped, both time-based */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8">
                <OrderTrend data={derived.daily} />
              </div>
              <div className="lg:col-span-4">
                <DayOfWeekPanel data={derived.dow} />
              </div>
            </div>

            {/* Top Customers + Top Dimensions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7">
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Top Customers</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Top 10 by order count · bar color = dominant category</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {derived.repeat.totalCustomers} unique
                    </span>
                  </div>
                  <HorizontalBarChart
                    items={customerItems}
                    emptyMessage="No customers in this period"
                    labelWidth="clamp(140px, 32%, 220px)"
                  />
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 h-full flex flex-col">
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">Top Dimensions</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Most ordered length × width</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top 10</span>
                  </div>
                  <HorizontalBarChart
                    items={dimensionItems}
                    emptyMessage="No dimension data in this period"
                    labelWidth="clamp(100px, 28%, 170px)"
                  />
                </div>
              </div>
            </div>

            {/* Status donut + Period comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <StatusDonut data={derived.statusDist} />
              </div>
              <div className="lg:col-span-8">
                <PeriodComparison current={derived.current} prior={derived.priorMetrics} />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
              Computed live · respects access policies · {user.profile.full_name ?? user.email}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
