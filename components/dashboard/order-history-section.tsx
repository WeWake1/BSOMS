'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { OrderActivityLog, OrderStatus } from '@/types/database';

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  orderId: string;
}

export function OrderHistorySection({ orderId }: Props) {
  const [supabase] = useState(() => createClient());
  const [expanded, setExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [logs, setLogs] = useState<OrderActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await (supabase
        .from('order_activity_logs') as any)
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false })
        .limit(100);
      if (err) throw err;
      setLogs((data ?? []) as OrderActivityLog[]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [supabase, orderId]);

  useEffect(() => {
    if (expanded && !hasFetched) fetchLogs();
  }, [expanded, hasFetched, fetchLogs]);

  // Reset when order changes
  useEffect(() => {
    setExpanded(false);
    setHasFetched(false);
    setLogs([]);
  }, [orderId]);

  return (
    <div className="mt-2 bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-tap"
        aria-expanded={expanded}
        aria-controls={`order-history-${orderId}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 flex items-center justify-center" aria-hidden="true">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Activity</p>
            <p className="text-xs text-muted-foreground">Status changes & history for this order</p>
          </div>
        </div>
        <svg className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div id={`order-history-${orderId}`} className="border-t border-border">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : logs.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              No activity recorded for this order yet.
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {logs.map(log => (
                <li key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1" aria-hidden="true">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      log.event_type === 'created' && 'bg-emerald-500',
                      log.event_type === 'status_changed' && 'bg-sky-500',
                      log.event_type === 'deleted' && 'bg-rose-500',
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-semibold">{log.changed_by_name || 'system'}</span>
                      {log.changed_by_role && log.changed_by_role !== 'system' && (
                        <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          ({log.changed_by_role})
                        </span>
                      )}{' '}
                      <span className="text-muted-foreground">
                        {log.event_type === 'created' && 'created this order'}
                        {log.event_type === 'status_changed' && 'changed status'}
                        {log.event_type === 'deleted' && 'deleted this order'}
                      </span>
                    </p>
                    {log.event_type === 'status_changed' && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {log.from_status && <Badge status={log.from_status as OrderStatus} className="text-[10px] px-2 py-0.5" />}
                        <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                        {log.to_status && <Badge status={log.to_status as OrderStatus} className="text-[10px] px-2 py-0.5" />}
                      </div>
                    )}
                    {log.event_type === 'created' && log.to_status && (
                      <div className="mt-1">
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
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
