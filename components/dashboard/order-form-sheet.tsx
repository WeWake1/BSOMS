'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectPopover, SelectListBox } from '@/components/ui/select';
import type { OrderWithCategory, Category, OrderStatus } from '@/types/database';
import toast from 'react-hot-toast';

interface OrderFormSheetProps {
  order: OrderWithCategory | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

export function OrderFormSheet({ order, categories, isOpen, onClose }: OrderFormSheetProps) {
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

  // M10: stable supabase is in useState, no need to list in deps for these effects
  useEffect(() => {
    if (isOpen) {
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
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  }, [isOpen, order, categories, supabase]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      order_no: orderNo,
      customer_name: customerName,
      category_id: categoryId,
      date,
      due_date: dueDate,
      dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
      length: length ? parseFloat(length) : null,
      width: width ? parseFloat(width) : null,
      qty: parseInt(qty, 10),
      status,
      description,
      photo_url: photoPath,
      audio_url: audioPath,
    };
    try {
      if (order) {
        const { error } = await (supabase.from('orders') as any).update(payload).eq('id', order.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('orders') as any).insert(payload);
        if (error) throw error;
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('An order with this Order No already exists. Please use a different Order No.');
      } else {
        toast.error("Couldn't save the order. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={order ? 'Edit Order' : 'New Order'}>
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

        {/* Photo upload — M1: tokens */}
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
              {/* H1: role=status + aria-label on spinner */}
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

        {/* Voice Note — H5: aria-label on audio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Voice Note</label>
          {audioUrl ? (
            <div className="bg-muted border border-border rounded-xl p-3 flex flex-col gap-3">
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 outline-none"
                aria-label="Recorded voice note"
              />
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
              {/* H1: role=status on spinner */}
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
