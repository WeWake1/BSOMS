'use client';

import { useState, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { StatusCards } from '@/components/dashboard/status-cards';
import { FilterBar } from '@/components/dashboard/filter-bar';
import { OrderCard } from '@/components/dashboard/order-card';
import { Button } from '@/components/ui/button';
import { OrderDetailSheet } from '@/components/dashboard/order-detail-sheet';
import { OrderFormSheet } from '@/components/dashboard/order-form-sheet';
import type { AuthUser } from '@/lib/auth';
import type { OrderStatus, OrderWithCategory } from '@/types/database';

export function DashboardClient({ user }: { user: AuthUser }) {
  const { orders, categories, loading, error } = useOrders();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const activeOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const isAdmin = user.profile.role === 'admin';

  const counts = useMemo(() => {
    return {
      'Pending': orders.filter(o => o.status === 'Pending').length,
      'In Progress': orders.filter(o => o.status === 'In Progress').length,
      'Packing': orders.filter(o => o.status === 'Packing').length,
      'Dispatched': orders.filter(o => o.status === 'Dispatched').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (selectedStatus !== 'All' && order.status !== selectedStatus) return false;
      if (selectedCategory !== 'All' && order.category_id !== selectedCategory) return false;
      
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const customerMatch = order.customer_name.toLowerCase().includes(query);
        const orderNoMatch = order.order_no.toLowerCase().includes(query);
        if (!customerMatch && !orderNoMatch) return false;
      }
      
      return true;
    });
  }, [orders, selectedStatus, selectedCategory, searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('All');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
      {/* TopBar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Live overview of workflow</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => console.log('PDF export Phase 6')}>
          <svg className="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z"/><path d="m18 16-3-3"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          Export PDF
        </Button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          Failed to load orders: {error}
        </div>
      ) : (
        <StatusCards counts={counts} activeFilter={selectedStatus} onFilterClick={setSelectedStatus} />
      )}

      <FilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        categories={categories}
        onClear={handleClearFilters}
        resultCount={filteredOrders.length}
      />

      {/* Orders List */}
      <div className="mt-4 flex flex-col gap-3">
        {loading && orders.length === 0 ? (
          <div className="py-16 text-center text-sm font-medium text-gray-500 flex flex-col items-center gap-3">
             <svg className="animate-spin w-8 h-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             Loading orders...
          </div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onClick={() => setSelectedOrderId(order.id)} 
            />
          ))
        ) : !loading ? (
          <div className="py-16 bg-white rounded-3xl border border-gray-100 border-dashed text-center mt-2 flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 mb-4 text-gray-400">
               <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">No orders found</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Try adjusting your filters.</p>
            {(searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All') && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* FAB (Admin Only) */}
      {isAdmin && (
        <button
          className="fixed bottom-safe right-4 sm:right-auto sm:left-1/2 sm:ml-[16.5rem] bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 z-50 min-tap mb-4"
          onClick={() => { setSelectedOrderId(null); setIsFormOpen(true); }}
          aria-label="Add Order"
        >
          <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      <OrderDetailSheet 
        order={activeOrder}
        isOpen={!!selectedOrderId && !isFormOpen}
        onClose={() => setSelectedOrderId(null)}
        isAdmin={isAdmin}
        onEdit={() => setIsFormOpen(true)}
      />

      <OrderFormSheet
        order={activeOrder}
        categories={categories}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setSelectedOrderId(null); }}
      />
    </div>
  );
}
