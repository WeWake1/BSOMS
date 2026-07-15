import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PricelistNodeWithRelations,
  PricelistPrice,
  PricelistSupplier,
} from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetch every node with its rate tiers and supplier stitched in.
 *
 * Role split (enforced by RLS, not just here):
 *  - admin  → raw `pricelist_prices` (purchase rate + margin_pct)
 *  - others → `pricelist_prices_selling` view, whose `rate` column IS the
 *    computed selling price; purchase rate and margin never leave the DB.
 *
 * Prices are fetched separately and stitched client-side so both sources
 * produce the exact same PricelistNodeWithRelations shape.
 */
export async function fetchPricelistNodes(
  client: SupabaseClient<any>,
  isAdmin: boolean
): Promise<PricelistNodeWithRelations[]> {
  const priceSource = isAdmin ? 'pricelist_prices' : 'pricelist_prices_selling';

  const [nodesRes, pricesRes] = await Promise.all([
    client
      .from('pricelist_nodes')
      .select('*, supplier:pricelist_suppliers(*)')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from(priceSource)
      .select('*')
      .order('sort_order', { ascending: true }),
  ]);

  if (nodesRes.error) throw nodesRes.error;
  if (pricesRes.error) throw pricesRes.error;

  const pricesByNode = new Map<string, PricelistPrice[]>();
  for (const raw of (pricesRes.data ?? []) as any[]) {
    // View rows carry no margin_pct — normalise so the shape is uniform.
    const price: PricelistPrice = { margin_pct: null, ...raw };
    const list = pricesByNode.get(price.node_id);
    if (list) list.push(price);
    else pricesByNode.set(price.node_id, [price]);
  }

  return ((nodesRes.data ?? []) as any[]).map((node) => ({
    ...node,
    prices: pricesByNode.get(node.id) ?? [],
  })) as PricelistNodeWithRelations[];
}

/** Fetch the supplier directory, alphabetised. */
export async function fetchSuppliers(
  client: SupabaseClient<any>
): Promise<PricelistSupplier[]> {
  const { data, error } = await client
    .from('pricelist_suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PricelistSupplier[];
}

/**
 * Global default selling margin %. Admin-only by RLS — non-admins get no row
 * (and don't need one: their rates arrive already marked up).
 */
export async function fetchDefaultMarginPct(
  client: SupabaseClient<any>
): Promise<number> {
  const { data, error } = await client
    .from('pricelist_settings')
    .select('default_margin_pct')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  return (data as { default_margin_pct: number } | null)?.default_margin_pct ?? 0;
}
