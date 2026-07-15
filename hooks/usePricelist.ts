'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchPricelistNodes,
  fetchSuppliers,
  fetchDefaultMarginPct,
} from '@/lib/supabase/pricelist-queries';
import { buildTree } from '@/lib/pricelist-utils';
import type {
  PricelistNodeWithRelations,
  PricelistSupplier,
  PricelistTreeNode,
} from '@/types/database';

/**
 * Loads the full pricelist (nodes + suppliers), builds the tree, and keeps it
 * live via Supabase Realtime. Edits are infrequent, so any change triggers a
 * debounced refetch rather than surgical patching — simpler and always correct.
 *
 * Role-aware: admins get raw purchase rates + margins (and the global default
 * margin); everyone else gets rows whose `rate` is already the selling price.
 * Staff/viewer can't receive realtime on `pricelist_prices` (RLS filters it),
 * so a DB trigger bumps the parent node's updated_at on any price change —
 * their `pricelist_nodes` subscription picks that up.
 */
export function usePricelist(isAdmin: boolean) {
  const [nodes, setNodes] = useState<PricelistNodeWithRelations[]>([]);
  const [tree, setTree] = useState<PricelistTreeNode[]>([]);
  const [suppliers, setSuppliers] = useState<PricelistSupplier[]>([]);
  const [defaultMarginPct, setDefaultMarginPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supabase] = useState(() => createClient());
  const mountedRef = useRef(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [nodeRows, supplierRows, marginPct] = await Promise.all([
        fetchPricelistNodes(supabase, isAdmin),
        fetchSuppliers(supabase),
        isAdmin ? fetchDefaultMarginPct(supabase) : Promise.resolve(0),
      ]);
      if (!mountedRef.current) return;
      setNodes(nodeRows);
      setTree(buildTree(nodeRows));
      setSuppliers(supplierRows);
      setDefaultMarginPct(marginPct);
      setError(null);
    } catch (err) {
      console.error('Error fetching pricelist:', err);
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, isAdmin]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(load, 250);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    load();

    const channel = supabase
      .channel('public:pricelist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricelist_nodes' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricelist_prices' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricelist_suppliers' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricelist_settings' }, scheduleRefetch)
      .subscribe();

    return () => {
      mountedRef.current = false;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, load, scheduleRefetch]);

  return { nodes, tree, suppliers, defaultMarginPct, loading, error, reload: load };
}
