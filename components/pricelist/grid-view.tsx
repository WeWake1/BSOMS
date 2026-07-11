'use client';

import {
  buildPriceMatrix,
  formatRupees,
  formatPrice,
  lowestPrice,
  type BrandSection,
} from '@/lib/pricelist-utils';
import { TagBadges } from './tag-badges';
import type { PricelistNodeWithRelations } from '@/types/database';

interface GridViewProps {
  sections: BrandSection[];
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}

export function GridView({ sections, onSelectProduct }: GridViewProps) {
  if (sections.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">Nothing in this category yet.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <BrandMatrix key={section.id} section={section} onSelectProduct={onSelectProduct} />
      ))}
    </div>
  );
}

function BrandMatrix({
  section,
  onSelectProduct,
}: {
  section: BrandSection;
  onSelectProduct: (node: PricelistNodeWithRelations) => void;
}) {
  const matrix = buildPriceMatrix(section.products);
  const simple = matrix.trivial || matrix.rowLabels.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-foreground tracking-tight">
          {section.title ?? 'General'}
        </span>
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {section.products.length} item{section.products.length !== 1 ? 's' : ''}
        </span>
      </div>

      {simple ? (
        <ul className="divide-y divide-border">
          {section.products.map((p) => {
            const lo = lowestPrice(p.prices);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectProduct(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left min-tap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <TagBadges tags={p.tags} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                    {lo ? formatPrice(lo) : <span className="text-muted-foreground font-medium">On request</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Size
                </th>
                {matrix.products.map((p) => (
                  <th key={p.id} className="px-3 py-2 text-center align-bottom min-w-[104px]">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(p)}
                      className="text-sm font-bold text-foreground hover:text-primary transition-colors leading-tight"
                    >
                      {p.name}
                    </button>
                    <div className="flex justify-center mt-1">
                      <TagBadges tags={p.tags} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rowLabels.map((label) => (
                <tr key={label} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">
                    {label}
                  </td>
                  {matrix.products.map((p) => {
                    const pr = matrix.cell(p, label);
                    return (
                      <td key={p.id} className="px-3 py-2.5 text-center tabular-nums font-medium text-foreground">
                        {pr ? formatRupees(pr.rate) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
