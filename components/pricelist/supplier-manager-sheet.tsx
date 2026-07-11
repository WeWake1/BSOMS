'use client';

import { useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { PricelistSupplier } from '@/types/database';

interface SupplierManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: PricelistSupplier[];
}

interface Draft {
  name: string;
  location: string;
  contact_name: string;
  phone: string;
  notes: string;
}

const EMPTY: Draft = { name: '', location: '', contact_name: '', phone: '', notes: '' };

export function SupplierManagerSheet({
  isOpen,
  onClose,
  suppliers,
}: SupplierManagerSheetProps) {
  const [supabase] = useState(() => createClient());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setIsAdding(false);
    setDraft(EMPTY);
    setError(null);
    setConfirmDeleteId(null);
  };

  const startAdd = () => {
    reset();
    setIsAdding(true);
  };

  const startEdit = (s: PricelistSupplier) => {
    setConfirmDeleteId(null);
    setIsAdding(false);
    setEditingId(s.id);
    setDraft({
      name: s.name,
      location: s.location ?? '',
      contact_name: s.contact_name ?? '',
      phone: s.phone ?? '',
      notes: s.notes ?? '',
    });
    setError(null);
  };

  const payload = () => ({
    name: draft.name.trim(),
    location: draft.location.trim() || null,
    contact_name: draft.contact_name.trim() || null,
    phone: draft.phone.trim() || null,
    notes: draft.notes.trim() || null,
  });

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const { error: err } = await (supabase.from('pricelist_suppliers') as any)
          .update(payload())
          .eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await (supabase.from('pricelist_suppliers') as any)
          .insert(payload());
        if (err) throw err;
      }
      reset();
    } catch {
      setError("Couldn't save the supplier. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('pricelist_suppliers')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setConfirmDeleteId(null);
    } catch {
      setError("Couldn't delete this supplier. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const editorFields = (
    <div className="flex flex-col gap-2.5">
      <Input label="Name" autoFocus placeholder="e.g. Shree Timber Mart" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <Input label="Location" placeholder="City / area / address" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
      <Input label="Contact person" placeholder="Optional" value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} />
      <Input label="Phone" type="tel" inputMode="tel" placeholder="Optional" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
      <Input label="Notes" placeholder="Optional" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      <div className="flex gap-2 mt-1">
        <Button size="sm" className="flex-1" onClick={save} loading={loading} loadingText="Saving…">
          {editingId ? 'Save changes' : 'Add supplier'}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Suppliers">
      <div className="flex flex-col max-w-lg mx-auto w-full gap-3">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        {suppliers.length === 0 && !isAdding && (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
            No suppliers yet.
          </div>
        )}

        {suppliers.map((s) =>
          editingId === s.id ? (
            <div key={s.id} className="bg-muted/50 border border-border rounded-xl p-3">
              {editorFields}
            </div>
          ) : (
            <div key={s.id} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[s.location, s.contact_name, s.phone].filter(Boolean).join(' · ') || 'No details'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(s)} className="p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors min-tap" aria-label={`Edit ${s.name}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </button>
                {confirmDeleteId === s.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 rounded-md hover:bg-muted min-tap">Cancel</button>
                    <button onClick={() => remove(s.id)} disabled={loading} className="text-[10px] font-bold text-destructive px-2 py-1.5 rounded-md hover:bg-destructive/10 min-tap">{loading ? 'Deleting…' : 'Confirm'}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(s.id)} className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors min-tap" aria-label={`Delete ${s.name}`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {isAdding ? (
          <div className="bg-muted/50 border border-border rounded-xl p-3">{editorFields}</div>
        ) : (
          <button
            onClick={startAdd}
            className="w-full h-11 border-2 border-dashed border-border rounded-xl text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:border-emerald-400 hover:bg-muted transition-colors min-tap flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Supplier
          </button>
        )}
      </div>
    </Drawer>
  );
}
