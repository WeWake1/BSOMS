'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth';
import type { OrderActivityLog, OrderEventType, OrderStatus } from '@/types/database';

const PAGE_SIZE = 200;

const EVENT_LABEL: Record<OrderEventType, string> = {
  created: 'Created',
  status_changed: 'Status changed',
  deleted: 'Deleted',
};

// ── Time helpers ─────────────────────────────────────────────────────────
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}
function formatDayHeading(key: string) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Date(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ── Event-specific styling ───────────────────────────────────────────────
function eventIcon(type: OrderEventType) {
  if (type === 'created') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  if (type === 'deleted') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 8 18 11 6 11 6 13 18 13 18 16 22 12" />
    </svg>
  );
}
const EVENT_TINT: Record<OrderEventType, string> = {
  created: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  status_changed: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  deleted: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

// ── Component ────────────────────────────────────────────────────────────
export function LogsClient({ user }: { user: AuthUser }) {
  const [supabase] = useState(() => createClient());
  const [logs, setLogs] = useState<OrderActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<OrderEventType | 'all'>('all');

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const { data, error: err } = await (supabase
        .from('order_activity_logs') as any)
        .select('*')
        .order('changed_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (err) throw err;
      const rows = (data ?? []) as OrderActivityLog[];
      setLogs(prev => offset === 0 ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load activity log');
      toast.error("Couldn't load the activity log.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [supabase]);

  useEffect(() => { load(0); }, [load]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(l => {
      if (eventFilter !== 'all' && l.event_type !== eventFilter) return false;
      if (!q) return true;
      return (
        l.order_no?.toLowerCase().includes(q) ||
        l.customer_name?.toLowerCase().includes(q) ||
        l.changed_by_name?.toLowerCase().includes(q)
      );
    });
  }, [logs, search, eventFilter]);

  // Group by day for headings
  const grouped = useMemo(() => {
    const groups = new Map<string, OrderActivityLog[]>();
    for (const log of filtered) {
      const key = dayKey(new Date(log.changed_at));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: logs.length, created: 0, status_changed: 0, deleted: 0 };
    for (const l of logs) c[l.event_type]++;
    return c;
  }, [logs]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
      {/* TopBar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-tap"
            aria-label="Back to dashboard"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-fluid-2xl font-extrabold text-foreground tracking-tight">Activity Log</h1>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} of ${logs.length} event${logs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order #, customer, or user…"
            className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-input bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Event filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([
          ['all', `All · ${counts.all}`],
          ['created', `Created · ${counts.created}`],
          ['status_changed', `Status · ${counts.status_changed}`],
          ['deleted', `Deleted · ${counts.deleted}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setEventFilter(key as any)}
            className={cn(
              'h-8 px-3 rounded-full border text-xs font-bold transition-colors min-tap',
              eventFilter === key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div role="status" aria-label="Loading activity" className="py-16 text-center text-sm font-medium text-muted-foreground flex flex-col items-center gap-3">
          <svg className="animate-spin w-7 h-7 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading activity…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center border-2 border-dashed border-border rounded-2xl px-6">
          <p className="font-semibold text-foreground text-base">
            {logs.length === 0 ? 'No activity yet' : 'No events match your filters'}
          </p>
          <p className="text-sm mt-1.5 text-muted-foreground">
            {logs.length === 0
              ? 'Order creates, status changes, and deletions will appear here.'
              : 'Try a different search term or filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([key, items]) => (
            <section key={key}>
              <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-2 px-1">
                {formatDayHeading(key)} <span className="text-muted-foreground/60">· {items.length}</span>
              </h2>
              <ul className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {items.map(log => (
                  <LogRow key={log.id} log={log} />
                ))}
              </ul>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => load(logs.length)}
                loading={loadingMore}
                loadingText="Loading…"
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────
function LogRow({ log }: { log: OrderActivityLog }) {
  const tint = EVENT_TINT[log.event_type];
  const initial = (log.changed_by_name?.[0] || '?').toUpperCase();
  const actor = log.changed_by_name || 'system';

  return (
    <li className="flex items-start gap-3 px-3.5 py-3 hover:bg-muted/40 transition-colors">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', tint)} aria-hidden="true">
        {eventIcon(log.event_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">{actor}</span>
          {log.changed_by_role && log.changed_by_role !== 'system' && (
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">({log.changed_by_role})</span>
          )}
          {' '}
          <span className="text-muted-foreground">
            {log.event_type === 'created' && 'created'}
            {log.event_type === 'status_changed' && 'changed'}
            {log.event_type === 'deleted' && 'deleted'}
          </span>
          {' '}
          <span className="font-semibold">{log.order_no || '—'}</span>
          {log.customer_name && (
            <span className="text-muted-foreground"> for <span className="text-foreground font-medium">{log.customer_name}</span></span>
          )}
        </p>
        {log.event_type === 'status_changed' && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {log.from_status && <Badge status={log.from_status as OrderStatus} className="text-[10px] px-2 py-0.5" />}
            <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            {log.to_status && <Badge status={log.to_status as OrderStatus} className="text-[10px] px-2 py-0.5" />}
          </div>
        )}
        {log.event_type === 'created' && log.to_status && (
          <div className="mt-1.5">
            <Badge status={log.to_status as OrderStatus} className="text-[10px] px-2 py-0.5" />
          </div>
        )}
      </div>
      <time
        className="text-[11px] font-medium text-muted-foreground shrink-0 mt-1"
        dateTime={log.changed_at}
        title={new Date(log.changed_at).toLocaleString('en-IN')}
      >
        {relativeTime(log.changed_at)}
      </time>
    </li>
  );
}
