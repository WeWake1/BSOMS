'use client';

import { useState, useEffect, useRef } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatInches } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { OrderWithCategoryAndItems } from '@/types/database';
import toast from 'react-hot-toast';

interface OrderDetailSheetProps {
  order: OrderWithCategoryAndItems | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onEdit: () => void;
}

export function OrderDetailSheet({ order, isOpen, onClose, isAdmin, onEdit }: OrderDetailSheetProps) {
  // M10: stable supabase client via useState
  const [supabase] = useState(() => createClient());
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  // C1: inline delete confirmation instead of window.confirm
  const [confirmDelete, setConfirmDelete] = useState(false);
  // H7: ref for focus management in expanded photo
  const closePhotoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (order?.photo_url && isOpen) {
      if (order.photo_url.startsWith('http')) {
        setSignedUrl(order.photo_url);
      } else {
        supabase.storage.from('order-photos')
          .createSignedUrl(order.photo_url, 3600)
          .then(({ data }) => {
            if (data) setSignedUrl(data.signedUrl);
          });
      }
    } else {
      setSignedUrl(null);
    }
  }, [order?.photo_url, isOpen, supabase]);

  useEffect(() => {
    if (order?.audio_url && isOpen) {
      if (order.audio_url.startsWith('http')) {
        setSignedAudioUrl(order.audio_url);
      } else {
        supabase.storage.from('order-audio')
          .createSignedUrl(order.audio_url, 3600)
          .then(({ data }) => {
            if (data) setSignedAudioUrl(data.signedUrl);
          });
      }
    } else {
      setSignedAudioUrl(null);
    }
  }, [order?.audio_url, isOpen, supabase]);

  // Reset confirmation state when sheet closes
  useEffect(() => {
    if (!isOpen) setConfirmDelete(false);
  }, [isOpen]);

  // H7: Focus close button when photo expands
  useEffect(() => {
    if (photoExpanded) {
      requestAnimationFrame(() => closePhotoRef.current?.focus());
    }
  }, [photoExpanded]);

  // H7: Escape key closes expanded photo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (photoExpanded && e.key === 'Escape') setPhotoExpanded(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [photoExpanded]);

  if (!order) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      onClose();
    } catch {
      toast.error("Couldn't delete this order. Please try again.");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen && !photoExpanded}
        onClose={onClose}
        title={order.order_no}
        titleTransitionName={`order-num-${order.id}`}
      >
        <div className="flex flex-col gap-5 pt-2">

          <div className="flex justify-between items-start">
            <div>
              {/* M1: replaced text-gray-900/text-gray-500 with semantic tokens */}
              <h3 className="text-xl font-bold text-foreground leading-tight mb-1">{order.customer_name}</h3>
              <p className="text-sm font-medium text-muted-foreground">{order.categories?.name || 'Uncategorized'}</p>
            </div>
            <Badge status={order.status} className="mt-1 shadow-sm text-sm px-3 py-1.5" />
          </div>

          {signedUrl && (
            <button
              className="w-full h-48 bg-muted rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform min-tap group"
              onClick={() => setPhotoExpanded(true)}
              aria-label={`View full-size photo for order ${order.order_no}`}
            >
              <img
                src={signedUrl}
                alt={`Photo for order ${order.order_no}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                <div className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  Tap to expand
                </div>
              </div>
            </button>
          )}

          {/* H5: audio element with aria-label */}
          {signedAudioUrl && (
            <div className="bg-muted/50 rounded-2xl p-4 border border-border flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </div>
                <span className="text-xs font-bold text-foreground tracking-tight uppercase">Voice Note</span>
              </div>
              <audio
                controls
                src={signedAudioUrl}
                className="w-full h-11 focus:outline-none"
                aria-label="Voice note for this order"
              />
            </div>
          )}


          {/* M1: replaced all bg-gray-50, text-gray-400, text-gray-900, border-gray-100 with tokens */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-xl p-3 border border-border">
              <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Due Date</span>
              <span className="block text-sm font-bold text-foreground">{formatDate(order.due_date)}</span>
            </div>
            <div className="bg-muted rounded-xl p-3 border border-border">
              <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Dispatch Date</span>
              <span className="block text-sm font-bold text-foreground">{order.dispatch_date ? formatDate(order.dispatch_date) : '—'}</span>
            </div>
            <div className="bg-muted rounded-xl p-3 border border-border">
              <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Created On</span>
              <span className="block text-sm font-bold text-foreground">{formatDate(order.date)}</span>
            </div>
            <div className="bg-muted rounded-xl p-3 border border-border">
              <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Dimensions & Qty</span>
              <span className="block text-sm font-bold text-foreground">
                {order.length && order.width ? `${formatInches(order.length)} × ${formatInches(order.width)}` : '—'}
                <span className="mx-2 text-muted-foreground">|</span>
                Qty: {order.qty}
              </span>
            </div>
          </div>

          {order.description && (
            <div className="mt-2">
              <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 ml-1">Description</span>
              <p className="text-sm leading-relaxed text-foreground bg-muted rounded-xl p-4 border border-border whitespace-pre-wrap">
                {order.description}
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-border">
              <Button variant="secondary" className="flex-1" onClick={onEdit}>
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Edit Order
              </Button>

              {/* C1 + H2: Inline two-step delete confirmation instead of window.confirm */}
              {confirmDelete ? (
                <div className="flex gap-2 flex-1">
                  <Button variant="ghost" className="flex-1 text-sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" className="flex-1 text-sm" loading={isDeleting} loadingText="Deleting…" onClick={handleDelete}>
                    Yes, Delete
                  </Button>
                </div>
              ) : (
                <Button variant="danger" className="flex-1" onClick={() => setConfirmDelete(true)}>
                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </Drawer>

      {/* H7: Full-screen photo modal — now with role=dialog, aria-modal, Escape, focus trap, 44px close */}
      {photoExpanded && signedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full-size photo for order ${order.order_no}`}
          className="fixed inset-0 z-[60] bg-[oklch(10%_0.01_265)] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPhotoExpanded(false)}
        >
          <img
            src={signedUrl}
            alt={`Full-size photo for order ${order.order_no}`}
            className="w-full h-auto max-h-full object-contain"
          />
          <button
            ref={closePhotoRef}
            className="absolute top-4 right-4 w-11 h-11 bg-foreground/20 text-card rounded-full flex items-center justify-center backdrop-blur hover:bg-foreground/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => { e.stopPropagation(); setPhotoExpanded(false); }}
            aria-label="Close full-size photo"
          >
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
