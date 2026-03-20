'use client';

import { useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategory } from '@/types/database';

interface OrderDetailSheetProps {
  order: OrderWithCategory | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onEdit: () => void;
}

export function OrderDetailSheet({ order, isOpen, onClose, isAdmin, onEdit }: OrderDetailSheetProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const supabase = createClient();

  if (!order) return null;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      onClose();
    } catch (err: any) {
      alert('Failed to delete order: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Drawer isOpen={isOpen && !photoExpanded} onClose={onClose} title={`Order: ${order.order_no}`}>
        <div className="flex flex-col gap-5 pt-2">
          
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-900 leading-tight mb-1">{order.customer_name}</h3>
              <p className="text-sm font-medium text-gray-500">{order.categories?.name || 'Uncategorized'}</p>
            </div>
            <Badge status={order.status} className="mt-1 shadow-sm text-sm px-3 py-1.5" />
          </div>

          {order.photo_url && (
            <button 
              className="w-full h-48 bg-gray-100 rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform min-tap group"
              onClick={() => setPhotoExpanded(true)}
            >
              <img 
                src={order.photo_url} 
                alt={`Photo for order ${order.order_no}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  Tap to expand
                </div>
              </div>
            </button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">Due Date</span>
              <span className="block text-sm font-bold text-gray-900">{formatDate(order.due_date)}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">Dispatch Date</span>
              <span className="block text-sm font-bold text-gray-900">{order.dispatch_date ? formatDate(order.dispatch_date) : '—'}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">Created On</span>
              <span className="block text-sm font-bold text-gray-900">{formatDate(order.date)}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <span className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">Dimensions & Qty</span>
              <span className="block text-sm font-bold text-gray-900">
                {order.length && order.width ? `${order.length} × ${order.width} cm` : 'No dims'}
                <span className="mx-2 text-gray-300">|</span> 
                Qty: {order.qty}
              </span>
            </div>
          </div>

          {order.description && (
            <div className="mt-2">
              <span className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1.5 ml-1">Description</span>
              <p className="text-sm leading-relaxed text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-100 whitespace-pre-wrap">
                {order.description}
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              <Button variant="secondary" className="flex-1" onClick={onEdit}>
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Edit Order
              </Button>
              <Button variant="danger" className="flex-1" loading={isDeleting} onClick={handleDelete}>
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                Delete
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {/* Full screen photo modal */}
      {photoExpanded && order.photo_url && (
        <div 
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPhotoExpanded(false)}
        >
          <img 
            src={order.photo_url} 
            alt="Expanded view"
            className="w-full h-auto max-h-full object-contain"
          />
          <button 
            className="absolute top-safe right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur"
            onClick={(e) => {
              e.stopPropagation();
              setPhotoExpanded(false);
            }}
          >
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
