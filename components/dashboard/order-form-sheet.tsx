'use client';

import { useState, useRef, useEffect } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectPopover, SelectListBox } from '@/components/ui/select';
import type { OrderWithCategory, Category, OrderStatus } from '@/types/database';

interface OrderFormSheetProps {
  order: OrderWithCategory | null; // null = Add Mode, object = Edit Mode
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

export function OrderFormSheet({ order, categories, isOpen, onClose }: OrderFormSheetProps) {
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

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

  // 1. Reset or initialize form
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
        if (order.photo_url) {
          // Fetch secure signed URL for existing private photo
          supabase.storage.from('order-photos').createSignedUrl(order.photo_url, 3600).then(({ data }) => {
            if (data) setPhotoUrl(data.signedUrl);
          });
        } else {
          setPhotoUrl(null);
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        setOrderNo('');
        setCustomerName('');
        setCategoryId(categories[0]?.id || '');
        setDate(today);
        setDueDate(today);
        setDispatchDate('');
        setLength('');
        setWidth('');
        setQty('1');
        setStatus('Pending');
        setDescription('');
        setPhotoPath(null);
        setPhotoUrl(null);
      }
    }
  }, [isOpen, order, categories]);

  const activeCategories = Array.from(
    new Map([...categories, ...localCategories].map(c => [c.id, c])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // 2. Photo Upload logic
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPhotoUrl(localPreview);
    setPhotoUploading(true);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Keep showing local URL for preview performance, just save path for DB
      setPhotoPath(filePath); 
    } catch (err: any) {
      URL.revokeObjectURL(localPreview);
      setPhotoUrl(null);
      setPhotoPath(null);
      alert('Photo upload failed: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  // 3. Category Inline-Add
  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'NEW_CATEGORY') {
      const newName = window.prompt('Enter new category name:');
      if (!newName || newName.trim() === '') {
        setCategoryId(categories[0]?.id || '');
        return;
      }
      
      try {
        const { data, error } = await (supabase.from('categories') as any)
          .insert({ name: newName.trim() })
          .select()
          .single();
          
        if (error) throw error;
        setLocalCategories(prev => [...prev, data]);
        setCategoryId(data.id);
      } catch (err: any) {
        alert('Failed to add category: ' + err.message);
        setCategoryId(categories[0]?.id || '');
      }
    } else {
      setCategoryId(val);
    }
  };

  // 4. Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      order_no: orderNo,
      customer_name: customerName,
      category_id: categoryId,
      date,
      due_date: dueDate,
      dispatch_date: dispatchDate || null,
      length: length ? parseFloat(length) : null,
      width: width ? parseFloat(width) : null,
      qty: parseInt(qty, 10),
      status,
      description,
      photo_url: photoPath,
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
      alert('Failed to save order: ' + err.message);
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Category<span className="text-red-500 ml-1">*</span></label>
          <Select
            aria-label="Category"
            isRequired
            selectedKey={categoryId}
            onSelectionChange={(k) => {
              // Create synthetic event to match existing handleCategoryChange signature
              handleCategoryChange({ target: { value: k as string } } as any);
            }}
          >
            <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopover>
              <SelectListBox>
                {activeCategories.map(c => <SelectItem key={c.id} id={c.id}>{c.name}</SelectItem>)}
                <SelectItem id="NEW_CATEGORY" className="font-bold text-indigo-600">+ Add New Category</SelectItem>
              </SelectListBox>
            </SelectPopover>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Order Date" type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Due Date" type="date" id="due_date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>

        <Input label="Dispatch Date (Optional)" type="date" id="dispatch_date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />

        <div className="grid grid-cols-3 gap-4">
          <Input label="Length" type="number" step="0.01" id="length" placeholder="cm" value={length} onChange={e => setLength(e.target.value)} />
          <Input label="Width" type="number" step="0.01" id="width" placeholder="cm" value={width} onChange={e => setWidth(e.target.value)} />
          <Input label="Qty" type="number" id="qty" min="1" value={qty} onChange={e => setQty(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-gray-50 p-1 rounded-xl border border-gray-200">
            {(['Pending', 'In Progress', 'Packing', 'Dispatched'] as OrderStatus[]).map(s => (
              <button
                key={s}
                type="button"
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-colors min-tap ${status === s ? 'bg-white shadow-sm text-indigo-700 border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-gray-700">Description</label>
          <textarea 
            id="description"
            rows={3}
            className="w-full p-3.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-tap placeholder:text-gray-400"
            placeholder="Any extra notes or requirements..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Reference Photo</label>
          {photoUrl ? (
            <div className="relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 group">
              <img src={photoUrl} alt="Order reference" className="w-full h-full object-cover" />
              <button 
                type="button" 
                onClick={() => { setPhotoUrl(null); setPhotoPath(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 min-tap"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors min-tap"
              disabled={photoUploading}
            >
              {photoUploading ? (
                <>
                  <svg className="animate-spin w-5 h-5 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-sm font-medium">Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-sm font-medium">Capture or upload photo</span>
                </>
              )}
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*, .heic" 
            onChange={handlePhotoUpload}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 pb-8">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="flex-[2]">
            {order ? 'Save Changes' : 'Create Order'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
