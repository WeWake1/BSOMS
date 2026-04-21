'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategoryAndItems, Category } from '@/types/database';

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

        const { data: ords, error: ordsError } = await supabase
          .from('orders')
          .select('*, categories(*)')
          .order('created_at', { ascending: false });

        if (ordsError) throw ordsError;
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
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === updatedOrder.id
                      ? (updatedOrder as OrderWithCategoryAndItems)
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
      supabase.removeChannel(categoryChannel);
    };
  }, [supabase]);

  return { orders, categories, loading, error, flashIds, newIds, isConnected };
}
