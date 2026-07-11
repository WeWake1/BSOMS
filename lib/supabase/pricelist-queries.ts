import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PricelistNodeWithRelations,
  PricelistSupplier,
} from '@/types/database';

/**
 * Canonical select for a node together with its rate tiers and supplier.
 * Used by the realtime hook and any server-side fetch so the joined shape
 * always matches PricelistNodeWithRelations.
 */
export const NODE_SELECT =
  '*, prices:pricelist_prices(*), supplier:pricelist_suppliers(*)';

/** Fetch every node (with prices + supplier). Tree is built client-side. */
export async function fetchPricelistNodes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>
): Promise<PricelistNodeWithRelations[]> {
  const { data, error } = await client
    .from('pricelist_nodes')
    .select(NODE_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PricelistNodeWithRelations[];
}

/** Fetch the supplier directory, alphabetised. */
export async function fetchSuppliers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>
): Promise<PricelistSupplier[]> {
  const { data, error } = await client
    .from('pricelist_suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PricelistSupplier[];
}
