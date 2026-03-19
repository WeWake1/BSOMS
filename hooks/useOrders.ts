'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategory, Category } from '@/types/database';

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // createClient() needs to be handled carefully in a hook to avoid recreating it on every render.
  // We can just instantiate it once.
  const [supabase] = useState(() => createClient());

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
          .order('created_at', { ascending: false });

        if (ordsError) throw ordsError;
        
        // Supabase join returns category as an array or object depending on relation,
        // since it's a many-to-one (orders -> category), it usually returns a single object.
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

    // Set up Realtime Subscription for the Dashboard
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            supabase
              .from('categories')
              .select('*')
              .eq('id', newOrder.category_id)
              .single()
              .then(({ data: cat }) => {
                newOrder.categories = cat;
                setOrders((prev) => [newOrder as OrderWithCategory, ...prev]);
              });
          } else if (payload.eventType === 'UPDATE') {
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
          } else if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as any;
            setOrders((prev) => prev.filter((o) => o.id !== oldRecord.id));
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
