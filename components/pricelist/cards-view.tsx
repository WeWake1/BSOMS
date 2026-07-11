'use client';

import {
  formatRupees,
  formatPrice,
  lowestPrice,
  formatSize,
  type BrandSection,
} from '@/lib/pricelist-utils';
import { TagBadges } from './tag-badges';
import type { PricelistNodeWithRelations } from '@/types/database';

interface CardsViewProps {
  sections: BrandSection[];
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}

export function CardsView({ sections, onSelectProduct }: CardsViewProps) {
  if (sections.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">Nothing in this category yet.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.id}>
          <h2 className="text-sm font-extrabold text-foreground tracking-tight mb-2 px-0.5">
            {section.title ?? 'General'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {section.products.map((p) => (
              <VariantCard key={p.id} product={p} onClick={() => onSelectProduct(p)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VariantCard({
  product,
  onClick,
}: {
  product: PricelistNodeWithRelations;
  onClick: () => void;
}) {
  const size = formatSize(product);
  const lo = lowestPrice(product.prices);
  const multi = product.prices.length > 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-border bg-card p-3.5 hover:border-foreground/15 hover:shadow-sm transition-all min-tap flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-foreground">{product.name}</span>
            <TagBadges tags={product.tags} />
          </div>
          {size && <p className="text-xs text-muted-foreground mt-0.5">{size}</p>}
        </div>
        {!multi && (
          <span className="text-base font-extrabold text-foreground tabular-nums shrink-0">
            {lo ? formatRupees(lo.rate) : <span className="text-xs text-muted-foreground font-medium">On request</span>}
          </span>
        )}
      </div>

      {multi && (
        <div className="flex flex-wrap gap-1.5">
          {product.prices.map((pr) => (
            <span
              key={pr.id}
              className="inline-flex items-baseline gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
            >
              <span className="font-semibold text-muted-foreground">{pr.label}</span>
              <span className="font-bold text-foreground tabular-nums">{formatRupees(pr.rate)}</span>
            </span>
          ))}
        </div>
      )}

      {!multi && lo?.unit && (
        <span className="text-xs text-muted-foreground">{formatPrice(lo)}</span>
      )}
    </button>
  );
}
