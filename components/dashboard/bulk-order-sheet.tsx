'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import type { Category, OrderStatus } from '@/types/database';
import { cn, sanitizeMobileInput, isValidIndianMobile } from '@/lib/utils';

interface BulkRow {
  id: string;
  order_no: string;
  customer_name: string;
  mobile_no: string;
  category_id: string;
  date: string;
  due_date: string;
  length: string;
  width: string;
  qty: string;
  status: OrderStatus;
  description: string;
  photoFile: File | null;
  photoPreview: string | null;
  photoPath: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioPath: string | null;
}

interface BulkOrderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  existingCustomerNames?: string[];
  customerMobileLookup?: Map<string, string>;
}

function makeRow(): BulkRow {
  const today = new Date().toISOString().split('T')[0];
  const next = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  return {
    id: Math.random().toString(36).slice(2),
    order_no: '', customer_name: '', mobile_no: '', category_id: '',
    date: today, due_date: next,
    length: '', width: '', qty: '1',
    status: 'Pending', description: '',
    photoFile: null, photoPreview: null, photoPath: null,
    audioBlob: null, audioUrl: null, audioPath: null,
  };
}

function AttachmentCell({ row, onChange }: {
  row: BulkRow;
  onChange: (patch: Partial<BulkRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recDur, setRecDur] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const hasPhoto = !!row.photoPreview;
  const hasAudio = !!row.audioUrl;
  const hasAny = hasPhoto || hasAudio;

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ photoFile: file, photoPreview: URL.createObjectURL(file), photoPath: null });
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onChange({ audioBlob: blob, audioUrl: URL.createObjectURL(blob), audioPath: null });
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setIsRecording(true); setRecDur(0);
      timerRef.current = setInterval(() => setRecDur(p => p + 1), 1000);
    } catch { toast.error('Microphone access denied.'); }
  };

  const stopRec = () => {
    mrRef.current?.stop(); setIsRecording(false);
    clearInterval(timerRef.current);
  };

  return (
    <div className="relative flex items-center gap-1">
      <button type="button" onClick={() => fileRef.current?.click()} title="Attach photo"
        className={cn("w-7 h-7 rounded-lg flex items-center justify-center border transition-colors",
          hasPhoto ? "bg-blue-50 border-blue-300 text-blue-600" : "border-border text-muted-foreground hover:bg-muted")}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
      <input ref={fileRef} type="file" accept="image/*,.heic" className="hidden" onChange={handlePhoto} />

      <button type="button" onClick={() => setOpen(!open)} title="Record voice note"
        className={cn("w-7 h-7 rounded-lg flex items-center justify-center border transition-colors",
          hasAudio ? "bg-purple-50 border-purple-300 text-purple-600" : "border-border text-muted-foreground hover:bg-muted")}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-52 animate-in fade-in zoom-in-95 duration-100">
          <button type="button" onClick={() => setOpen(false)}
            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          {hasAudio ? (
            <div className="flex flex-col gap-2">
              <audio src={row.audioUrl!} controls className="w-full h-8" />
              <button type="button" onClick={() => { onChange({ audioBlob: null, audioUrl: null, audioPath: null }); setOpen(false); }}
                className="text-xs text-destructive hover:underline">Remove</button>
            </div>
          ) : isRecording ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="font-mono text-sm font-bold">
                  {Math.floor(recDur / 60).toString().padStart(2,'0')}:{(recDur % 60).toString().padStart(2,'0')}
                </span>
              </div>
              <button type="button" onClick={stopRec} className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Stop</button>
            </div>
          ) : (
            <button type="button" onClick={startRec}
              className="w-full py-2 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              Tap to record
            </button>
          )}
        </div>
      )}

      {hasAny && (
        <div className="flex gap-0.5 ml-0.5">
          {hasPhoto && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          {hasAudio && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];
const CELL = "h-9 px-2 border-r border-border bg-transparent text-sm text-foreground outline-none focus:bg-primary/5 focus:ring-inset focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-foreground/50 w-full";
const SELECT_CELL = "h-9 px-2 border-r border-border bg-transparent text-sm text-foreground outline-none focus:bg-primary/5 focus:ring-inset focus:ring-1 focus:ring-primary transition-colors w-full cursor-pointer appearance-none";

// ── CustomerNameCell with autocomplete ───────────────────────────────────────
function CustomerNameCell({
  value,
  onChange,
  onSelect,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (name: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .slice(0, 6);
  }, [value, suggestions]);

  useEffect(() => { setHighlighted(0); }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={CELL}
        placeholder="Customer name"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); onSelect(filtered[highlighted]); setOpen(false); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-0.5 z-30 w-[260px] bg-card border border-border rounded-lg shadow-xl py-1 max-h-56 overflow-auto">
          {filtered.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(name); setOpen(false); }}
              onMouseEnter={() => setHighlighted(idx)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm transition-colors",
                idx === highlighted ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BulkOrderSheet({ isOpen, onClose, categories, existingCustomerNames = [], customerMobileLookup }: BulkOrderSheetProps) {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow(), makeRow(), makeRow()]);
  const [saving, setSaving] = useState(false);

  // Build pool of suggestion names: existing customers in DB + names already entered in earlier rows
  const suggestionPool = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of existingCustomerNames) {
      const k = name.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(name); }
    }
    for (const r of rows) {
      const name = r.customer_name.trim();
      const k = name.toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(name); }
    }
    return out;
  }, [existingCustomerNames, rows]);

  // Given a customer name, find a mobile_no from earlier bulk rows OR existing DB orders
  const findMobileFor = useCallback((name: string, rowsSnapshot: BulkRow[]): string | undefined => {
    const k = name.trim().toLowerCase();
    if (!k) return undefined;
    for (const r of rowsSnapshot) {
      if (r.customer_name.trim().toLowerCase() === k && r.mobile_no) return r.mobile_no;
    }
    return customerMobileLookup?.get(k);
  }, [customerMobileLookup]);

  // Core update: apply patch to one row, then fan out fill-blanks-only auto-fill
  // for mobile_no when either customer_name or mobile_no changes.
  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      const target = next.find(r => r.id === id);
      if (!target) return next;

      const customerChanged = 'customer_name' in patch;
      const mobileChanged = 'mobile_no' in patch;
      if (!customerChanged && !mobileChanged) return next;

      const k = target.customer_name.trim().toLowerCase();
      if (!k) return next;

      // If THIS row has no mobile yet, try to backfill it from another row or DB
      if (!target.mobile_no) {
        const found = findMobileFor(target.customer_name, next);
        if (found) {
          return next.map(r => r.id === id ? { ...r, mobile_no: found } : r);
        }
      }

      // If THIS row has a mobile, fill any blank-mobile peers with same name
      if (target.mobile_no) {
        return next.map(r => {
          if (r.id === id) return r;
          if (!r.mobile_no && r.customer_name.trim().toLowerCase() === k) {
            return { ...r, mobile_no: target.mobile_no };
          }
          return r;
        });
      }

      return next;
    });
  }, [findMobileFor]);

  // Special handler for selecting from autocomplete: fill name AND prefill mobile if known + blank
  const selectCustomerName = useCallback((id: string, name: string) => {
    setRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, customer_name: name } : r);
      const target = next.find(r => r.id === id);
      if (!target) return next;
      if (!target.mobile_no) {
        const found = findMobileFor(name, next);
        if (found) return next.map(r => r.id === id ? { ...r, mobile_no: found } : r);
      }
      return next;
    });
  }, [findMobileFor]);

  const addRow = () => setRows(prev => [...prev, makeRow()]);
  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    const valid = rows.filter(r => r.order_no.trim() && r.customer_name.trim() && r.category_id);
    if (valid.length === 0) {
      toast.error('Fill in at least one complete row (Order No, Customer, Category).');
      return;
    }
    const badMobile = valid.find(r => r.mobile_no && !isValidIndianMobile(r.mobile_no));
    if (badMobile) {
      toast.error(`Mobile number for "${badMobile.customer_name}" must be exactly 10 digits.`);
      return;
    }
    setSaving(true);
    try {
      const prepared = await Promise.all(valid.map(async (row) => {
        let photoPath = row.photoPath;
        let audioPath = row.audioPath;
        if (row.photoFile && !photoPath) {
          const ext = row.photoFile.name.split('.').pop() || 'jpg';
          const path = `${Math.random().toString(36).slice(2)}_${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('order-photos').upload(path, row.photoFile);
          if (!error) photoPath = path;
        }
        if (row.audioBlob && !audioPath) {
          const path = `${Math.random().toString(36).slice(2)}_${Date.now()}.webm`;
          const { error } = await supabase.storage.from('order-audio').upload(path, row.audioBlob);
          if (!error) audioPath = path;
        }
        return {
          order_no: row.order_no.trim(),
          customer_name: row.customer_name.trim(),
          mobile_no: row.mobile_no || null,
          category_id: row.category_id,
          date: row.date,
          due_date: row.due_date,
          dispatch_date: null,
          length: row.length.trim() || null,
          width: row.width.trim() || null,
          qty: parseInt(row.qty, 10) || 1,
          status: row.status,
          description: row.description.trim() || null,
          photo_url: photoPath,
          audio_url: audioPath,
        };
      }));

      const { error } = await (supabase.from('orders') as any).insert(prepared);
      if (error) throw error;
      toast.success(`${prepared.length} order${prepared.length !== 1 ? 's' : ''} created!`);
      setRows([makeRow(), makeRow(), makeRow()]);
      onClose();
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const validCount = rows.filter(r => r.order_no.trim() && r.customer_name.trim() && r.category_id).length;

  const sheet = (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm w-full h-full text-transparent focus:outline-none cursor-default"
        onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="relative w-full bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden>
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 pb-3 pt-1 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add Multiple Orders</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill rows below — blank rows are skipped</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9">Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={saving} loadingText="Saving…" className="h-9">
              Save {validCount > 0 ? `(${validCount})` : ''} Orders
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/90 backdrop-blur border-b border-border text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left border-r border-border w-8">#</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[90px]">Order No *</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[150px]">Customer *</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[120px]">Mobile</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[130px]">Category *</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[110px]">Order Date</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[110px]">Due Date</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[64px]">Length</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[64px]">Width</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[52px]">Qty</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[120px]">Status</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[200px]">Description</th>
                <th className="px-2 py-2.5 text-left border-r border-border min-w-[90px]">Attach</th>
                <th className="px-2 py-2.5 text-left min-w-[40px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, idx) => {
                const isComplete = row.order_no.trim() && row.customer_name.trim() && row.category_id;
                const mobileInvalid = !!row.mobile_no && !isValidIndianMobile(row.mobile_no);
                return (
                  <tr key={row.id} className={cn("group hover:bg-muted/20 transition-colors", isComplete && "bg-primary/[0.03]")}>
                    <td className="px-3 py-1 text-[11px] font-bold text-muted-foreground border-r border-border w-8 text-center">{idx + 1}</td>
                    <td className="border-r border-border p-0"><input className={CELL} placeholder="e.g. ORD-001" value={row.order_no} onChange={e => updateRow(row.id, { order_no: e.target.value })} /></td>
                    <td className="border-r border-border p-0">
                      <CustomerNameCell
                        value={row.customer_name}
                        onChange={v => updateRow(row.id, { customer_name: v })}
                        onSelect={name => selectCustomerName(row.id, name)}
                        suggestions={suggestionPool}
                      />
                    </td>
                    <td className="border-r border-border p-0">
                      <input
                        className={cn(CELL, mobileInvalid && "bg-destructive/5 text-destructive")}
                        placeholder="10 digits"
                        inputMode="numeric"
                        maxLength={15}
                        value={row.mobile_no}
                        onChange={e => updateRow(row.id, { mobile_no: sanitizeMobileInput(e.target.value) })}
                        title={mobileInvalid ? 'Must be 10 digits' : '+91 added automatically'}
                      />
                    </td>
                    <td className="border-r border-border p-0">
                      <select className={SELECT_CELL} value={row.category_id} onChange={e => updateRow(row.id, { category_id: e.target.value })}>
                        <option value="">— select —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="border-r border-border p-0"><input type="date" className={CELL} value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} /></td>
                    <td className="border-r border-border p-0"><input type="date" className={CELL} value={row.due_date} onChange={e => updateRow(row.id, { due_date: e.target.value })} /></td>
                    <td className="border-r border-border p-0"><input className={CELL} placeholder='e.g. 33"1' value={row.length} onChange={e => updateRow(row.id, { length: e.target.value })} /></td>
                    <td className="border-r border-border p-0"><input className={CELL} placeholder='e.g. 14"9' value={row.width} onChange={e => updateRow(row.id, { width: e.target.value })} /></td>
                    <td className="border-r border-border p-0"><input type="number" min="1" className={CELL} value={row.qty} onChange={e => updateRow(row.id, { qty: e.target.value })} /></td>
                    <td className="border-r border-border p-0">
                      <select className={SELECT_CELL} value={row.status} onChange={e => updateRow(row.id, { status: e.target.value as OrderStatus })}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="border-r border-border p-0"><input className={CELL} placeholder="Notes…" value={row.description} onChange={e => updateRow(row.id, { description: e.target.value })} /></td>
                    <td className="border-r border-border px-2 py-1"><AttachmentCell row={row} onChange={(patch) => updateRow(row.id, patch)} /></td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => removeRow(row.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Remove row">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="sticky left-0 p-3 border-t border-border">
            <button type="button" onClick={addRow}
              className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 px-3 py-2 rounded-xl transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Row
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
