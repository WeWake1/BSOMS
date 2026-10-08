'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePricelist } from '@/hooks/usePricelist';
import { ProductPicker } from '@/components/pricelist/product-picker';
import { QuoteImageCard } from '@/components/pricelist/quote-image-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  flattenProducts,
  lowestPrice,
  formatRupees,
  formatPrice,
  applyMargin,
  sellingRate,
  treeWithSellingRates,
  isPerSqFt,
  nodeSizeFt,
  areaSqFt,
  formatSizeFt,
  SQFT_SIZE_PRESETS,
  type SizeFt,
} from '@/lib/pricelist-utils';
import {
  generateQuotePDF,
  isSqFtLine,
  lineAmount,
  lineNeedsSize,
  linePieceRate,
  quoteTotal,
  type QuoteLine,
  type QuoteMeta,
} from '@/lib/quote-export';
import { shareOrDownloadPng, fileSlug } from '@/lib/share-image';
import type { AuthUser } from '@/lib/auth';
import type { PricelistNodeWithRelations, PricelistPrice } from '@/types/database';

interface Selection {
  /** Unique per line — the same product can be quoted on several lines
   *  (e.g. BELL LAMINATE at SF and again at TEXTURE). */
  key: string;
  node: PricelistNodeWithRelations;
  path: string[];
  priceId: string | null;
  qty: number;
  /** Quote-only margin % override (admin). Blank = tier's own default.
   *  Never written back to the database. */
  marginPct: string;
  /** Per-sq.ft. tiers: chosen size in feet. Strings so a custom size can be
   *  mid-typing; blank = not picked yet. */
  sizeL: string;
  sizeW: string;
  /** Show the free L × W inputs instead of the preset chips. */
  customSize: boolean;
}

// Local calendar date (toISOString alone is UTC — before 5:30 AM IST it
// would default the date to yesterday).
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Line keys only need to be unique within this page session (no
// crypto.randomUUID — older phones in use don't have it).
let lineSeq = 0;
const newLineKey = () => `line-${++lineSeq}`;

function newSelection(
  node: PricelistNodeWithRelations,
  path: string[],
  price: PricelistPrice | null,
  defaultMarginPct: number
): Selection {
  // Per-sq.ft. lines start on the variety's saved sheet size, if it has one.
  const size = nodeSizeFt(node);
  return {
    key: newLineKey(),
    node,
    path,
    priceId: price?.id ?? null,
    qty: 1,
    marginPct: String(price?.margin_pct ?? defaultMarginPct),
    sizeL: size ? String(size.length) : '',
    sizeW: size ? String(size.width) : '',
    customSize: false,
  };
}

/** The selection's size if both sides are valid positive numbers. */
function parseSize(s: Pick<Selection, 'sizeL' | 'sizeW'>): SizeFt | null {
  const length = Number(s.sizeL);
  const width = Number(s.sizeW);
  if (!s.sizeL.trim() || !s.sizeW.trim()) return null;
  if (!(length > 0) || !(width > 0)) return null;
  return { length, width };
}

export function QuoteClient({ user }: { user: AuthUser }) {
  const isAdmin = user.profile.role === 'admin';
  const { tree, defaultMarginPct, loading } = usePricelist(isAdmin);

  const [view, setView] = useState<'select' | 'review'>('select');
  const [selections, setSelections] = useState<Selection[]>([]);

  const [meta, setMeta] = useState<QuoteMeta>({
    clientName: '',
    clientPhone: '',
    date: today(),
    validUntil: '',
    note: '',
  });
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Raw tree = purchase rates for admin / selling rates for staff (their data
  // arrives pre-marked-up). Selections always store RAW nodes so the admin's
  // margin math has the purchase rate to work from.
  const flatRaw = useMemo(() => flattenProducts(tree), [tree]);
  const rawById = useMemo(
    () => new Map(flatRaw.map((f) => [f.node.id, f.node])),
    [flatRaw]
  );
  const pathById = useMemo(
    () => new Map(flatRaw.map((f) => [f.node.id, f.path])),
    [flatRaw]
  );

  // Quotes are in SELLING terms — the picker must display selling prices.
  // (For staff this transform is an identity: margins are null and the
  // default is 0, because their rates are already selling.)
  const displayTree = useMemo(
    () => treeWithSellingRates(tree, defaultMarginPct),
    [tree, defaultMarginPct]
  );

  const selectedIds = useMemo(
    () => new Set(selections.map((s) => s.node.id)),
    [selections]
  );

  // Picker checkbox: on = add one line, off = drop every line of that product.
  const toggleSelect = (node: PricelistNodeWithRelations) => {
    // The picker hands out selling-mapped clones — resolve back to the raw node.
    const raw = rawById.get(node.id) ?? node;
    setSelections((prev) =>
      prev.some((s) => s.node.id === raw.id)
        ? prev.filter((s) => s.node.id !== raw.id)
        : [
            ...prev,
            newSelection(raw, pathById.get(raw.id) ?? [], lowestPrice(raw.prices), defaultMarginPct),
          ]
    );
  };

  const updateSelection = (key: string, patch: Partial<Selection>) =>
    setSelections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const removeLine = (key: string) =>
    setSelections((prev) => prev.filter((s) => s.key !== key));

  // Quote the same product again on its own line, right after its last line.
  // Picks the next tier not on the quote yet; once every tier is used it
  // repeats this line's tier (e.g. the same door in another size).
  const addAnotherLine = (key: string) =>
    setSelections((prev) => {
      const src = prev.find((s) => s.key === key);
      if (!src) return prev;
      const siblings = prev.filter((s) => s.node.id === src.node.id);
      const used = new Set(siblings.map((s) => s.priceId));
      const price =
        src.node.prices.find((p) => !used.has(p.id)) ??
        src.node.prices.find((p) => p.id === src.priceId) ??
        null;
      const line = newSelection(src.node, src.path, price, defaultMarginPct);
      const at = prev.lastIndexOf(siblings[siblings.length - 1]) + 1;
      return [...prev.slice(0, at), line, ...prev.slice(at)];
    });

  // Effective margin % for a selection: its quote-only override if valid,
  // else the chosen tier's own margin, else the global default.
  const selectionMarginPct = useCallback(
    (s: Selection): number => {
      const n = Number(s.marginPct);
      if (s.marginPct.trim() !== '' && Number.isFinite(n)) return n;
      const price = s.priceId ? s.node.prices.find((p) => p.id === s.priceId) : null;
      return price?.margin_pct ?? defaultMarginPct;
    },
    [defaultMarginPct]
  );

  // Build quote lines in selection order. The line's price is a clone with
  // the SELLING rate baked in, so totals, the PDF, and the image card all
  // stay margin-unaware. (Staff: margin 0 → identity.)
  const lines: QuoteLine[] = useMemo(
    () =>
      selections.map((s) => {
        const raw = s.priceId ? s.node.prices.find((p) => p.id === s.priceId) ?? null : null;
        return {
          key: s.key,
          node: s.node,
          path: s.path,
          price: raw ? { ...raw, rate: applyMargin(raw.rate, selectionMarginPct(s)) } : null,
          qty: s.qty,
          size: raw && isPerSqFt(raw.unit) ? parseSize(s) : null,
        };
      }),
    [selections, selectionMarginPct]
  );
  const total = useMemo(() => quoteTotal(lines), [lines]);
  const missingSizes = useMemo(() => lines.filter(lineNeedsSize).length, [lines]);

  const blocker = !meta.clientName.trim()
    ? 'Add a client name to generate the quote.'
    : missingSizes > 0
      ? `Pick a size for ${missingSizes} per sq.ft. item${missingSizes !== 1 ? 's' : ''}.`
      : null;
  const canGenerate = lines.length > 0 && !blocker;

  const handlePDF = async (action: 'download' | 'view' = 'download') => {
    if (!canGenerate) {
      toast.error(blocker ?? 'Add at least one product.');
      return;
    }
    setExporting(true);
    try {
      await generateQuotePDF(lines, meta, action);
      if (action === 'download') toast.success('PDF downloaded.');
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate the PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleImage = async () => {
    if (!canGenerate) {
      toast.error(blocker ?? 'Add at least one product.');
      return;
    }
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const result = await shareOrDownloadPng(
        cardRef.current,
        `quote-${fileSlug(meta.clientName)}-${meta.date}.png`,
        'Quotation'
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
            {view === 'select' ? 'New Quote' : 'Review & generate'}
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {view === 'select'
              ? `${selections.length} selected`
              : `${lines.length} item${lines.length !== 1 ? 's' : ''} · ${formatRupees(total)}`}
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
        />

        {/* Sticky review bar */}
        {selections.length > 0 && view === 'select' && (
          <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-3xl mx-auto">
              <button
                type="button"
                onClick={() => setView('review')}
                className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              >
                Review {selections.length} item{selections.length !== 1 ? 's' : ''}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {view === 'review' && (
        <ReviewView
          rows={selections.map((sel, i) => ({ sel, line: lines[i] }))}
          total={total}
          meta={meta}
          setMeta={setMeta}
          updateSelection={updateSelection}
          removeLine={removeLine}
          addAnotherLine={addAnotherLine}
          onAddMore={() => setView('select')}
          onPDF={() => handlePDF('download')}
          onViewPDF={() => handlePDF('view')}
          onImage={handleImage}
          exporting={exporting}
          canGenerate={canGenerate}
          blocker={blocker}
          isAdmin={isAdmin}
          defaultMarginPct={defaultMarginPct}
          selectionMarginPct={selectionMarginPct}
        />
      )}

      {/* Offscreen card for image export */}
      {view === 'review' && lines.length > 0 && (
        <div className="fixed left-[-99999px] top-0 pointer-events-none" aria-hidden>
          <QuoteImageCard ref={cardRef} lines={lines} meta={meta} total={total} />
        </div>
      )}
    </div>
  );
}

// ── Review view ─────────────────────────────────────────────────────
function ReviewView({
  rows,
  total,
  meta,
  setMeta,
  updateSelection,
  removeLine,
  addAnotherLine,
  onAddMore,
  onPDF,
  onViewPDF,
  onImage,
  exporting,
  canGenerate,
  blocker,
  isAdmin,
  defaultMarginPct,
  selectionMarginPct,
}: {
  rows: { sel: Selection; line: QuoteLine }[];
  total: number;
  meta: QuoteMeta;
  setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
  updateSelection: (key: string, patch: Partial<Selection>) => void;
  removeLine: (key: string) => void;
  addAnotherLine: (key: string) => void;
  onAddMore: () => void;
  onPDF: () => void;
  onViewPDF: () => void;
  onImage: () => void;
  exporting: boolean;
  canGenerate: boolean;
  blocker: string | null;
  isAdmin: boolean;
  defaultMarginPct: number;
  selectionMarginPct: (s: Selection) => number;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Line items */}
      <div className="flex flex-col gap-2">
        {rows.map(({ sel, line: l }) => {
          const amt = lineAmount(l);
          const sqft = isSqFtLine(l);
          // Raw tier (admin: purchase rate) behind this line's selling price.
          const rawPrice = sel.priceId
            ? sel.node.prices.find((p) => p.id === sel.priceId) ?? null
            : null;
          const linePct = selectionMarginPct(sel);
          const canRepeat = l.node.prices.length > 1 || sqft;
          return (
            <div key={l.key} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{l.node.name}</p>
                  {l.path.length > 0 && <p className="text-xs text-muted-foreground truncate">{l.path.join(' / ')}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  aria-label={`Remove ${l.node.name}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 min-tap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="flex items-end gap-2 mt-3">
                {/* Tier selector */}
                <div className="flex-1 min-w-0">
                  <label htmlFor={`price-${l.key}`} className="text-xs font-medium text-muted-foreground">Price</label>
                  {l.node.prices.length === 0 ? (
                    <div className="h-10 flex items-center text-sm text-muted-foreground">On request</div>
                  ) : (
                    <select
                      id={`price-${l.key}`}
                      value={sel.priceId ?? ''}
                      onChange={(e) => {
                        const np = l.node.prices.find((pp) => pp.id === e.target.value) ?? null;
                        // Switching tiers resets the quote-only margin to that tier's default.
                        updateSelection(l.key, {
                          priceId: e.target.value || null,
                          marginPct: String(np?.margin_pct ?? defaultMarginPct),
                        });
                      }}
                      className="w-full h-10 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {l.node.prices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {/* Quotes are in selling terms (identity for staff). */}
                          {p.label} — {formatPrice({ ...p, rate: sellingRate(p, defaultMarginPct) })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Qty */}
                <div className="w-20 shrink-0">
                  <label htmlFor={`qty-${l.key}`} className="text-xs font-medium text-muted-foreground">Qty</label>
                  <input
                    id={`qty-${l.key}`}
                    type="number"
                    min={1}
                    value={sel.qty}
                    onChange={(e) => updateSelection(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full h-10 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {/* Amount */}
                <div className="w-24 shrink-0 text-right">
                  <span className="text-xs font-medium text-muted-foreground block">Amount</span>
                  <div className="h-10 flex items-center justify-end text-sm font-bold text-foreground tabular-nums">
                    {amt != null ? formatRupees(amt) : '—'}
                  </div>
                </div>
              </div>

              {/* Per-sq.ft. tiers: amount = rate × L × W × qty, so ask for the size. */}
              {sqft && (
                <SqFtSizePicker
                  sel={sel}
                  line={l}
                  onChange={(patch) => updateSelection(l.key, patch)}
                />
              )}

              {/* Admin-only: quote-scoped margin override. Staff never see
                  margins — they'd expose the purchase price. */}
              {isAdmin && rawPrice && (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-dashed border-border">
                  <label
                    htmlFor={`margin-${l.key}`}
                    className="text-xs font-semibold text-muted-foreground shrink-0"
                  >
                    Margin
                  </label>
                  <input
                    id={`margin-${l.key}`}
                    type="number"
                    inputMode="decimal"
                    value={sel.marginPct}
                    onChange={(e) => updateSelection(l.key, { marginPct: e.target.value })}
                    className="w-16 h-8 px-1.5 rounded-lg border border-border bg-card text-foreground text-sm font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={`Margin percent for ${l.node.name} (this quote only)`}
                  />
                  <span className="text-sm font-bold text-foreground">%</span>
                  <span className="text-xs text-muted-foreground truncate">
                    Cost {formatRupees(rawPrice.rate)} → {formatRupees(applyMargin(rawPrice.rate, linePct))}
                    {sqft ? '/sq.ft' : ''}
                    <span className="hidden sm:inline"> · this quote only</span>
                  </span>
                </div>
              )}

              {/* Same product again with another tier (SF + TEXTURE) or size. */}
              {canRepeat && (
                <button
                  type="button"
                  onClick={() => addAnotherLine(l.key)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline min-tap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {sqft ? 'Add another price or size' : 'Add another price'}
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddMore}
          className="h-11 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-primary hover:bg-muted transition-colors min-tap flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add more products
        </button>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-2xl bg-muted/50 border border-border px-4 py-3">
        <span className="text-sm font-bold text-muted-foreground">Total</span>
        <span className="text-xl font-extrabold text-foreground tabular-nums">{formatRupees(total)}</span>
      </div>

      {/* Client details */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-foreground">Client details</h2>
        <Input label="Client name" placeholder="e.g. Ramesh Patel" value={meta.clientName} onChange={(e) => setMeta((m) => ({ ...m, clientName: e.target.value }))} />
        <Input label="Phone (optional)" type="tel" inputMode="tel" value={meta.clientPhone} onChange={(e) => setMeta((m) => ({ ...m, clientPhone: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Date" type="date" value={meta.date} onChange={(e) => setMeta((m) => ({ ...m, date: e.target.value }))} />
          <Input label="Valid until (optional)" type="date" value={meta.validUntil} onChange={(e) => setMeta((m) => ({ ...m, validUntil: e.target.value }))} />
        </div>
        <Input label="Note (optional)" placeholder="Delivery terms, remarks…" value={meta.note} onChange={(e) => setMeta((m) => ({ ...m, note: e.target.value }))} />
      </div>

      {/* Generate */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onViewPDF} loading={exporting} loadingText="Working…" disabled={!canGenerate}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          View PDF
        </Button>
        <Button className="flex-1" onClick={onPDF} loading={exporting} loadingText="Working…" disabled={!canGenerate}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Download PDF
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onImage} loading={exporting} loadingText="Working…" disabled={!canGenerate}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Share image
        </Button>
      </div>
      {blocker && (
        <p className="text-xs text-muted-foreground text-center -mt-2">{blocker}</p>
      )}
    </div>
  );
}

// ── Size picker for per-sq.ft. lines ────────────────────────────────
const sameSize = (a: SizeFt | null, b: SizeFt) =>
  !!a && a.length === b.length && a.width === b.width;

function SqFtSizePicker({
  sel,
  line,
  onChange,
}: {
  sel: Selection;
  line: QuoteLine;
  onChange: (patch: Partial<Selection>) => void;
}) {
  const current = parseSize(sel);
  // The variety's own sheet size (if saved) leads, then the common sizes.
  const saved = nodeSizeFt(sel.node);
  const chips = [...(saved ? [saved] : []), ...SQFT_SIZE_PRESETS].filter(
    (c, i, all) => all.findIndex((o) => sameSize(o, c)) === i
  );
  const custom = sel.customSize || (current != null && !chips.some((c) => sameSize(current, c)));
  const piece = linePieceRate(line);

  const chipClass = (active: boolean) =>
    cn(
      'h-11 min-w-[3.5rem] flex-auto px-2 rounded-xl border text-sm font-semibold tabular-nums transition-colors',
      active
        ? 'bg-primary border-primary text-primary-foreground'
        : 'bg-card border-border text-foreground hover:bg-muted'
    );

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        Size (ft) · priced per sq.ft.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Size for ${sel.node.name}`}>
        {chips.map((c) => {
          const active = !custom && sameSize(current, c);
          return (
            <button
              key={`${c.length}x${c.width}`}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange({ sizeL: String(c.length), sizeW: String(c.width), customSize: false })
              }
              className={chipClass(active)}
            >
              {formatSizeFt(c)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => onChange({ customSize: true })}
          className={chipClass(custom)}
        >
          Custom
        </button>
      </div>

      {custom && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Length"
            aria-label="Length in feet"
            value={sel.sizeL}
            onChange={(e) => onChange({ sizeL: e.target.value })}
            className="w-24 h-11 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm font-bold text-muted-foreground">×</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Width"
            aria-label="Width in feet"
            value={sel.sizeW}
            onChange={(e) => onChange({ sizeW: e.target.value })}
            className="w-24 h-11 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm font-medium text-muted-foreground">ft</span>
        </div>
      )}

      {current && line.price && piece != null ? (
        <p className="text-xs text-muted-foreground mt-2 tabular-nums">
          {formatRupees(line.price.rate)}/sq.ft × {areaSqFt(current)} sq.ft ={' '}
          <span className="font-bold text-foreground">{formatRupees(piece)}</span> each
        </p>
      ) : (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-2">
          Pick a size to price this line.
        </p>
      )}
    </div>
  );
}
