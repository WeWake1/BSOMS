'use client';

import { useState, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toPng } from 'html-to-image';
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
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { AuthUser } from '@/lib/auth';
import type { OrderStatus, OrderWithCategory } from '@/types/database';

export function DashboardClient({ user }: { user: AuthUser }) {
  const { orders, categories, loading, error, flashIds, newIds, isConnected } = useOrders();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
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
      toast.success(`Moved to ${newStatus}`);
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

  const dashboardRef = useRef<HTMLDivElement>(null);
  const tableExportRef = useRef<HTMLDivElement>(null);

  const handleExportImage = () => {
    if (!tableExportRef.current) return;
    
    toast.promise(
      new Promise<void>(async (resolve, reject) => {
        try {
          // Allow UI to update and close dropdown before capturing
          await new Promise(r => setTimeout(r, 150));
          
          const dataUrl = await toPng(tableExportRef.current!, {
            cacheBust: true,
            pixelRatio: window.devicePixelRatio || 2,
            backgroundColor: '#ffffff', // Report background is always white
            filter: (node) => {
              // Exclude specific elements like the dropdown overlay
              if (node.nodeType === 1) { // Node.ELEMENT_NODE
                const el = node as HTMLElement;
                if (el.classList && el.classList.contains('hidden-from-print')) return false;
              }
              return true;
            }
          });
          
          const link = document.createElement('a');
          link.href = dataUrl;
          const dateStr = new Date().toISOString().split('T')[0];
          link.download = `OrderFlow_Export_${dateStr}.png`;
          link.click();
          resolve();
        } catch (err) {
          console.error('Export Error:', err);
          reject(err);
        }
      }),
      {
        loading: 'Generating image...',
        success: 'Image exported successfully!',
        error: 'Failed to export image.',
      }
    );
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8" ref={dashboardRef}>
      {/* TopBar */}
      <div className="relative z-50 flex justify-between items-center mb-6 animate-fade-up">
        <div>
          <h1 className="text-fluid-2xl font-extrabold text-foreground tracking-tight">Orders</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {loading && orders.length === 0 ? 'Loading…' : `${orders.length} order${orders.length !== 1 ? 's' : ''} · ${counts['In Progress']} in progress`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* H4: Export dropdown button */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={filteredOrders.length === 0}
              className="h-9"
              aria-label="Export options"
            >
              <svg className="w-4 h-4 sm:mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span className="hidden sm:inline">Export</span>
              <svg className="w-3 h-3 ml-1.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </Button>
            
            {isExportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-50 p-1 flex flex-col animate-in fade-in zoom-in-95 duration-100 hidden-from-print">
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      generateOrderReportPDF(filteredOrders);
                    }}
                    className="text-left px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors font-medium"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportImage();
                    }}
                    className="text-left px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors font-medium mt-0.5"
                  >
                    Export as PNG image
                  </button>
                </div>
              </>
            )}
          </div>

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
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          Couldn't load orders. Please refresh the page.
        </div>
      ) : (
        <StatusCards counts={counts} activeFilter={selectedStatus} onFilterClick={setSelectedStatus} isConnected={isConnected} />
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
        totalCount={orders.length}
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
                isNew={newIds.has(order.id)}
                isFlash={flashIds.has(order.id)}
                onClick={() => {
                  const openDetail = () => flushSync(() => setSelectedOrderId(order.id));
                  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
                    (document as any).startViewTransition(openDetail);
                  } else {
                    openDetail();
                  }
                }} 
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
            <p className="font-semibold text-foreground text-base">No orders match your filters</p>
            <p className="text-sm mt-1.5 text-muted-foreground">Try a different status, category, or search term.</p>
            {(searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All') && (
              <Button variant="secondary" size="sm" onClick={handleClearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* FAB (Admin Only) — fixed to viewport, always bottom-right */}
      {isAdmin && (
        <button
          className="fixed bottom-6 right-6 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_20px_-2px_var(--primary)] hover:shadow-[0_8px_32px_-4px_var(--primary)] hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring z-40 min-tap"
          onClick={() => { setSelectedOrderId(null); setIsFormOpen(true); }}
          aria-label="Add Order"
        >
        <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span className="sr-only">Add Order</span>
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
            <h3 className="font-bold text-lg mb-4">When was it dispatched?</h3>
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-medium">Dispatch date</label>
              <input 
                type="date" 
                value={dispatchPromptDate} 
                onChange={e => setDispatchPromptDate(e.target.value)} 
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus 
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDispatchPromptOrder(null)}>Cancel</Button>
              <Button onClick={handleDispatchConfirm}>Mark Dispatched</Button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen Image Export Container */}
      <div 
        className="absolute left-[-9999px] top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div 
          ref={tableExportRef} 
          className="bg-white p-8"
          style={{ width: '1200px' }}
        >
          {/* Header */}
          <div className="flex justify-between items-end border-b border-gray-200 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">OrderFlow — Order Report</h1>
            </div>
            <div className="text-sm text-gray-500 text-right font-medium">
              Exported: {new Date().toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
          
          {/* Table */}
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[10%]">Order No</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[18%]">Customer Name</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[12%]">Category</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[12%]">Status</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[10%]">Date</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[10%]">Due Date</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[10%]">Dispatch</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 text-center w-[6%]">Qty</th>
                <th className="py-3 px-4 font-semibold border border-indigo-700 w-[12%]">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? "bg-white text-gray-800" : "bg-gray-50 text-gray-800"}>
                  <td className="py-2.5 px-4 border border-gray-200">{o.order_no}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{o.customer_name}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{o.categories?.name || 'Uncategorized'}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{o.status}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{formatDate(o.date)}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{formatDate(o.due_date)}</td>
                  <td className="py-2.5 px-4 border border-gray-200">{formatDate(o.dispatch_date)}</td>
                  <td className="py-2.5 px-4 border border-gray-200 text-center font-medium">{o.qty}</td>
                  <td className="py-2.5 px-4 border border-gray-200 break-words">{o.description || ''}</td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-500 border border-gray-200">No orders to display.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            OrderFlow System — Generated Report
          </div>
        </div>
      </div>
    </div>
  );
}
