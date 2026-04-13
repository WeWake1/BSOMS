'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectPopover, SelectListBox } from '@/components/ui/select';
import type { OrderWithCategoryAndItems, Category, OrderStatus, SubItemDraft, OrderFormDraft } from '@/types/database';
import toast from 'react-hot-toast';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Drag-to-reorder hook ─────────────────────────────────────────────────────

function useDragSort<T>(items: T[], setItems: (items: T[]) => void) {
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex.current, 1);
    newItems.splice(index, 0, moved);
    dragIndex.current = index;
    setItems(newItems);
  };

  const handleDragEnd = () => { dragIndex.current = null; };

  const handleTouchStart = (index: number) => () => {
    dragIndex.current = index;
  };

  const handleTouchEnd = () => { dragIndex.current = null; };

  return { handleDragStart, handleDragOver, handleDragEnd, handleTouchStart, handleTouchEnd };
}

// ── Sub-item photo/audio fields ──────────────────────────────────────────────

function SubItemPhotoField({
  tempId, photoPath, isUploading, onUpload, onRemove,
}: {
  tempId: string; photoPath: string | null; isUploading: boolean;
  onUpload: (file: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">Photo</label>
      {photoPath ? (
        <div className="relative w-full h-28 bg-muted rounded-xl overflow-hidden border border-border group">
          <button type="button" onClick={onRemove}
            className="absolute top-2 right-2 bg-foreground/60 text-card rounded-full w-7 h-7 flex items-center justify-center hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 min-tap"
            aria-label="Remove item photo">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">Photo attached</div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full h-14 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
          disabled={isUploading}>
          {isUploading ? <span>Uploading...</span> : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Add photo</span></>}
        </button>
      )}
      <input ref={ref} type="file" className="hidden" accept="image/*, .heic" id={`item-photo-${tempId}`}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
    </div>
  );
}

function SubItemAudioField({
  tempId, audioPath, isUploading, isRecording, onStart, onDelete,
}: {
  tempId: string; audioPath: string | null; isUploading: boolean; isRecording: boolean;
  onStart: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">Voice Note</label>
      {audioPath ? (
        <div className="bg-muted border border-border rounded-xl p-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Audio attached</span>
          <button type="button" onClick={onDelete}
            className="text-xs font-bold text-destructive hover:text-destructive/80 py-1 px-2 rounded-md hover:bg-destructive/10 transition-colors min-tap">
            Delete
          </button>
        </div>
      ) : isRecording ? (
        <div className="w-full h-12 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-primary">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"/>
          Recording…
        </div>
      ) : (
        <button type="button" onClick={onStart}
          className="w-full h-14 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
          disabled={isUploading}>
          {isUploading ? <span>Uploading...</span> : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg><span>Add voice note</span></>}
        </button>
      )}
    </div>
  );
}

// ── Sub-item accordion card ──────────────────────────────────────────────────

interface SubItemCardProps {
  item: SubItemDraft;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (updated: SubItemDraft) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  onPhotoUpload: (tempId: string, file: File) => void;
  onPhotoRemove: (tempId: string) => void;
  onAudioRecord: (tempId: string) => void;
  onAudioDelete: (tempId: string) => void;
  photoUploadingIds: Set<string>;
  audioUploadingIds: Set<string>;
  audioRecordingId: string | null;
  categories: Category[];
}

function SubItemCard({
  item, index, isExpanded, onToggle, onChange, onRemove,
  dragHandleProps, isDragging,
  onPhotoUpload, onPhotoRemove, onAudioRecord, onAudioDelete,
  photoUploadingIds, audioUploadingIds, audioRecordingId,
  categories,
}: SubItemCardProps) {
  const catName = categories.find(c => c.id === item.categoryId)?.name || 'Select Category';
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card overflow-hidden transition-shadow",
      isDragging && "shadow-lg ring-2 ring-primary/20"
    )}>
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Drag handle */}
        <div {...dragHandleProps}
          className="min-tap flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
            <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
            <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
          </svg>
        </div>

        {/* Summary — tap to toggle expand */}
        <button type="button" onClick={onToggle} className="flex-1 text-left min-tap" aria-expanded={isExpanded}>
          <span className="text-sm font-bold text-foreground">
            <span className="text-muted-foreground font-semibold">{index + 1}.{' '}</span>
            {catName}
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {[
              item.length && item.width ? `${item.length}×${item.width}cm` : null,
              item.qty ? `Qty: ${item.qty}` : null,
              item.dueDate ? `Due: ${new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </button>

        {/* Status badge */}
        <Badge status={item.status} className="text-[10px] px-2 py-0.5 shrink-0" />

        {/* Expand chevron */}
        <button type="button" onClick={onToggle}
          className="min-tap p-1 text-muted-foreground"
          aria-label={isExpanded ? 'Collapse item' : 'Expand item'}>
          <svg className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* Expanded content — grid-template-rows for smooth height animation */}
      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-3 pb-4 pt-1 border-t border-border flex flex-col gap-4">

            {/* Category dropdown — this IS the item identifier */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Category</label>
              <Select
                selectedKey={item.categoryId}
                onSelectionChange={(k) => onChange({ ...item, categoryId: k as string })}
                aria-label="Item category"
              >
                <SelectTrigger id={`item-cat-${item.tempId}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopover>
                  <SelectListBox>
                    {categories.map(c => (
                      <SelectItem key={c.id} id={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectListBox>
                </SelectPopover>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" id={`item-date-${item.tempId}`}
                value={item.date} onChange={e => onChange({ ...item, date: e.target.value })} required />
              <Input label="Due Date" type="date" id={`item-due-${item.tempId}`}
                value={item.dueDate} onChange={e => onChange({ ...item, dueDate: e.target.value })} required />
            </div>
            {item.status === 'Dispatched' && (
              <Input label="Dispatch Date" type="date" id={`item-dispatch-${item.tempId}`}
                value={item.dispatchDate} onChange={e => onChange({ ...item, dispatchDate: e.target.value })} />
            )}

            <div className="grid grid-cols-3 gap-3">
              <Input label="Length" type="number" step="0.01" placeholder="cm"
                id={`item-l-${item.tempId}`} value={item.length}
                onChange={e => onChange({ ...item, length: e.target.value })} />
              <Input label="Width" type="number" step="0.01" placeholder="cm"
                id={`item-w-${item.tempId}`} value={item.width}
                onChange={e => onChange({ ...item, width: e.target.value })} />
              <Input label="Qty" type="number" min="1"
                id={`item-qty-${item.tempId}`} value={item.qty}
                onChange={e => onChange({ ...item, qty: e.target.value })} required />
            </div>

            {/* Status segmented control */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <div role="radiogroup" aria-label="Item status"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-muted p-1 rounded-xl border border-border">
                {(['Pending', 'In Progress', 'Packing', 'Dispatched'] as OrderStatus[]).map(s => (
                  <button key={s} type="button" role="radio" aria-checked={item.status === s}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg transition-colors min-tap ${
                      item.status === s
                        ? 'bg-card shadow-sm text-primary border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                    onClick={() => {
                      const updated = { ...item, status: s };
                      if (s === 'Dispatched' && !item.dispatchDate) {
                        updated.dispatchDate = new Date().toISOString().split('T')[0];
                      }
                      onChange(updated);
                    }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`item-desc-${item.tempId}`} className="text-sm font-medium text-foreground">Description</label>
              <textarea id={`item-desc-${item.tempId}`} rows={2}
                className="w-full p-3.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                placeholder="Notes for this item..."
                value={item.description}
                onChange={e => onChange({ ...item, description: e.target.value })} />
            </div>

            {/* Photo + Voice Note side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <SubItemPhotoField
                tempId={item.tempId}
                photoPath={item.photoPath}
                isUploading={photoUploadingIds.has(item.tempId)}
                onUpload={(file) => onPhotoUpload(item.tempId, file)}
                onRemove={() => onPhotoRemove(item.tempId)}
              />
              <SubItemAudioField
                tempId={item.tempId}
                audioPath={item.audioPath}
                isUploading={audioUploadingIds.has(item.tempId)}
                isRecording={audioRecordingId === item.tempId}
                onStart={() => onAudioRecord(item.tempId)}
                onDelete={() => onAudioDelete(item.tempId)}
              />
            </div>

            <button type="button" onClick={onRemove}
              className="self-start text-xs font-bold text-destructive hover:text-destructive/80 py-2 px-3 rounded-xl hover:bg-destructive/10 transition-colors min-tap">
              Remove this item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



interface OrderFormSheetProps {
  order: OrderWithCategoryAndItems | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (orderId: string) => void;
}

export function OrderFormSheet({ order, categories, isOpen, onClose, onSaved }: OrderFormSheetProps) {
  // M10: stable supabase client via useState to avoid useEffect dependency issues
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Form State
  const [orderNo, setOrderNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [qty, setQty] = useState('1');
  const [status, setStatus] = useState<OrderStatus>('Pending');
  const [description, setDescription] = useState('');

  // Sub-item state
  const [subItems, setSubItems] = useState<SubItemDraft[]>([]);
  const [expandedSubItem, setExpandedSubItem] = useState<string | null>(null);
  const [subItemPhotoUploadingIds, setSubItemPhotoUploadingIds] = useState<Set<string>>(new Set());
  const [subItemAudioUploadingIds, setSubItemAudioUploadingIds] = useState<Set<string>>(new Set());
  const [subItemRecordingId, setSubItemRecordingId] = useState<string | null>(null);
  // Duplicate detection
  const [duplicateOrder, setDuplicateOrder] = useState<{ id: string; order_no: string; customer_name: string } | null>(null);
  const [pendingSubItemData, setPendingSubItemData] = useState<any>(null);
  // Draft restore banner
  const [pendingDraft, setPendingDraft] = useState<OrderFormDraft | null>(null);


  /** localStorage key for this form's draft */
  const getDraftKey = (orderId: string | null) =>
    orderId ? `orderflow_draft_${orderId}` : 'orderflow_draft_new';

  /** Persist current form state to localStorage */
  const saveDraft = (
    orderId: string | null,
    fields: {
      orderNo: string; customerName: string; categoryId: string;
      date: string; dueDate: string; dispatchDate: string;
      length: string; width: string; qty: string;
      status: OrderStatus; description: string;
      photoPath: string | null; audioPath: string | null;
      subItems: SubItemDraft[];
    }
  ) => {
    try {
      const draft: OrderFormDraft = {
        version: 1,
        savedAt: new Date().toISOString(),
        orderId,
        ...fields,
      };
      localStorage.setItem(getDraftKey(orderId), JSON.stringify(draft));
    } catch {
      // localStorage write failure is non-fatal — silently ignore
    }
  };

  /** Load draft from localStorage. Returns null if none or version mismatch */
  const loadDraft = (orderId: string | null): OrderFormDraft | null => {
    try {
      const raw = localStorage.getItem(getDraftKey(orderId));
      if (!raw) return null;
      const draft = JSON.parse(raw) as OrderFormDraft;
      if (draft.version !== 1) return null;
      return draft;
    } catch {
      return null;
    }
  };

  /** Clear draft from localStorage after successful save */
  const clearDraft = (orderId: string | null) => {
    try {
      localStorage.removeItem(getDraftKey(orderId));
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (isOpen) {
      // Check for existing draft on open
      const draft = loadDraft(order?.id ?? null);
      if (draft) {
        setPendingDraft(draft);
        // Don't populate form yet — wait for user to accept or discard
        return;
      }
      setPendingDraft(null);

      if (order) {
        setOrderNo(order.order_no);
        setCustomerName(order.customer_name);
        setCategoryId(order.category_id);
        setDate(order.date);
        setDueDate(order.due_date);
        setDispatchDate(order.dispatch_date || '');
        setLength(order.length?.toString() || '');
        setWidth(order.width?.toString() || '');
        setQty(order.qty.toString());
        setStatus(order.status);
        setDescription(order.description || '');
        setPhotoPath(order.photo_url || null);
        setAudioPath(order.audio_url || null);

        if (order.audio_url) {
          supabase.storage.from('order-audio').createSignedUrl(order.audio_url, 3600).then(({ data }) => {
            if (data) setAudioUrl(data.signedUrl);
          });
        } else {
          setAudioUrl(null);
        }

        if (order.photo_url) {
          supabase.storage.from('order-photos').createSignedUrl(order.photo_url, 3600).then(({ data }) => {
            if (data) setPhotoUrl(data.signedUrl);
          });
        } else {
          setPhotoUrl(null);
        }

        // Populate sub-items from existing order_items
        if (order.order_items && order.order_items.length > 0) {
          setSubItems(order.order_items.map((item) => ({
            tempId: item.id,
            dbId: item.id,
            categoryId: (item as any).category_id ?? order.category_id,
            date: item.date,
            dueDate: item.due_date,
            dispatchDate: item.dispatch_date ?? '',
            length: item.length?.toString() ?? '',
            width: item.width?.toString() ?? '',
            qty: item.qty.toString(),
            status: item.status,
            description: item.description ?? '',
            photoPath: item.photo_url,
            audioPath: item.audio_url,
          })));
        } else {
          setSubItems([]);
        }
      } else {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        setOrderNo('');
        setCustomerName('');
        setCategoryId(categories[0]?.id || '');
        setDate(today.toISOString().split('T')[0]);
        setDueDate(nextWeek.toISOString().split('T')[0]);
        setDispatchDate('');
        setLength('');
        setWidth('');
        setQty('1');
        setStatus('Pending');
        setDescription('');
        setPhotoPath(null);
        setPhotoUrl(null);
        setAudioPath(null);
        setAudioUrl(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setSubItems([]);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order, categories, supabase]);

  // Auto-save draft every 3 seconds while form is open
  useEffect(() => {
    if (!isOpen || pendingDraft !== null) return; // don't save while draft prompt is showing
    const interval = setInterval(() => {
      saveDraft(order?.id ?? null, {
        orderNo, customerName, categoryId,
        date, dueDate, dispatchDate,
        length, width, qty, status, description,
        photoPath: photoPath,
        audioPath: audioPath,
        subItems,
      });
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen, pendingDraft, order?.id,
    orderNo, customerName, categoryId,
    date, dueDate, dispatchDate,
    length, width, qty, status, description,
    photoPath, audioPath, subItems,
  ]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setOrderNo(pendingDraft.orderNo);
    setCustomerName(pendingDraft.customerName);
    setCategoryId(pendingDraft.categoryId);
    setDate(pendingDraft.date);
    setDueDate(pendingDraft.dueDate);
    setDispatchDate(pendingDraft.dispatchDate);
    setLength(pendingDraft.length);
    setWidth(pendingDraft.width);
    setQty(pendingDraft.qty);
    setStatus(pendingDraft.status);
    setDescription(pendingDraft.description);
    setPhotoPath(pendingDraft.photoPath);
    setAudioPath(pendingDraft.audioPath);
    setSubItems(pendingDraft.subItems);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft(order?.id ?? null);
    setPendingDraft(null);
    // Re-populate form from order/defaults
    if (order) {
      setOrderNo(order.order_no);
      setCustomerName(order.customer_name);
      setCategoryId(order.category_id);
      setDate(order.date);
      setDueDate(order.due_date);
      setDispatchDate(order.dispatch_date || '');
      setLength(order.length?.toString() || '');
      setWidth(order.width?.toString() || '');
      setQty(order.qty.toString());
      setStatus(order.status);
      setDescription(order.description || '');
      setPhotoPath(order.photo_url || null);
      setAudioPath(order.audio_url || null);
      if (order.order_items && order.order_items.length > 0) {
        setSubItems(order.order_items.map((item) => ({
          tempId: item.id,
          dbId: item.id,
          categoryId: (item as any).category_id ?? order.category_id,
          date: item.date,
          dueDate: item.due_date,
          dispatchDate: item.dispatch_date ?? '',
          length: item.length?.toString() ?? '',
          width: item.width?.toString() ?? '',
          qty: item.qty.toString(),
          status: item.status,
          description: item.description ?? '',
          photoPath: item.photo_url,
          audioPath: item.audio_url,
        })));
      } else {
        setSubItems([]);
      }
    } else {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      setOrderNo('');
      setCustomerName('');
      setCategoryId(categories[0]?.id || '');
      setDate(today.toISOString().split('T')[0]);
      setDueDate(nextWeek.toISOString().split('T')[0]);
      setDispatchDate('');
      setLength('');
      setWidth('');
      setQty('1');
      setStatus('Pending');
      setDescription('');
      setPhotoPath(null);
      setPhotoUrl(null);
      setAudioPath(null);
      setAudioUrl(null);
      setSubItems([]);
    }
  };

  const activeCategories = Array.from(
    new Map([...categories, ...localCategories].map(c => [c.id, c])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setPhotoUrl(localPreview);
    setPhotoUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('order-photos').upload(filePath, file);
      if (uploadError) throw uploadError;
      setPhotoPath(filePath);
    } catch {
      URL.revokeObjectURL(localPreview);
      setPhotoUrl(null);
      setPhotoPath(null);
      toast.error("Couldn't upload the photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  // C1: Category inline-add — replaced window.prompt with inline controlled state
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleCategorySelection = useCallback((val: string) => {
    if (val === 'NEW_CATEGORY') {
      setAddingCategory(true);
    } else {
      setCategoryId(val);
    }
  }, []);

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) { setAddingCategory(false); return; }
    try {
      const { data, error } = await (supabase.from('categories') as any)
        .insert({ name: newCategoryName.trim() })
        .select()
        .single();
      if (error) throw error;
      setLocalCategories(prev => [...prev, data]);
      setCategoryId(data.id);
    } catch {
      toast.error("Couldn't add the category. Please try again.");
    } finally {
      setAddingCategory(false);
      setNewCategoryName('');
    }
  };

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(audioBlob));
        setAudioUploading(true);
        try {
          const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.webm`;
          const { error } = await supabase.storage.from('order-audio').upload(fileName, audioBlob);
          if (error) throw error;
          setAudioPath(fileName);
        } catch { toast.error("Couldn't save the voice note. Please try again."); }
        finally { setAudioUploading(false); }
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch {
      toast.error("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const deleteAudio = () => { setAudioUrl(null); setAudioPath(null); setRecordingDuration(0); };

  // ── Sub-item media upload handlers ──────────────────────────────────────────

  const handleSubItemPhotoUpload = async (tempId: string, file: File) => {
    setSubItemPhotoUploadingIds(prev => new Set(prev).add(tempId));
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('order-photos').upload(filePath, file);
      if (error) throw error;
      setSubItems(prev => prev.map(i => i.tempId === tempId ? { ...i, photoPath: filePath } : i));
    } catch {
      toast.error("Couldn't upload the photo. Please try again.");
    } finally {
      setSubItemPhotoUploadingIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
    }
  };

  const handleSubItemPhotoRemove = (tempId: string) => {
    setSubItems(prev => prev.map(i => i.tempId === tempId ? { ...i, photoPath: null } : i));
  };

  const handleSubItemAudioRecord = async (tempId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setSubItemAudioUploadingIds(prev => new Set(prev).add(tempId));
        try {
          const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.webm`;
          const { error } = await supabase.storage.from('order-audio').upload(fileName, blob);
          if (error) throw error;
          setSubItems(prev => prev.map(i => i.tempId === tempId ? { ...i, audioPath: fileName } : i));
        } catch { toast.error("Couldn't save the voice note. Please try again."); }
        finally { setSubItemAudioUploadingIds(prev => { const n = new Set(prev); n.delete(tempId); return n; }); }
        stream.getTracks().forEach(t => t.stop());
        setSubItemRecordingId(null);
      };
      setSubItemRecordingId(tempId);
      mediaRecorder.start();
      setTimeout(() => { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); }, 60000);
    } catch {
      toast.error("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
    }
  };

  const handleSubItemAudioDelete = (tempId: string) => {
    setSubItems(prev => prev.map(i => i.tempId === tempId ? { ...i, audioPath: null } : i));
  };

  // ── Atomic handleSubmit ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const anyUploading = photoUploading || audioUploading ||
      subItemPhotoUploadingIds.size > 0 || subItemAudioUploadingIds.size > 0;
    if (anyUploading) {
      toast.error("A photo or voice note is still uploading. Please wait a moment and try again.");
      return;
    }
    setLoading(true);

    const orderPayload = {
      order_no: orderNo.trim(),
      customer_name: customerName.trim(),
      category_id: categoryId,
      date,
      due_date: dueDate,
      dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
      length: length ? parseFloat(length) : null,
      width: width ? parseFloat(width) : null,
      qty: parseInt(qty, 10),
      status,
      description: description || null,
      photo_url: photoPath,
      audio_url: audioPath,
    };

    try {
      let savedOrderId = order?.id ?? null;

      if (order) {
        const { error } = await (supabase.from('orders') as any).update(orderPayload).eq('id', order.id);
        if (error) throw error;
      } else {
        const { data: newOrder, error } = await (supabase.from('orders') as any)
          .insert(orderPayload).select('id').single();
        if (error) throw error;
        savedOrderId = newOrder.id;
      }

      const existingDbIds = (order?.order_items ?? []).map(i => i.id);
      const currentDbIds = subItems.map(i => i.dbId).filter(Boolean);
      const removedIds = existingDbIds.filter(id => !currentDbIds.includes(id));
      if (removedIds.length > 0) {
        const { error } = await (supabase.from('order_items') as any).delete().in('id', removedIds);
        if (error) throw error;
      }

      if (subItems.length > 0) {
        const itemsPayload = subItems.map((item, idx) => ({
          ...(item.dbId ? { id: item.dbId } : {}),
          order_id: savedOrderId,
          category_id: item.categoryId,
          item_label: categories.find(c => c.id === item.categoryId)?.name || 'Item',
          date: item.date,
          due_date: item.dueDate,
          dispatch_date: item.status === 'Dispatched' ? (item.dispatchDate || null) : null,
          length: item.length ? parseFloat(item.length) : null,
          width: item.width ? parseFloat(item.width) : null,
          qty: parseInt(item.qty, 10) || 1,
          status: item.status,
          description: item.description || null,
          photo_url: item.photoPath,
          audio_url: item.audioPath,
          sort_order: idx,
        }));
        const { error } = await (supabase.from('order_items') as any)
          .upsert(itemsPayload, { onConflict: 'id' });
        if (error) throw error;
      }

      clearDraft(order?.id ?? null);
      // Notify parent to re-fetch sub-items for this order immediately
      if (savedOrderId) onSaved?.(savedOrderId);
      onClose();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        const { data: existing } = await (supabase.from('orders') as any)
          .select('id, order_no, customer_name').eq('order_no', orderNo.trim()).single();
        if (existing && existing.customer_name.trim().toLowerCase() === customerName.trim().toLowerCase()) {
          setDuplicateOrder(existing);
          setPendingSubItemData({
            order_id: existing.id,
            item_label: `Item added ${new Date().toLocaleDateString('en-IN')}`,
            date,
            due_date: dueDate,
            dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
            length: length ? parseFloat(length) : null,
            width: width ? parseFloat(width) : null,
            qty: parseInt(qty, 10),
            status,
            description: description || null,
            photo_url: photoPath,
            audio_url: audioPath,
            sort_order: 999,
          });
        } else {
          toast.error(`Order No ${orderNo} is already used by a different customer. Please use a different Order No.`);
        }
      } else if (msg.includes('null value') || msg.includes('not-null') || msg.includes('violates')) {
        toast.error("Please fill in all required fields for every item before saving.");
      } else {
        toast.error(`Couldn't save the order: ${msg || 'Unknown error. Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={order ? 'Edit Order' : 'New Order'}>
      {/* ── Duplicate order dialog ─── */}
      {duplicateOrder && (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 absolute inset-x-4 bottom-24 z-10 bg-card border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold text-foreground leading-snug">
              Order #{duplicateOrder.order_no} for {duplicateOrder.customer_name} already exists.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Would you like to add this as a new item to that order instead?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              loading={loading}
              loadingText="Adding…"
              onClick={async () => {
                setLoading(true);
                try {
                  const { error } = await (supabase.from('order_items') as any).insert(pendingSubItemData);
                  if (error) throw error;
                  clearDraft(order?.id ?? null);
                  setDuplicateOrder(null);
                  setPendingSubItemData(null);
                  onClose();
                } catch {
                  toast.error("Couldn't add the item. Please try again.");
                } finally { setLoading(false); }
              }}
            >
              Add as Sub-Item
            </Button>
            <Button type="button" variant="ghost" className="flex-1"
              onClick={() => { setDuplicateOrder(null); setPendingSubItemData(null); }}>
              Change Order No
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2 pb-6">

        <div className="grid grid-cols-2 gap-4">
          <Input label="Order No" id="order_no" value={orderNo} onChange={e => setOrderNo(e.target.value)} required />
          <Input label="Customer Name" id="customer_name" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
        </div>

        {/* Category field — M1: tokens, L6: sr-only required, C1: replaced window.prompt with inline UI */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Category
            <span className="text-destructive ml-1" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>

          {/* C1: Inline new-category form instead of window.prompt */}
          {addingCategory ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                type="text"
                placeholder="New category name"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveNewCategory(); } if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName(''); } }}
                className="flex-1 h-11 px-3.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="New category name"
              />
              <Button type="button" size="sm" onClick={handleSaveNewCategory}>Add</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingCategory(false); setNewCategoryName(''); }}>Cancel</Button>
            </div>
          ) : (
            <Select
              aria-label="Category"
              isRequired
              selectedKey={categoryId}
              onSelectionChange={(k) => handleCategorySelection(k as string)}
            >
              <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-border bg-card text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopover>
                <SelectListBox>
                  {activeCategories.map(c => <SelectItem key={c.id} id={c.id}>{c.name}</SelectItem>)}
                  <SelectItem id="NEW_CATEGORY" className="font-bold text-primary">+ Add New Category</SelectItem>
                </SelectListBox>
              </SelectPopover>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Order Date" type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Due Date" type="date" id="due_date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>

        {status === 'Dispatched' && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <Input label="Dispatch Date" type="date" id="dispatch_date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} required />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input label="Length" type="number" step="0.01" id="length" placeholder="cm" value={length} onChange={e => setLength(e.target.value)} />
          <Input label="Width" type="number" step="0.01" id="width" placeholder="cm" value={width} onChange={e => setWidth(e.target.value)} />
          <Input label="Qty" type="number" id="qty" min="1" value={qty} onChange={e => setQty(e.target.value)} required />
        </div>

        {/* M1 + M4: Status segmented control with tokens and accessible radio group */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Status</label>
          <div
            role="radiogroup"
            aria-label="Order status"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-muted p-1 rounded-xl border border-border"
          >
            {(['Pending', 'In Progress', 'Packing', 'Dispatched'] as OrderStatus[]).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-colors min-tap ${
                  status === s
                    ? 'bg-card shadow-sm text-primary border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
                onClick={() => {
                  setStatus(s);
                  if (s === 'Dispatched' && !dispatchDate) {
                    setDispatchDate(new Date().toISOString().split('T')[0]);
                  }
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* M1: Description textarea with tokens */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-foreground">Description</label>
          <textarea
            id="description"
            rows={3}
            className="w-full p-3.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none min-tap placeholder:text-muted-foreground"
            placeholder="Any extra notes or requirements..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* ── Reference Photo (main order) ──────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Reference Photo</label>
          {photoUrl ? (
            <div className="relative w-full h-40 bg-muted rounded-xl overflow-hidden border border-border group">
              <img src={photoUrl} alt="Order reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoUrl(null); setPhotoPath(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-foreground/60 text-card rounded-full w-8 h-8 flex items-center justify-center hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 min-tap"
                aria-label="Remove photo"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
              disabled={photoUploading}
            >
              {photoUploading ? (
                <div role="status" aria-label="Uploading photo">
                  <svg className="animate-spin w-5 h-5 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
              ) : (
                <>
                  <svg className="w-6 h-6 mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-sm font-medium">Capture or upload photo</span>
                </>
              )}
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*, .heic" onChange={handlePhotoUpload} />
        </div>

        {/* ── Voice Note (main order) ────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Voice Note</label>
          {audioUrl ? (
            <div className="bg-muted border border-border rounded-xl p-3 flex flex-col gap-3">
              <audio controls src={audioUrl} className="w-full h-10 outline-none" aria-label="Recorded voice note" />
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-semibold text-muted-foreground">Audio ready</span>
                <button type="button" onClick={deleteAudio} className="text-xs font-bold text-destructive hover:text-destructive/80 py-1 px-2 rounded-md hover:bg-destructive/10 transition-colors min-tap">Delete</button>
              </div>
            </div>
          ) : isRecording ? (
            <div className="w-full h-24 border-2 border-primary bg-primary/5 rounded-xl flex flex-col items-center justify-center relative shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive"></span>
                </div>
                <span className="font-mono text-foreground font-bold tracking-wider">
                  {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button type="button" onClick={stopRecording} className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-sm min-tap">
                Stop Recording
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
              disabled={audioUploading || photoUploading}
            >
              {audioUploading ? (
                <div role="status" aria-label="Uploading audio">
                  <svg className="animate-spin w-5 h-5 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-sm font-medium">Uploading Audio...</span>
                </div>
              ) : (
                <>
                  <svg className="w-6 h-6 mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  <span className="text-sm font-medium">Record Voice Note</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* ── Draft restore banner ─────────────────────────────── */}

        {pendingDraft && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">Unsaved draft found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                From {new Date(pendingDraft.savedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={restoreDraft} className="flex-1">Restore draft</Button>
              <Button type="button" size="sm" variant="ghost" onClick={discardDraft} className="flex-1">Discard</Button>
            </div>
          </div>
        )}

        {/* ── Sub-items list ────────────────────────────────────── */}
        {(() => {
          const { handleDragStart, handleDragOver, handleDragEnd, handleTouchStart, handleTouchEnd } =
            useDragSort(subItems, setSubItems);
          return (
            <>
              {subItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground tracking-tight">
                      Additional Items
                      <span className="ml-2 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{subItems.length}</span>
                    </span>
                  </div>
                  {subItems.map((item, idx) => (
                    <div
                      key={item.tempId}
                      draggable
                      onDragStart={handleDragStart(idx)}
                      onDragOver={handleDragOver(idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <SubItemCard
                        item={item}
                        index={idx}
                        isExpanded={expandedSubItem === item.tempId}
                        onToggle={() => setExpandedSubItem(prev => prev === item.tempId ? null : item.tempId)}
                        onChange={(updated) => setSubItems(prev => prev.map(i => i.tempId === updated.tempId ? updated : i))}
                        onRemove={() => setSubItems(prev => prev.filter(i => i.tempId !== item.tempId))}
                        dragHandleProps={{ onTouchStart: handleTouchStart(idx), onTouchEnd: handleTouchEnd }}
                        onPhotoUpload={handleSubItemPhotoUpload}
                        onPhotoRemove={handleSubItemPhotoRemove}
                        onAudioRecord={handleSubItemAudioRecord}
                        onAudioDelete={handleSubItemAudioDelete}
                        photoUploadingIds={subItemPhotoUploadingIds}
                        audioUploadingIds={subItemAudioUploadingIds}
                        audioRecordingId={subItemRecordingId}
                        categories={localCategories.length > 0 ? localCategories : categories}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Add Item button ─────────────────────────────── */}
              <button
                type="button"
                onClick={() => {
                  const today = date || new Date().toISOString().split('T')[0];
                  const due = dueDate || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
                  const newItem: SubItemDraft = {
                    tempId: crypto.randomUUID(),
                    dbId: null,
                    categoryId: categoryId || (localCategories[0] ?? categories[0])?.id || '',
                    date: today,
                    dueDate: due,
                    dispatchDate: '',
                    length: '', width: '', qty: '1',
                    status: 'Pending',
                    description: '',
                    photoPath: null, audioPath: null,
                  };
                  setSubItems(prev => [...prev, newItem]);
                  setExpandedSubItem(newItem.tempId);
                }}
                className="w-full h-14 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Item
              </button>
            </>
          );
        })()}


        <div className="mt-4 pt-4 border-t border-border flex gap-3 pb-8">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={loading} loadingText={order ? 'Saving…' : 'Creating…'} className="flex-[2]">
            {order ? 'Save Changes' : 'Create Order'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
