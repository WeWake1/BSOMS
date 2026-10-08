'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePricelist } from '@/hooks/usePricelist';
import { ProductPicker } from '@/components/pricelist/product-picker';
import { PricelistShareCard } from '@/components/pricelist/pricelist-share-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  cn,
  sanitizeMobileInput,
  isValidIndianMobile,
  buildWhatsAppUrl,
  formatMobileDisplay,
} from '@/lib/utils';
import {
  flattenProducts,
  formatRupees,
  applyMargin,
  effectiveMarginPct,
  treeWithSellingRates,
} from '@/lib/pricelist-utils';
import {
  buildPricelistText,
  formatRateUnit,
  generatePricelistPDF,
  type PricelistShareMeta,
  type SharedProduct,
} from '@/lib/pricelist-share-export';
import { shareOrDownloadPng, fileSlug } from '@/lib/share-image';
import type { AuthUser } from '@/lib/auth';
import type { PricelistNodeWithRelations, PricelistPrice } from '@/types/database';

interface ShareSelection {
  /** Raw node — purchase rates for admin, selling rates for everyone else. */
  node: PricelistNodeWithRelations;
  path: string[];
  /** Admin: margin % over PURCHASE for every tier (blank = each tier's saved
   *  margin). Staff/viewer: extra markup % on top of the SELLING price
   *  (blank = none) — they never see purchase rates. Never saved. */
  adjustPct: string;
  /** Tier ids left off this price list. */
  hidden: string[];
}

// Local calendar date (toISOString alone is UTC — before 5:30 AM IST it
// would default the date to yesterday).
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function parsePct(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ShareClient({ user }: { user: AuthUser }) {
  const isAdmin = user.profile.role === 'admin';
  const { tree, defaultMarginPct, loading } = usePricelist(isAdmin);

  const [view, setView] = useState<'select' | 'review'>('select');
  const [selections, setSelections] = useState<ShareSelection[]>([]);
  const [bulkPct, setBulkPct] = useState('');
  // Last "for all" value applied — products added afterwards start on it.
  const [appliedBulk, setAppliedBulk] = useState('');

  const [clientName, setClientName] = useState('');
  const [mobile, setMobile] = useState('');
  const [date, setDate] = useState(today());
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');

  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Selections keep RAW nodes so the admin's margin maths starts from the
  // purchase rate; the picker shows selling prices (identity for staff).
  const flatRaw = useMemo(() => flattenProducts(tree), [tree]);
  const rawById = useMemo(() => new Map(flatRaw.map((f) => [f.node.id, f])), [flatRaw]);
  const displayTree = useMemo(
    () => treeWithSellingRates(tree, defaultMarginPct),
    [tree, defaultMarginPct]
  );
  const selectedIds = useMemo(() => new Set(selections.map((s) => s.node.id)), [selections]);

  const toggleSelect = (node: PricelistNodeWithRelations) => {
    const raw = rawById.get(node.id);
    setSelections((prev) =>
      prev.some((s) => s.node.id === node.id)
        ? prev.filter((s) => s.node.id !== node.id)
        : [
            ...prev,
            { node: raw?.node ?? node, path: raw?.path ?? [], adjustPct: appliedBulk, hidden: [] },
          ]
    );
  };

  const updateSelection = (id: string, patch: Partial<ShareSelection>) =>
    setSelections((prev) => prev.map((s) => (s.node.id === id ? { ...s, ...patch } : s)));

  const toggleTier = (id: string, priceId: string) =>
    setSelections((prev) =>
      prev.map((s) =>
        s.node.id !== id
          ? s
          : {
              ...s,
              hidden: s.hidden.includes(priceId)
                ? s.hidden.filter((h) => h !== priceId)
                : [...s.hidden, priceId],
            }
      )
    );

  const applyBulk = () => {
    setSelections((prev) => prev.map((s) => ({ ...s, adjustPct: bulkPct })));
    setAppliedBulk(bulkPct);
    const pct = parsePct(bulkPct);
    toast.success(
      pct == null
        ? isAdmin
          ? 'Using saved margins for all products.'
          : 'Extra markup removed.'
        : `${isAdmin ? 'Margin' : 'Extra markup'} set to ${pct}% for all products.`
    );
  };

  // Final customer-facing rate for one tier.
  //  admin → purchase × (1 + override-or-saved margin)
  //  staff → selling × (1 + extra markup); markdowns are not allowed.
  const tierRate = useCallback(
    (p: PricelistPrice, s: ShareSelection): number => {
      const pct = parsePct(s.adjustPct);
      const override = pct == null ? null : isAdmin ? pct : Math.max(0, pct);
      return applyMargin(p.rate, override ?? effectiveMarginPct(p, defaultMarginPct));
    },
    [isAdmin, defaultMarginPct]
  );

  // What actually goes out. Products whose every tier was unticked drop out.
  const items: SharedProduct[] = useMemo(
    () =>
      selections
        .map((s) => ({
          node: s.node,
          path: s.path,
          tiers: s.node.prices
            .filter((p) => !s.hidden.includes(p.id))
            .map((p) => ({ id: p.id, label: p.label, rate: tierRate(p, s), unit: p.unit })),
        }))
        .filter((item) => item.tiers.length > 0 || item.node.prices.length === 0),
    [selections, tierRate]
  );

  const mobileDigits = sanitizeMobileInput(mobile);
  const mobileValid = isValidIndianMobile(mobileDigits);
  const mobileError = mobile.trim() && !mobileValid ? 'Enter a 10-digit mobile number.' : undefined;

  const meta: PricelistShareMeta = {
    clientName: clientName.trim(),
    clientPhone: mobileValid ? formatMobileDisplay(mobileDigits) : '',
    date,
    validUntil,
    note,
  };

  const blocker =
    items.length === 0
      ? 'Tick at least one price to share.'
      : !clientName.trim()
        ? 'Add the customer’s name to share.'
        : mobileError
          ? mobileError
          : null;
  const canShare = !blocker;
  const canWhatsApp = canShare && mobileValid;

  const handleWhatsApp = () => {
    if (!canShare) {
      toast.error(blocker ?? 'Add the customer’s details.');
      return;
    }
    const url = buildWhatsAppUrl(mobileDigits, buildPricelistText(items, meta));
    if (!url) {
      toast.error('Add the customer’s mobile number to send on WhatsApp.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePDF = async (action: 'download' | 'view') => {
    if (!canShare) {
      toast.error(blocker ?? 'Add the customer’s details.');
      return;
    }
    setExporting(true);
    try {
      await generatePricelistPDF(items, meta, action);
      if (action === 'download') toast.success('PDF downloaded.');
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate the PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleImage = async () => {
    if (!canShare) {
      toast.error(blocker ?? 'Add the customer’s details.');
      return;
    }
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const result = await shareOrDownloadPng(
        cardRef.current,
        `pricelist-${fileSlug(meta.clientName)}-${meta.date}.png`,
        'Price List'
      );
      toast.success(result === 'shared' ? 'Shared.' : 'Image downloaded.');
    } catch (e) {
      // AbortError = user cancelled the share sheet; stay quiet.
      if ((e as Error)?.name !== 'AbortError') {
        console.error(e);
        toast.error("Couldn't generate the image.");
      }
    } finally {
      setExporting(false);
    }
  };

  const tierCount = items.reduce((n, item) => n + item.tiers.length, 0);
  const adjustNoun = isAdmin ? 'Margin' : 'Extra markup';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-40 lg:pb-8">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        {view === 'review' ? (
          <button
            type="button"
            onClick={() => setView('select')}
            className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 transition-colors min-tap shrink-0"
            aria-label="Back to selection"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        ) : (
          <Link
            href="/pricelist"
            className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 transition-colors min-tap shrink-0"
            aria-label="Back to pricelist"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-fluid-2xl font-extrabold text-foreground tracking-tight">
            {view === 'select' ? 'Share Price List' : 'Review & share'}
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {view === 'select'
              ? `${selections.length} selected`
              : `${items.length} product${items.length !== 1 ? 's' : ''} · ${tierCount} price${tierCount !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Picker stays mounted so search + open folders survive a trip to Review. */}
      <div className={view === 'select' ? undefined : 'hidden'}>
        <ProductPicker
          tree={displayTree}
          loading={loading}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          placeholder="Search products to share…"
        />

        {selections.length > 0 && view === 'select' && (
          <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-3xl mx-auto">
              <button
                type="button"
                onClick={() => setView('review')}
                className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              >
                Review {selections.length} product{selections.length !== 1 ? 's' : ''}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {view === 'review' && (
        <div className="flex flex-col gap-5">
          {/* Margin / markup for every product at once */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor="bulk-pct" className="text-xs font-semibold text-muted-foreground">
                  {adjustNoun} for all products
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    id="bulk-pct"
                    type="number"
                    inputMode="decimal"
                    min={isAdmin ? undefined : 0}
                    placeholder={isAdmin ? 'Saved' : '0'}
                    value={bulkPct}
                    onChange={(e) => setBulkPct(e.target.value)}
                    className="w-20 h-11 px-2 rounded-xl border border-border bg-card text-foreground text-sm font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-sm font-bold text-foreground">%</span>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={applyBulk}>
                Apply to all
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isAdmin
                ? 'Margin over purchase price, for this list only. Leave blank to use each price’s saved margin.'
                : 'Added on top of the selling price, for this list only.'}
            </p>
          </div>

          {/* Products */}
          <div className="flex flex-col gap-2">
            {selections.map((s) => {
              const allHidden = s.node.prices.length > 0 && s.hidden.length >= s.node.prices.length;
              const pct = parsePct(s.adjustPct);
              return (
                <div key={s.node.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{s.node.name}</p>
                      {s.path.length > 0 && <p className="text-xs text-muted-foreground truncate">{s.path.join(' / ')}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSelect(s.node)}
                      aria-label={`Remove ${s.node.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 min-tap"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  {/* Tiers — tap to leave one off the list */}
                  {s.node.prices.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">Price on request</p>
                  ) : (
                    <ul className="mt-2 flex flex-col">
                      {s.node.prices.map((p) => {
                        const on = !s.hidden.includes(p.id);
                        const rate = tierRate(p, s);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => toggleTier(s.node.id, p.id)}
                              className="w-full flex items-center gap-3 py-1.5 text-left min-tap"
                            >
                              <span className={cn(
                                'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                on ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card'
                              )}>
                                {on && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className={cn('block text-sm font-semibold truncate', on ? 'text-foreground' : 'text-muted-foreground line-through')}>
                                  {p.label === 'Standard' ? 'Price' : p.label}
                                </span>
                                {isAdmin && (
                                  <span className="block text-xs text-muted-foreground tabular-nums">
                                    Cost {formatRupees(p.rate)} · +{pct ?? effectiveMarginPct(p, defaultMarginPct)}%
                                  </span>
                                )}
                              </span>
                              <span className={cn('text-sm font-bold tabular-nums text-right shrink-0', on ? 'text-foreground' : 'text-muted-foreground line-through')}>
                                {formatRateUnit(rate, p.unit)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {allHidden && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">
                      No prices ticked — this product will be left out.
                    </p>
                  )}

                  {/* Per-product margin (admin) / extra markup (staff) */}
                  {s.node.prices.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 pt-2.5 border-t border-dashed border-border">
                      <label htmlFor={`adjust-${s.node.id}`} className="text-xs font-semibold text-muted-foreground shrink-0">
                        {adjustNoun}
                      </label>
                      <input
                        id={`adjust-${s.node.id}`}
                        type="number"
                        inputMode="decimal"
                        min={isAdmin ? undefined : 0}
                        placeholder={isAdmin ? 'Saved' : '0'}
                        value={s.adjustPct}
                        onChange={(e) => updateSelection(s.node.id, { adjustPct: e.target.value })}
                        className="w-16 h-8 px-1.5 rounded-lg border border-border bg-card text-foreground text-sm font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`${adjustNoun} percent for ${s.node.name} (this list only)`}
                      />
                      <span className="text-sm font-bold text-foreground">%</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {isAdmin
                          ? pct == null ? 'saved margins' : 'over purchase'
                          : 'on top of selling price'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setView('select')}
              className="h-11 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-primary hover:bg-muted transition-colors min-tap flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add more products
            </button>
          </div>

          {/* Customer details */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-foreground">Customer details</h2>
            <Input
              label="Customer name"
              placeholder="e.g. Ramesh Patel"
              autoComplete="off"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
            <Input
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="10-digit mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              error={mobileError}
              hint="Needed to send on WhatsApp. Also printed on the PDF and image."
            />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Valid until (optional)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <Input label="Note (optional)" placeholder="Delivery terms, GST, remarks…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {/* Share */}
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleWhatsApp} disabled={!canWhatsApp || exporting}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.042z"/></svg>
              Send on WhatsApp
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleImage} loading={exporting} loadingText="Working…" disabled={!canShare}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Share image
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => handlePDF('view')} loading={exporting} loadingText="Working…" disabled={!canShare}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                View PDF
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => handlePDF('download')} loading={exporting} loadingText="Working…" disabled={!canShare}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Download PDF
              </Button>
            </div>
            {(blocker || !mobileValid) && (
              <p className="text-xs text-muted-foreground text-center">
                {blocker ?? 'Add a mobile number to send on WhatsApp.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Offscreen card for image export */}
      {view === 'review' && items.length > 0 && (
        <div className="fixed left-[-99999px] top-0 pointer-events-none" aria-hidden>
          <PricelistShareCard ref={cardRef} items={items} meta={meta} />
        </div>
      )}
    </div>
  );
}
