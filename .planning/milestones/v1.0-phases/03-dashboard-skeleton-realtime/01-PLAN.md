---
plan: 01
phase: 3
wave: 1
title: Data Fetching and Realtime Hook
depends_on: []
files_modified:
  - hooks/useOrders.ts
autonomous: true
requirements_addressed: [RT-01, DASH-01]
---

# Plan 01: Data Fetching and Realtime Hook

## Objective

Build a custom React hook `useOrders` that fetches all orders and categories from Supabase, and subscribes to real-time changes to the `orders` table.

## Context

<read_first>
- .planning/phases/03-dashboard-skeleton-realtime/03-CONTEXT.md
- lib/supabase/client.ts
- types/database.ts
</read_first>

## Tasks

### Task 1.1: Create `useOrders` hook

<action>
Create `hooks/useOrders.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategory, Category } from '@/types/database';

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function fetchInitialData() {
      try {
        setLoading(true);
        // Fetch categories first
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('*')
          .order('name');
          
        if (catsError) throw catsError;
        if (mounted) setCategories(cats || []);

        // Fetch orders joined with categories
        const { data: ords, error: ordsError } = await supabase
          .from('orders')
          .select('*, categories(*)')
          .order('due_date', { ascending: true })
          .order('created_at', { ascending: false });

        if (ordsError) throw ordsError;
        
        // Supabase join returns category as an array or object depending on relation,
        // cast cleanly for typescript:
        if (mounted) {
          setOrders((ords as unknown as OrderWithCategory[]) || []);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchInitialData();

    // Set up Realtime Subscription
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.event === 'INSERT') {
            const newOrder = payload.new as any;
            // Fetch the category name for this new order to inject it
            supabase
              .from('categories')
              .select('*')
              .eq('id', newOrder.category_id)
              .single()
              .then(({ data: cat }) => {
                newOrder.categories = cat;
                setOrders((prev) => [newOrder as OrderWithCategory, ...prev]);
              });
          } else if (payload.event === 'UPDATE') {
            const updatedOrder = payload.new as any;
            supabase
              .from('categories')
              .select('*')
              .eq('id', updatedOrder.category_id)
              .single()
              .then(({ data: cat }) => {
                updatedOrder.categories = cat;
                setOrders((prev) =>
                  prev.map((o) => (o.id === updatedOrder.id ? (updatedOrder as OrderWithCategory) : o))
                );
              });
          } else if (payload.event === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { orders, categories, loading, error };
}
```
</action>

<acceptance_criteria>
- `hooks/useOrders.ts` created
- Exports `useOrders` which returns `{ orders, categories, loading, error }`
- Initial fetch gets orders and categories
- Sets up a Supabase channel for `postgres_changes` on `public.orders`
- Handles INSERT, UPDATE, DELETE by modifying local state
- Fetches category info for real-time inserts/updates
- Cleans up subscription on unmount
</acceptance_criteria>
