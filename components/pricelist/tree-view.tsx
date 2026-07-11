'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { TagBadges } from './tag-badges';
import { formatRupees, buildBrandMatrix, type BrandMatrix } from '@/lib/pricelist-utils';
import type { PricelistTreeNode, PricelistNodeWithRelations } from '@/types/database';

interface TreeViewProps {
  categories: PricelistTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}

export function TreeView({ categories, selectedId, onSelect, onSelectProduct }: TreeViewProps) {
  const rawIdx = categories.findIndex((c) => c.id === selectedId);
  const idx = rawIdx >= 0 ? rawIdx : 0;
  const selected = categories[idx] ?? null;
  const touchStartX = useRef<number | null>(null);

  const goTo = (newIdx: number) => {
    const clamped = Math.max(0, Math.min(categories.length - 1, newIdx));
    if (categories[clamped]) onSelect(categories[clamped].id);
  };

  if (categories.length === 0) return null;

  const matrix = selected ? buildBrandMatrix(selected) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Carousel ── */}
      <div
        className="flex items-center gap-3 select-none"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 50) goTo(dx < 0 ? idx + 1 : idx - 1);
          touchStartX.current = null;
        }}
      >
        <ArrowBtn direction="left" disabled={idx === 0} onClick={() => goTo(idx - 1)} />

        <div className="flex-1 flex flex-col items-center gap-2 min-w-0 py-1">
          <span className="text-2xl font-extrabold text-foreground tracking-tight truncate max-w-full">
            {selected?.name}
          </span>
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5">
              {categories.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-label={c.name}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === idx
                      ? 'w-5 bg-primary'
                      : 'w-1.5 bg-border hover:bg-muted-foreground'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <ArrowBtn direction="right" disabled={idx === categories.length - 1} onClick={() => goTo(idx + 1)} />
      </div>

      {/* ── Tree + matrix ── */}
      {selected && (() => {
        const directProducts = selected.children.filter((c) => c.kind === 'product');

        if (matrix && matrix.brands.length > 0) {
          // 3-level: Category → Brand groups → Products (full matrix)
          return (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <TreeViz category={selected} brands={matrix.brands} />
              {matrix.models.length > 0 ? (
                <div className="overflow-x-auto">
                  <PriceTable matrix={matrix} onSelectProduct={onSelectProduct} />
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center border-t border-border">
                  No products added yet.
                </p>
              )}
            </div>
          );
        }

        if (directProducts.length > 0) {
          // 2-level: Category → Products directly (fan-out tree, prices on nodes)
          return (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <FlatTreeViz
                category={selected}
                products={directProducts}
                onSelectProduct={onSelectProduct}
              />
            </div>
          );
        }

        return (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No products in this category yet.
          </div>
        );
      })()}
    </div>
  );
}

function ArrowBtn({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Previous category' : 'Next category'}
      className="w-11 h-11 flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
    >
      {direction === 'left' ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

function TreeViz({
  category,
  brands,
}: {
  category: PricelistTreeNode;
  brands: PricelistTreeNode[];
}) {
  const n = brands.length;
  // With justify-around, each brand column is 1/n of the width.
  // The center of the first brand is at 100%/(2n) from the left.
  // So the horizontal bar starts at that offset and ends symmetrically.
  const edgePct = n > 1 ? (100 / (2 * n)).toFixed(1) : '50';

  return (
    <div className="px-4 pt-6 pb-5 border-b border-border bg-muted/20">
      {/* Root node */}
      <div className="flex justify-center">
        <div className="px-5 py-2 rounded-2xl border-2 border-primary/40 bg-primary/10 text-sm font-extrabold text-foreground">
          {category.name}
        </div>
      </div>

      {/* Trunk line */}
      <div className="flex justify-center">
        <div className="w-px h-5 bg-border" />
      </div>

      {/* Branch row */}
      <div className="relative flex justify-around">
        {/* Horizontal connecting bar */}
        <div
          className="absolute top-0 border-t-2 border-dashed border-border"
          style={{ left: `${edgePct}%`, right: `${edgePct}%` }}
        />
        {brands.map((brand) => (
          <div key={brand.id} className="flex flex-col items-center">
            {/* Vertical stub from bar to brand box */}
            <div className="w-px h-4 bg-border" />
            <div
              className="px-2.5 py-1.5 rounded-xl border border-dashed border-border bg-card text-xs font-bold text-foreground text-center break-words"
              style={{ maxWidth: 88 }}
            >
              {brand.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlatTreeViz({
  category,
  products,
  onSelectProduct,
}: {
  category: PricelistTreeNode;
  products: PricelistNodeWithRelations[];
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}) {
  const n = products.length;
  const edgePct = n > 1 ? (100 / (2 * n)).toFixed(1) : '50';

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Root node */}
      <div className="flex justify-center">
        <div className="px-5 py-2 rounded-2xl border-2 border-primary/40 bg-primary/10 text-sm font-extrabold text-foreground">
          {category.name}
        </div>
      </div>

      {/* Trunk */}
      <div className="flex justify-center">
        <div className="w-px h-5 bg-border" />
      </div>

      {/* Product leaf nodes */}
      <div className="relative flex justify-around flex-wrap gap-y-4">
        {n > 1 && (
          <div
            className="absolute top-0 border-t-2 border-dashed border-border"
            style={{ left: `${edgePct}%`, right: `${edgePct}%` }}
          />
        )}
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelectProduct(product)}
            className="flex flex-col items-center hover:opacity-80 active:scale-95 transition-all min-tap"
          >
            <div className="w-px h-4 bg-border" />
            <div
              className="px-3 py-2.5 rounded-xl border border-border bg-card shadow-sm text-center"
              style={{ minWidth: 80, maxWidth: 110 }}
            >
              <div className="text-xs font-bold text-foreground leading-tight">{product.name}</div>
              {product.tags && product.tags.length > 0 && (
                <div className="mt-1">
                  <TagBadges tags={product.tags} />
                </div>
              )}
              {product.prices.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {product.prices.map((p) => (
                    <div key={p.id} className="text-xs leading-tight">
                      {p.label !== 'Standard' && (
                        <span className="text-muted-foreground">{p.label} </span>
                      )}
                      <span className="font-extrabold text-foreground tabular-nums">
                        {formatRupees(p.rate)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground italic">on req.</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceTable({
  matrix,
  onSelectProduct,
}: {
  matrix: BrandMatrix;
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}) {
  const { brands, models, cells } = matrix;

  return (
    <table className="min-w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border bg-muted/30">
          <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border min-w-[110px]">
            Model
          </th>
          {brands.map((brand) => (
            <th
              key={brand.id}
              className="px-3 py-2.5 text-xs font-bold text-foreground text-center border-r border-border last:border-0 min-w-[100px]"
            >
              {brand.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {models.map((model, mi) => (
          <tr key={model.name} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
            {/* Model label — sticky */}
            <td className="sticky left-0 z-10 bg-card px-3 py-3 border-r border-border align-top">
              <div className="text-sm font-semibold text-foreground leading-tight">{model.name}</div>
              {model.tags.length > 0 && <TagBadges tags={model.tags} className="mt-1" />}
            </td>

            {/* Price cells */}
            {brands.map((brand, bi) => {
              const node = cells[mi][bi];
              return (
                <td
                  key={brand.id}
                  className="px-3 py-3 text-center border-r border-border last:border-0 align-middle"
                >
                  {node ? (
                    <button
                      type="button"
                      onClick={() => onSelectProduct(node)}
                      className="w-full flex flex-col items-center gap-0.5 hover:opacity-70 active:scale-95 transition-all min-tap"
                    >
                      {node.prices.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">on req.</span>
                      ) : node.prices.length === 1 ? (
                        <span className="text-sm font-extrabold text-foreground tabular-nums">
                          {formatRupees(node.prices[0].rate)}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-left">
                          {node.prices.map((p) => (
                            <div key={p.id} className="flex items-baseline gap-1 text-xs leading-tight">
                              <span className="text-muted-foreground font-medium shrink-0">{p.label}</span>
                              <span className="font-bold text-foreground tabular-nums">{formatRupees(p.rate)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
