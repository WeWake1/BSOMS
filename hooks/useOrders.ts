'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategoryAndItems, Category, OrderItem } from '@/types/database';

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithCategoryAndItems[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const newTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [supabase] = useState(() => createClient());

  const addFlash = (id: string) => {
    setFlashIds((prev) => new Set(prev).add(id));
    const existing = flashTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFlashIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      flashTimers.current.delete(id);
    }, 1800);
    flashTimers.current.set(id, t);
  };

  const addNew = (id: string) => {
    setNewIds((prev) => new Set(prev).add(id));
    const t = setTimeout(() => {
      setNewIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      newTimers.current.delete(id);
    }, 900);
    newTimers.current.set(id, t);
  };

  /** Re-fetch order_items for a specific order and update state */
  const refreshOrderItems = async (orderId: string) => {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, order_items: (items as OrderItem[]) || [] }
          : o
      )
    );
  };

  useEffect(() => {
    let mounted = true;

    async function fetchInitialData() {
      try {
        setLoading(true);
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('*')
          .order('name');

        if (catsError) throw catsError;
        if (mounted) setCategories(cats || []);

        // Try to fetch with sub-items; fall back gracefully if order_items table doesn't exist yet
        let ords: any[] | null = null;
        const { data: ordsWithItems, error: ordsError } = await supabase
          .from('orders')
          .select('*, categories(*), order_items(*)')
          .order('created_at', { ascending: false });

        if (ordsError) {
          // order_items table likely missing — fall back to orders without sub-items
          console.warn('order_items unavailable, loading orders without sub-items:', ordsError.message);
          const { data: ordsBasic, error: basicError } = await supabase
            .from('orders')
            .select('*, categories(*)')
            .order('created_at', { ascending: false });
          if (basicError) throw basicError;
          ords = (ordsBasic || []).map((o: any) => ({ ...o, order_items: [] }));
        } else {
          ords = ordsWithItems || [];
        }

        if (mounted) setOrders((ords as unknown as OrderWithCategoryAndItems[]) || []);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchInitialData();

    const orderChannel = supabase
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
                newOrder.order_items = []; // New orders start with no sub-items
                setOrders((prev) => [newOrder as OrderWithCategoryAndItems, ...prev]);
                addNew(newOrder.id);
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
                // Preserve existing order_items when updating the order row
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === updatedOrder.id
                      ? { ...(updatedOrder as OrderWithCategoryAndItems), order_items: o.order_items || [] }
                      : o
                  )
                );
                addFlash(updatedOrder.id);
              });
          } else if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as any;
            setOrders((prev) => prev.filter((o) => o.id !== oldRecord.id));
          }
        }
      )
      .subscribe((status) => {
        if (mounted) setIsConnected(status === 'SUBSCRIBED');
      });

    // Realtime subscription for order_items changes
    const orderItemsChannel = supabase
      .channel('public:order_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          // For any change to order_items, re-fetch the parent order's items
          const orderId =
            (payload.new as any)?.order_id || (payload.old as any)?.order_id;
          if (orderId) {
            refreshOrderItems(orderId);
            addFlash(orderId); // Flash the parent order card
          }
        }
      )
      .subscribe();

    const categoryChannel = supabase
      .channel('public:categories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCategories(prev => [...prev, payload.new as Category].sort((a, b) => a.name.localeCompare(b.name)));
          } else if (payload.eventType === 'UPDATE') {
            setCategories(prev => prev.map(c => c.id === (payload.new as Category).id ? (payload.new as Category) : c).sort((a, b) => a.name.localeCompare(b.name)));
          } else if (payload.eventType === 'DELETE') {
            setCategories(prev => prev.filter(c => c.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      flashTimers.current.forEach(clearTimeout);
      newTimers.current.forEach(clearTimeout);
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(orderItemsChannel);
      supabase.removeChannel(categoryChannel);
    };
  }, [supabase]);

  return { orders, categories, loading, error, flashIds, newIds, isConnected };
}
