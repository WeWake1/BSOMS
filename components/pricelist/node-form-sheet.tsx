'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { PricelistNodeWithRelations, PricelistSupplier } from '@/types/database';

export type PricelistLevel = 'category' | 'brand' | 'variety';

interface TierDraft {
  label: string;
  rate: string;
  unit: string;
  /** Selling margin % for this tier; blank = use the global default. */
  margin: string;
}

interface NodeFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** What level is being created/edited — determines form fields and labels. */
  level: PricelistLevel;
  parentId: string | null;
  node?: PricelistNodeWithRelations | null;
  suppliers: PricelistSupplier[];
  /** Global default margin % — shown as the placeholder for blank margins. */
  defaultMarginPct?: number;
}

const UNIT_SUGGESTIONS = ['per sheet', 'per sq.ft.', 'per piece', 'per kg', 'per box', 'per running ft'];

const META: Record<PricelistLevel, { label: string; placeholder: string; hint: string }> = {
  category: {
    label: 'Category',
    placeholder: 'e.g. Plywood',
    hint: 'Top-level product type — e.g. Plywood, MDF, Veneers.',
  },
  brand: {
    label: 'Brand',
    placeholder: 'e.g. Duraflame',
    hint: 'The brand or make under this category.',
  },
  variety: {
    label: 'Variety',
    placeholder: 'e.g. 701, Full WP, 303',
    hint: 'The specific model or grade — this is what carries the price.',
  },
};

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function NodeFormSheet({
  isOpen,
  onClose,
  mode,
  level,
  parentId,
  node,
  suppliers,
  defaultMarginPct = 0,
}: NodeFormSheetProps) {
  const [supabase] = useState(() => createClient());
  const meta = META[level];
  const isVariety = level === 'variety';
  const kind = isVariety ? 'product' : 'group';

  const [name, setName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [unit, setUnit] = useState('');
  const [tags, setTags] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [tiers, setTiers] = useState<TierDraft[]>([{ label: '', rate: '', unit: '', margin: '' }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && node) {
      setName(node.name);
      setLength(node.length?.toString() ?? '');
      setWidth(node.width?.toString() ?? '');
      setUnit(node.unit ?? '');
      setTags((node.tags ?? []).join(', '));
      setSupplierId(node.supplier_id ?? '');
      setTiers(
        node.prices.length
          ? node.prices.map((p) => ({
              label: p.label === 'Standard' ? '' : p.label,
              rate: p.rate.toString(),
              unit: p.unit ?? '',
              margin: p.margin_pct?.toString() ?? '',
            }))
          : [{ label: '', rate: '', unit: '', margin: '' }]
      );
    } else {
      setName('');
      setLength('');
      setWidth('');
      setUnit('');
      setTags('');
      setSupplierId('');
      setTiers([{ label: '', rate: '', unit: '', margin: '' }]);
    }
    setError(null);
  }, [isOpen, mode, node]);

  const updateTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTier = () =>
    setTiers((prev) => [...prev, { label: '', rate: '', unit: unit || '', margin: '' }]);
  const removeTier = (i: number) =>
    setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setLoading(true);
    setError(null);

    const nodePayload = {
      parent_id: mode === 'edit' ? node!.parent_id : parentId,
      kind,
      name: name.trim(),
      length: isVariety ? numOrNull(length) : null,
      width: isVariety ? numOrNull(width) : null,
      thickness: null,
      unit: isVariety ? unit.trim() || null : null,
      tags: isVariety ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      supplier_id: isVariety ? supplierId || null : null,
    };

    try {
      let nodeId: string;
      if (mode === 'edit' && node) {
        const { error: err } = await (supabase.from('pricelist_nodes') as any)
          .update(nodePayload)
          .eq('id', node.id);
        if (err) throw err;
        nodeId = node.id;
      } else {
        const { data, error: err } = await (supabase.from('pricelist_nodes') as any)
          .insert(nodePayload)
          .select('id')
          .single();
        if (err) throw err;
        nodeId = data.id;
      }

      if (isVariety) {
        await supabase.from('pricelist_prices').delete().eq('node_id', nodeId);
        const rows = tiers
          .map((t, idx) => ({
            node_id: nodeId,
            label: t.label.trim() || 'Standard',
            rate: numOrNull(t.rate),
            unit: t.unit.trim() || null,
            margin_pct: numOrNull(t.margin),
            sort_order: idx,
          }))
          .filter((r) => r.rate != null);
        if (rows.length) {
          const { error: insErr } = await (supabase.from('pricelist_prices') as any).insert(rows);
          if (insErr) throw insErr;
        }
      }

      onClose();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      setError(msg ? `Couldn't save: ${msg}` : "Couldn't save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'edit' ? `Edit ${meta.label}` : `Add ${meta.label}`;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col max-w-lg mx-auto w-full gap-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        <Input
          label={`${meta.label} name`}
          autoFocus
          placeholder={meta.placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={meta.hint}
        />

        {isVariety && (
          <>
            <Input
              label="Tags (optional)"
              placeholder="Full WP, ISI, BWR"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              hint="Short labels shown as badges — e.g. Waterproof, Semi-WP."
            />

            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">
                Sheet size{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Length (ft)"
                  type="number"
                  inputMode="decimal"
                  placeholder="8"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
                <Input
                  label="Width (ft)"
                  type="number"
                  inputMode="decimal"
                  placeholder="4"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
            </div>

            <Input
              label="Default unit (optional)"
              list="pricelist-units"
              placeholder="per sheet"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <datalist id="pricelist-units">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="supplier-select" className="text-sm font-medium text-foreground">
                Sourced from{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                id="supplier-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prices */}
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">Prices</p>
              <p className="text-xs text-muted-foreground mb-2">
                Rate is what YOU pay (purchase). Margin % sets the selling price —
                leave it blank to use the default margin ({defaultMarginPct}%).
              </p>
              <div className="flex flex-col gap-2">
                {tiers.map((t, i) => {
                  const rateNum = numOrNull(t.rate);
                  const marginNum = numOrNull(t.margin) ?? defaultMarginPct;
                  const selling =
                    rateNum != null ? Math.round(rateNum * (1 + marginNum / 100)) : null;
                  return (
                    <div key={i} className="rounded-xl border border-border p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-end gap-1.5">
                        <div className="w-16 shrink-0">
                          <Input
                            label="Size"
                            aria-label="Size or label"
                            placeholder="18mm"
                            className="px-2"
                            value={t.label}
                            onChange={(e) => updateTier(i, { label: e.target.value })}
                          />
                        </div>
                        <div className="w-28 shrink-0">
                          <Input
                            label="Rate (₹)"
                            aria-label="Purchase rate"
                            type="number"
                            inputMode="decimal"
                            placeholder="2400"
                            className="px-2"
                            value={t.rate}
                            onChange={(e) => updateTier(i, { rate: e.target.value })}
                          />
                        </div>
                        <div className="w-16 shrink-0">
                          <Input
                            label="Margin"
                            aria-label="Selling margin percent"
                            type="number"
                            inputMode="decimal"
                            placeholder={`${defaultMarginPct}%`}
                            className="px-2"
                            value={t.margin}
                            onChange={(e) => updateTier(i, { margin: e.target.value })}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Input
                            label="Unit"
                            aria-label="Unit"
                            list="pricelist-units"
                            placeholder="per sheet"
                            className="px-2"
                            value={t.unit}
                            onChange={(e) => updateTier(i, { unit: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTier(i)}
                          disabled={tiers.length === 1}
                          aria-label="Remove price row"
                          className="w-9 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30 shrink-0"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>
                      {selling != null && (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Selling: ₹{selling.toLocaleString('en-IN')}
                          <span className="text-muted-foreground font-medium">
                            {' '}(+{marginNum}%{t.margin.trim() === '' ? ' default' : ''})
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addTier}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline min-tap"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add another size
              </button>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1 sticky bottom-0 bg-card pb-1">
          <Button className="flex-1" onClick={save} loading={loading} loadingText="Saving…">
            {mode === 'edit' ? 'Save changes' : `Add ${meta.label}`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
