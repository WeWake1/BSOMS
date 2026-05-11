/**
 * Stats data fetching. Returns three datasets:
 *  - placedInPeriod:     orders with date ∈ [from, to]
 *  - placedInPrior:      orders with date ∈ priorPeriod
 *  - dispatchedInPeriod: orders with status=Dispatched & dispatch_date ∈ [from, to]
 *  - dispatchedInPrior:  same for prior period
 *  - allActive:          ALL orders where status ≠ Dispatched (for overdue calc)
 *
 * One round trip per query, run in parallel. RLS handles auth.
 */

import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategory } from '@/types/database';
import type { Period } from '@/lib/stats-utils';
import { priorPeriod } from '@/lib/stats-utils';

const SELECT = '*, categories ( id, name, color, created_at )';

export interface StatsDatasets {
  placedInPeriod: OrderWithCategory[];
  placedInPrior: OrderWithCategory[];
  dispatchedInPeriod: OrderWithCategory[];
  dispatchedInPrior: OrderWithCategory[];
  allActive: OrderWithCategory[];
}

export async function fetchStatsData(period: Period): Promise<StatsDatasets> {
  const supabase = createClient();
  const prior = priorPeriod(period);

  const [placedRes, placedPriorRes, dispatchedRes, dispatchedPriorRes, activeRes] = await Promise.all([
    supabase.from('orders').select(SELECT).gte('date', period.from).lte('date', period.to),
    supabase.from('orders').select(SELECT).gte('date', prior.from).lte('date', prior.to),
    supabase.from('orders').select(SELECT)
      .eq('status', 'Dispatched')
      .gte('dispatch_date', period.from)
      .lte('dispatch_date', period.to),
    supabase.from('orders').select(SELECT)
      .eq('status', 'Dispatched')
      .gte('dispatch_date', prior.from)
      .lte('dispatch_date', prior.to),
    supabase.from('orders').select(SELECT).neq('status', 'Dispatched'),
  ]);

  const firstError =
    placedRes.error || placedPriorRes.error || dispatchedRes.error ||
    dispatchedPriorRes.error || activeRes.error;
  if (firstError) throw new Error(firstError.message);

  return {
    placedInPeriod: (placedRes.data ?? []) as OrderWithCategory[],
    placedInPrior: (placedPriorRes.data ?? []) as OrderWithCategory[],
    dispatchedInPeriod: (dispatchedRes.data ?? []) as OrderWithCategory[],
    dispatchedInPrior: (dispatchedPriorRes.data ?? []) as OrderWithCategory[],
    allActive: (activeRes.data ?? []) as OrderWithCategory[],
  };
}
