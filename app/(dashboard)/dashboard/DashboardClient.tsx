'use client';

import { useState, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { StatusCards } from '@/components/dashboard/status-cards';
import { FilterBar } from '@/components/dashboard/filter-bar';
import { OrderCard, OrderListItem } from '@/components/dashboard/order-card';
import { Button } from '@/components/ui/button';
import { OrderDetailSheet } from '@/components/dashboard/order-detail-sheet';
import { OrderFormSheet } from '@/components/dashboard/order-form-sheet';
import { SettingsDrawer } from '@/components/dashboard/settings-drawer';
import { generateOrderReportPDF } from '@/lib/pdf-export';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { AuthUser } from '@/lib/auth';
import type { OrderStatus, OrderWithCategory } from '@/types/database';

export function DashboardClient({ user }: { user: AuthUser }) {
  const { orders, categories, loading, error } = useOrders();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'order-asc'>('date-desc');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dispatchPromptOrder, setDispatchPromptOrder] = useState<string | null>(null);
  const [dispatchPromptDate, setDispatchPromptDate] = useState(() => new Date().toISOString().split('T')[0]);

  const activeOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const isAdmin = user.profile.role === 'admin';
  const [supabase] = useState(() => createClient());

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'Dispatched') {
      setDispatchPromptOrder(orderId);
      setDispatchPromptDate(new Date().toISOString().split('T')[0]);
      return;
    }

    // @ts-ignore
    const { error } = await supabase.from('orders').update({ status: newStatus, dispatch_date: null }).eq('id', orderId);
    if (error) {
      toast.error("Couldn't update the order status. Please try again.");
    } else {
      toast.success(`Status moved to ${newStatus}`);
    }
  };

  const handleDispatchConfirm = async () => {
    if (!dispatchPromptOrder) return;
    // @ts-ignore
    const { error } = await supabase.from('orders').update({ status: 'Dispatched', dispatch_date: dispatchPromptDate }).eq('id', dispatchPromptOrder);
    if (error) {
      toast.error("Couldn't mark order as Dispatched. Please try again.");
    } else {
      toast.success('Order marked as Dispatched!');
    }
    setDispatchPromptOrder(null);
  };

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

  const sortedOrders = useMemo(() => {
    let result = [...filteredOrders];
    switch (sortBy) {
      case 'date-asc':
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'date-desc':
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'name-asc':
        result.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.customer_name.localeCompare(a.customer_name));
        break;
      case 'order-asc':
        result.sort((a, b) => a.order_no.localeCompare(b.order_no));
        break;
    }
    return result;
  }, [filteredOrders, sortBy]);

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
          <h1 className="text-fluid-2xl font-extrabold text-foreground tracking-tight">Orders</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Live overview of workflow</p>
        </div>
        <div className="flex items-center gap-2">
          {/* H4: Single export button, visible on all screen sizes */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => generateOrderReportPDF(filteredOrders)}
            disabled={filteredOrders.length === 0}
            className="h-9"
            aria-label="Export PDF report"
          >
            <svg className="w-4 h-4 sm:mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="hidden sm:inline">Export</span>
          </Button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-tap border border-primary/20 ml-1"
            aria-label="User Settings"
          >
            <span className="font-bold text-sm tracking-tight">
              {user.profile.full_name ? user.profile.full_name[0].toUpperCase() : (user.email?.[0]?.toUpperCase() || 'U')}
            </span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          Couldn't load orders. Please refresh the page.
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
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />


      {/* H4: Mobile export row removed — now in top bar */}

      {/* Orders List */}
      <div className={viewMode === 'card' ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-4 flex flex-col gap-0 rounded-2xl border border-border bg-card overflow-hidden shadow-sm"}>
        {/* H1: role=status + aria-label on main loading spinner */}
        {loading && orders.length === 0 ? (
          <div role="status" aria-label="Loading orders" className="py-16 text-center text-sm font-medium text-muted-foreground flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Loading orders...
          </div>
        ) : sortedOrders.length > 0 ? (
          viewMode === 'card' ? (
            sortedOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                isAdmin={isAdmin}
                onStatusChange={(status) => handleStatusChange(order.id, status)}
                onClick={() => setSelectedOrderId(order.id)} 
              />
            ))
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                  <tr>
                    {/* M8: scope=col on all th elements */}
                    <th scope="col" className="px-3 sm:px-6 py-3 font-semibold w-[130px]">Order #</th>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-semibold hidden sm:table-cell">Size</th>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-semibold text-right">Qty</th>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedOrders.map(order => (
                    <OrderListItem 
                      key={order.id} 
                      order={order} 
                      isAdmin={isAdmin}
                      onStatusChange={(status) => handleStatusChange(order.id, status)}
                      onClick={() => setSelectedOrderId(order.id)} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : !loading ? (
          // M7: removed generic circle-icon+heading empty state (anti-pattern)
          <div className="py-14 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl mt-4 px-6">
            <p className="font-semibold text-foreground text-base">No orders found</p>
            <p className="text-sm mt-1.5">Try adjusting your filters or search query.</p>
            {(searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All') && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* FAB (Admin Only) — fixed to viewport, always bottom-right */}
      {isAdmin && (
        <button
          className="fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl shadow-indigo-300/50 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 z-40 min-tap"
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

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        categories={categories}
      />

      {/* Dispatch Date Modal */}
      {dispatchPromptOrder && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-5 border border-border">
            <h3 className="font-bold text-lg mb-2">Set Dispatch Date</h3>
            <p className="text-sm text-muted-foreground mb-4">Please specify when this order was dispatched to complete the update.</p>
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-medium">Dispatch Date</label>
              <input 
                type="date" 
                value={dispatchPromptDate} 
                onChange={e => setDispatchPromptDate(e.target.value)} 
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus 
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDispatchPromptOrder(null)}>Cancel</Button>
              <Button onClick={handleDispatchConfirm}>Confirm & Dispatch</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
