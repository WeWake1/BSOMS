'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePricelist } from '@/hooks/usePricelist';
import { PricelistTree } from '@/components/pricelist/pricelist-tree';
import { ProductDetailSheet } from '@/components/pricelist/product-detail-sheet';
import { NodeFormSheet, type PricelistLevel } from '@/components/pricelist/node-form-sheet';
import { SupplierManagerSheet } from '@/components/pricelist/supplier-manager-sheet';
import { CategoryTabs } from '@/components/pricelist/category-tabs';
import { GridView } from '@/components/pricelist/grid-view';
import { CardsView } from '@/components/pricelist/cards-view';
import { TreeView } from '@/components/pricelist/tree-view';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  flattenProducts,
  getCategoryNodes,
  getBrandSections,
  productMatches,
  lowestPrice,
  formatPrice,
  treeWithSellingRates,
} from '@/lib/pricelist-utils';
import type { AuthUser } from '@/lib/auth';
import type {
  PricelistNodeWithRelations,
  PricelistTreeNode,
} from '@/types/database';

type View = 'grid' | 'cards' | 'tree' | 'search' | 'manage';
type PriceMode = 'purchase' | 'selling';

interface Selected {
  node: PricelistNodeWithRelations;
  path: string[];
}

interface FormState {
  mode: 'create' | 'edit';
  parentId: string | null;
  node: PricelistNodeWithRelations | null;
  level: PricelistLevel;
}

export function PricelistClient({ user }: { user: AuthUser }) {
  const isAdmin = user.profile.role === 'admin';
  const { tree, suppliers, defaultMarginPct, loading, error } = usePricelist(isAdmin);
  const [supabase] = useState(() => createClient());

  const [view, setView] = useState<View>('grid');
  const [priceMode, setPriceMode] = useState<PriceMode>('purchase');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Selected | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PricelistTreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Persisted layout choice
  useEffect(() => {
    const v = localStorage.getItem('pricelistView') as View | null;
    const valid: View[] = ['grid', 'cards', 'tree', 'search', 'manage'];
    if (v && valid.includes(v)) setView(v);
    const m = localStorage.getItem('pricelistPriceMode') as PriceMode | null;
    if (m === 'purchase' || m === 'selling') setPriceMode(m);
  }, []);
  const changeView = (v: View) => {
    setView(v);
    localStorage.setItem('pricelistView', v);
  };
  const changePriceMode = (m: PriceMode) => {
    setPriceMode(m);
    localStorage.setItem('pricelistPriceMode', m);
  };
  const effectiveView: View = (view === 'manage' && !isAdmin) ? 'grid' : view;

  // Staff/viewer data is already selling-priced at the source; the toggle is
  // an admin-only, display-only transform of the raw (purchase) tree.
  const displayTree = useMemo(
    () => (isAdmin && priceMode === 'selling' ? treeWithSellingRates(tree, defaultMarginPct) : tree),
    [isAdmin, priceMode, tree, defaultMarginPct]
  );

  // Raw nodes by id — the edit form must always receive purchase rates,
  // never the selling-mapped clones.
  const rawNodeById = useMemo(() => {
    const map = new Map<string, PricelistNodeWithRelations>();
    const walk = (nodes: PricelistTreeNode[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.children.length) walk(n.children);
      }
    };
    walk(tree);
    return map;
  }, [tree]);

  const flat = useMemo(() => flattenProducts(displayTree), [displayTree]);
  const pathById = useMemo(() => new Map(flat.map((f) => [f.node.id, f.path])), [flat]);
  const categories = useMemo(() => getCategoryNodes(displayTree), [displayTree]);

  const searchQuery = search.trim();
  const searchResults = useMemo(
    () => (searchQuery ? flat.filter((p) => productMatches(p, searchQuery)) : []),
    [flat, searchQuery]
  );

  // Default / keep a valid selected category
  useEffect(() => {
    if (categories.length === 0) {
      if (categoryId !== null) setCategoryId(null);
    } else if (!categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  const sections = useMemo(
    () => (selectedCategory ? getBrandSections(selectedCategory) : []),
    [selectedCategory]
  );

  const selectProduct = (node: PricelistNodeWithRelations) =>
    setSelected({ node, path: pathById.get(node.id) ?? [] });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Admin handlers ──────────────────────────────────────────────
  const addRoot = () =>
    setForm({ mode: 'create', parentId: null, node: null, level: 'category' });
  const addChild = (parent: PricelistTreeNode) => {
    // depth 0 = category → adding a brand; depth 1 = brand → adding a variety
    const level: PricelistLevel = parent.depth === 0 ? 'brand' : 'variety';
    setForm({ mode: 'create', parentId: parent.id, node: null, level });
  };
  const editNode = (node: PricelistNodeWithRelations) => {
    // Selling mode hands out mapped clones — always edit the raw purchase node.
    const raw = rawNodeById.get(node.id) ?? node;
    const level: PricelistLevel =
      raw.kind === 'product' ? 'variety'
      : raw.parent_id === null ? 'category'
      : 'brand';
    setForm({ mode: 'edit', parentId: raw.parent_id, node: raw, level });
  };
  const editFromDetail = (node: PricelistNodeWithRelations) => {
    setSelected(null);
    editNode(node);
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from('pricelist_nodes').delete().eq('id', toDelete.id);
      if (err) throw err;
      toast.success(`Deleted “${toDelete.name}”.`);
      setToDelete(null);
    } catch {
      toast.error("Couldn't delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteMessage = toDelete
    ? toDelete.kind === 'group' && toDelete.children.length > 0
      ? `This will also delete everything inside “${toDelete.name}” (${toDelete.children.length} item${toDelete.children.length !== 1 ? 's' : ''}). This can't be undone.`
      : `Delete “${toDelete.name}”? This can't be undone.`
    : '';

  const tabs: { key: View; label: string }[] = [
    { key: 'grid', label: 'Grid' },
    { key: 'cards', label: 'Cards' },
    { key: 'tree', label: 'Tree' },
    { key: 'search', label: 'Search' },
    ...(isAdmin ? [{ key: 'manage' as View, label: 'Manage' }] : []),
  ];

  const showFab = isAdmin && effectiveView === 'manage';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-tap shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-fluid-2xl font-extrabold text-foreground tracking-tight">Pricelist</h1>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${flat.length} product${flat.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setSuppliersOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors min-tap"
            >
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M3 9l2-5h14l2 5M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /></svg>
              <span className="hidden sm:inline">Suppliers</span>
            </button>
          )}
          <Link
            href="/pricelist/quote"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors min-tap"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
            Quote
          </Link>
        </div>
      </div>

      {/* Purchase ⇄ Selling toggle + default margin (admin only) */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl" role="group" aria-label="Price mode">
            <button
              type="button"
              onClick={() => changePriceMode('purchase')}
              className={cn(
                'h-9 px-4 rounded-lg text-sm font-semibold transition-colors min-tap',
                priceMode === 'purchase' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Purchase
            </button>
            <button
              type="button"
              onClick={() => changePriceMode('selling')}
              className={cn(
                'h-9 px-4 rounded-lg text-sm font-semibold transition-colors min-tap',
                priceMode === 'selling'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Selling
            </button>
          </div>
          <DefaultMarginEditor
            value={defaultMarginPct}
            onSave={async (pct) => {
              const { error: err } = await (supabase.from('pricelist_settings') as any)
                .update({ default_margin_pct: pct })
                .eq('id', 1);
              if (err) throw err;
            }}
          />
        </div>
      )}

      {/* View switcher */}
      <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-muted rounded-xl mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => changeView(t.key)}
            className={cn(
              'h-9 rounded-lg text-sm font-semibold transition-colors min-tap',
              effectiveView === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-4 rounded-2xl border border-red-100 dark:border-red-900/50">
          Couldn&apos;t load the pricelist. {error}
        </div>
      ) : loading ? (
        <PricelistSkeleton />
      ) : flat.length === 0 && categories.length === 0 ? (
        <EmptyState isAdmin={isAdmin} onAdd={addRoot} />
      ) : effectiveView === 'tree' ? (
        <TreeView
          categories={categories}
          selectedId={selectedCategory?.id ?? null}
          onSelect={setCategoryId}
          onSelectProduct={selectProduct}
        />
      ) : effectiveView === 'search' ? (
        <SearchView
          search={search}
          setSearch={setSearch}
          query={searchQuery}
          results={searchResults}
          onSelectProduct={selectProduct}
        />
      ) : effectiveView === 'manage' ? (
        <div className="rounded-2xl border border-border bg-card p-1.5">
          <PricelistTree
            nodes={displayTree}
            expanded={expanded}
            onToggle={toggle}
            onSelectProduct={selectProduct}
            isAdmin={isAdmin}
            onAddChild={addChild}
            onEditNode={editNode}
            onDeleteNode={setToDelete}
          />
        </div>
      ) : (
        <>
          <CategoryTabs categories={categories} selectedId={selectedCategory?.id ?? null} onSelect={setCategoryId} />
          {effectiveView === 'grid' ? (
            <GridView sections={sections} onSelectProduct={selectProduct} />
          ) : (
            <CardsView sections={sections} onSelectProduct={selectProduct} />
          )}
        </>
      )}

      {/* FAB — admin add root category (Manage view) */}
      {showFab && (
        <button
          type="button"
          onClick={addRoot}
          className="fixed bottom-6 right-5 z-20 h-14 pl-4 pr-5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2 font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all"
          aria-label="Add category"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </button>
      )}

      {/* Detail sheet */}
      <ProductDetailSheet
        node={selected?.node ?? null}
        path={selected?.path ?? []}
        onClose={() => setSelected(null)}
        onEdit={isAdmin ? editFromDetail : undefined}
      />

      {/* Add / edit form */}
      {form && (
        <NodeFormSheet
          isOpen={!!form}
          onClose={() => setForm(null)}
          mode={form.mode}
          parentId={form.parentId}
          level={form.level}
          node={form.node}
          suppliers={suppliers}
          defaultMarginPct={defaultMarginPct}
        />
      )}

      {/* Suppliers */}
      {isAdmin && (
        <SupplierManagerSheet isOpen={suppliersOpen} onClose={() => setSuppliersOpen(false)} suppliers={suppliers} />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!toDelete}
        title={`Delete ${toDelete?.kind === 'group' ? 'group' : 'product'}?`}
        message={deleteMessage}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/**
 * Compact inline editor for the global default selling margin.
 * Blank per-tier margins fall back to this value. Saves on blur / Enter.
 */
function DefaultMarginEditor({
  value,
  onSave,
}: {
  value: number;
  onSave: (pct: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  // Follow external updates (initial load, realtime) unless mid-save.
  useEffect(() => {
    if (!saving) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = async () => {
    const pct = Number(draft);
    if (!Number.isFinite(pct) || pct < 0) {
      setDraft(String(value));
      return;
    }
    if (pct === value) return;
    setSaving(true);
    try {
      await onSave(pct);
      toast.success(`Default margin set to ${pct}%.`);
    } catch {
      toast.error("Couldn't save the default margin.");
      setDraft(String(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-card">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Default margin</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label="Default selling margin percent"
        className="w-14 h-8 px-1.5 rounded-lg border border-border bg-background text-foreground text-sm font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <span className="text-sm font-bold text-foreground">%</span>
    </label>
  );
}

function SearchView({
  search,
  setSearch,
  query,
  results,
  onSelectProduct,
}: {
  search: string;
  setSearch: (v: string) => void;
  query: string;
  results: { node: PricelistNodeWithRelations; path: string[] }[];
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}) {
  return (
    <div>
      {/* Search box */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all products…"
          aria-label="Search all products"
          autoFocus
          className="w-full h-12 pl-10 pr-10 rounded-2xl border border-border bg-card text-foreground text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted min-tap">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {!query ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          Search across every category, brand, and product.
        </p>
      ) : results.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No products match “{query}”.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {results.map(({ node, path }) => {
            const lo = lowestPrice(node.prices);
            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelectProduct(node)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-foreground/15 transition-all text-left min-tap"
                >
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
      )}
    </div>
  );
}

function PricelistSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-11 rounded-xl bg-muted animate-pulse" style={{ width: `${85 - (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-border rounded-2xl">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9M14 17H5M17 3l4 4-4 4M7 21l-4-4 4-4" /></svg>
      </div>
      <p className="text-sm font-semibold text-foreground">No products yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        {isAdmin ? 'Add your first category to start building the pricelist.' : 'Prices added by an admin will appear here.'}
      </p>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors min-tap"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add category
        </button>
      )}
    </div>
  );
}
