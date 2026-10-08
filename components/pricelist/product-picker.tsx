'use client';

import { useMemo, useState } from 'react';
import { PricelistTree } from './pricelist-tree';
import { flattenProducts, productMatches, lowestPrice, formatPrice } from '@/lib/pricelist-utils';
import type { PricelistNodeWithRelations, PricelistTreeNode } from '@/types/database';

interface ProductPickerProps {
  /** Tree to pick from — already in the prices the user should see. */
  tree: PricelistTreeNode[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggle: (node: PricelistNodeWithRelations) => void;
  placeholder?: string;
}

/**
 * Multi-select product picker: sticky search over every product, or the
 * browsable tree with checkboxes. Owns its own search / expanded state, so
 * keep it mounted (hide it) if the user should come back to the same spot.
 */
export function ProductPicker({
  tree,
  loading,
  selectedIds,
  onToggle,
  placeholder = 'Search products to add…',
}: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const flat = useMemo(() => flattenProducts(tree), [tree]);
  const query = search.trim();
  const results = useMemo(
    () => (query ? flat.filter((p) => productMatches(p, query)) : []),
    [flat, query]
  );

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {/* Search */}
      <div className="sticky top-2 z-10 mb-4">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
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
                    onClick={() => onToggle(node)}
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
            onToggle={toggleExpanded}
            onSelectProduct={(node) => onToggle(node)}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={onToggle}
          />
        </div>
      )}
    </>
  );
}
