'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchPricelistNodes,
  fetchSuppliers,
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
 */
export function usePricelist() {
  const [nodes, setNodes] = useState<PricelistNodeWithRelations[]>([]);
  const [tree, setTree] = useState<PricelistTreeNode[]>([]);
  const [suppliers, setSuppliers] = useState<PricelistSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supabase] = useState(() => createClient());
  const mountedRef = useRef(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [nodeRows, supplierRows] = await Promise.all([
        fetchPricelistNodes(supabase),
        fetchSuppliers(supabase),
      ]);
      if (!mountedRef.current) return;
      setNodes(nodeRows);
      setTree(buildTree(nodeRows));
      setSuppliers(supplierRows);
      setError(null);
    } catch (err) {
      console.error('Error fetching pricelist:', err);
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase]);

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
      .subscribe();

    return () => {
      mountedRef.current = false;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, load, scheduleRefetch]);

  return { nodes, tree, suppliers, loading, error, reload: load };
}
