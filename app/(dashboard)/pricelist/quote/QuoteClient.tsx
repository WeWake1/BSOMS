'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';
import { usePricelist } from '@/hooks/usePricelist';
import { PricelistTree } from '@/components/pricelist/pricelist-tree';
import { QuoteImageCard } from '@/components/pricelist/quote-image-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  flattenProducts,
  productMatches,
  lowestPrice,
  formatRupees,
  formatPrice,
} from '@/lib/pricelist-utils';
import {
  generateQuotePDF,
  lineAmount,
  quoteTotal,
  type QuoteLine,
  type QuoteMeta,
} from '@/lib/quote-export';
import type { AuthUser } from '@/lib/auth';
import type { PricelistNodeWithRelations } from '@/types/database';

interface Selection {
  node: PricelistNodeWithRelations;
  path: string[];
  priceId: string | null;
  qty: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export function QuoteClient({ user }: { user: AuthUser }) {
  void user;
  const { tree, loading } = usePricelist();

  const [view, setView] = useState<'select' | 'review'>('select');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());

  const [meta, setMeta] = useState<QuoteMeta>({
    clientName: '',
    clientPhone: '',
    date: today(),
    validUntil: '',
    note: '',
  });
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenProducts(tree), [tree]);
  const pathById = useMemo(
    () => new Map(flat.map((f) => [f.node.id, f.path])),
    [flat]
  );
  const query = search.trim();
  const results = useMemo(
    () => (query ? flat.filter((p) => productMatches(p, query)) : []),
    [flat, query]
  );

  const selectedIds = useMemo(() => new Set(selections.keys()), [selections]);

  const toggleSelect = (node: PricelistNodeWithRelations) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.set(node.id, {
          node,
          path: pathById.get(node.id) ?? [],
          priceId: lowestPrice(node.prices)?.id ?? null,
          qty: 1,
        });
      }
      return next;
    });
  };

  const updateSelection = (id: string, patch: Partial<Selection>) =>
    setSelections((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Build quote lines (Map preserves insertion order)
  const lines: QuoteLine[] = useMemo(
    () =>
      Array.from(selections.values()).map((s) => ({
        node: s.node,
        path: s.path,
        price: s.priceId ? s.node.prices.find((p) => p.id === s.priceId) ?? null : null,
        qty: s.qty,
      })),
    [selections]
  );
  const total = useMemo(() => quoteTotal(lines), [lines]);

  const canGenerate = lines.length > 0 && meta.clientName.trim().length > 0;

  const handlePDF = async (action: 'download' | 'view' = 'download') => {
    if (!canGenerate) {
      toast.error('Add a client name and at least one product.');
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
      toast.error('Add a client name and at least one product.');
      return;
    }
    if (!cardRef.current) return;
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 80));
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const safe = (meta.clientName || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const filename = `quote-${safe}-${meta.date}.png`;

      // Try native share (mobile) with the image as a file; fall back to download.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Quotation' });
        toast.success('Shared.');
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
        toast.success('Image downloaded.');
      }
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
              ? `${selections.size} selected`
              : `${lines.length} item${lines.length !== 1 ? 's' : ''} · ${formatRupees(total)}`}
          </p>
        </div>
      </div>

      {view === 'select' ? (
        <>
          {/* Search */}
          <div className="sticky top-2 z-10 mb-4">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products to add…"
                aria-label="Search products"
                className="w-full h-12 pl-10 pr-10 rounded-2xl border border-border bg-card text-foreground text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted min-tap">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-muted animate-pulse" style={{ width: `${85 - (i % 3) * 10}%` }} />
              ))}
            </div>
          ) : query ? (
            results.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No products match “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {results.map(({ node, path }) => {
                  const checked = selectedIds.has(node.id);
                  const lo = lowestPrice(node.prices);
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => toggleSelect(node)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-foreground/15 transition-all text-left min-tap"
                      >
                        <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                          {checked && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{node.name}</p>
                          {path.length > 0 && <p className="text-xs text-muted-foreground truncate">{path.join(' / ')}</p>}
                        </div>
                        <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                          {lo ? formatPrice(lo) : <span className="text-muted-foreground font-medium">—</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <div className="rounded-2xl border border-border bg-card p-1.5">
              <PricelistTree
                nodes={tree}
                expanded={expanded}
                onToggle={toggle}
                onSelectProduct={(node) => toggleSelect(node)}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </div>
          )}

          {/* Sticky review bar */}
          {selections.size > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 bg-gradient-to-t from-background via-background to-transparent">
              <div className="max-w-3xl mx-auto">
                <button
                  type="button"
                  onClick={() => setView('review')}
                  className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                >
                  Review {selections.size} item{selections.size !== 1 ? 's' : ''}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <ReviewView
          lines={lines}
          selections={selections}
          total={total}
          meta={meta}
          setMeta={setMeta}
          updateSelection={updateSelection}
          removeSelection={(id) => toggleSelect(selections.get(id)!.node)}
          onAddMore={() => setView('select')}
          onPDF={() => handlePDF('download')}
          onViewPDF={() => handlePDF('view')}
          onImage={handleImage}
          exporting={exporting}
          canGenerate={canGenerate}
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
  lines,
  selections,
  total,
  meta,
  setMeta,
  updateSelection,
  removeSelection,
  onAddMore,
  onPDF,
  onViewPDF,
  onImage,
  exporting,
  canGenerate,
}: {
  lines: QuoteLine[];
  selections: Map<string, Selection>;
  total: number;
  meta: QuoteMeta;
  setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  removeSelection: (id: string) => void;
  onAddMore: () => void;
  onPDF: () => void;
  onViewPDF: () => void;
  onImage: () => void;
  exporting: boolean;
  canGenerate: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Line items */}
      <div className="flex flex-col gap-2">
        {lines.map((l) => {
          const sel = selections.get(l.node.id)!;
          const amt = lineAmount(l);
          return (
            <div key={l.node.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{l.node.name}</p>
                  {l.path.length > 0 && <p className="text-xs text-muted-foreground truncate">{l.path.join(' / ')}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeSelection(l.node.id)}
                  aria-label={`Remove ${l.node.name}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 min-tap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="flex items-end gap-2 mt-3">
                {/* Tier selector */}
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-medium text-muted-foreground">Price</label>
                  {l.node.prices.length === 0 ? (
                    <div className="h-10 flex items-center text-sm text-muted-foreground">On request</div>
                  ) : (
                    <select
                      value={sel.priceId ?? ''}
                      onChange={(e) => updateSelection(l.node.id, { priceId: e.target.value || null })}
                      className="w-full h-10 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {l.node.prices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} — {formatPrice(p)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Qty */}
                <div className="w-20 shrink-0">
                  <label className="text-xs font-medium text-muted-foreground">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={sel.qty}
                    onChange={(e) => updateSelection(l.node.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full h-10 px-2.5 rounded-xl border border-border bg-card text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {/* Amount */}
                <div className="w-24 shrink-0 text-right">
                  <label className="text-xs font-medium text-muted-foreground block">Amount</label>
                  <div className="h-10 flex items-center justify-end text-sm font-bold text-foreground tabular-nums">
                    {amt != null ? formatRupees(amt) : '—'}
                  </div>
                </div>
              </div>
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
      {!canGenerate && (
        <p className="text-xs text-muted-foreground text-center -mt-2">
          Add a client name to generate the quote.
        </p>
      )}
    </div>
  );
}
