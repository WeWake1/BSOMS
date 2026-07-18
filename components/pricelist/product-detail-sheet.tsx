'use client';

import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { TagBadges } from './tag-badges';
import { formatPrice, formatSize } from '@/lib/pricelist-utils';
import {
  sanitizeMobileInput,
  isValidIndianMobile,
  buildWhatsAppUrl,
} from '@/lib/utils';
import type { PricelistNodeWithRelations } from '@/types/database';

interface ProductDetailSheetProps {
  node: PricelistNodeWithRelations | null;
  /** Ancestor names root → parent, for the breadcrumb. */
  path: string[];
  onClose: () => void;
  /** Admin-only: open the edit form for this product. */
  onEdit?: (node: PricelistNodeWithRelations) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export function ProductDetailSheet({
  node,
  path,
  onClose,
  onEdit,
}: ProductDetailSheetProps) {
  const size = node ? formatSize(node) : '';
  const catalogueUrl = node?.catalogue_url?.trim() || '';
  const catalogueHref = catalogueUrl
    ? /^https?:\/\//i.test(catalogueUrl)
      ? catalogueUrl
      : `https://${catalogueUrl}`
    : '';
  const supplier = node?.supplier ?? null;
  const phoneDigits = supplier?.phone ? sanitizeMobileInput(supplier.phone) : '';
  const waUrl = buildWhatsAppUrl(phoneDigits);

  return (
    <Drawer
      isOpen={!!node}
      onClose={onClose}
      title={node?.name ?? 'Product'}
    >
      {node && (
        <div className="flex flex-col max-w-lg mx-auto w-full">
          {path.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground mb-2 flex flex-wrap items-center gap-1">
              {path.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="opacity-50">/</span>}
                  <span>{p}</span>
                </span>
              ))}
            </p>
          )}

          {node.tags?.length ? <TagBadges tags={node.tags} className="mb-3" /> : null}

          {/* Rate tiers */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
            <div className="px-4 py-2.5 border-b border-border bg-muted/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {node.prices.length > 1 ? 'Prices' : 'Price'}
              </span>
            </div>
            {node.prices.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                No price set yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {node.prices.map((p) => (
                  <li
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {p.label}
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {formatPrice(p)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-border bg-card px-4 py-1 mb-4">
            {size && <Row label="Size">{size}</Row>}
            {node.unit && <Row label="Default Unit">{node.unit}</Row>}
            {!size && !node.unit && (
              <p className="py-3 text-sm text-muted-foreground">
                No additional details.
              </p>
            )}
          </div>

          {/* Catalogue / designs link */}
          {catalogueHref && (
            <a
              href={catalogueHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 mb-4 hover:bg-muted/50 transition-colors min-tap"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Catalogue / designs</span>
                <span className="block text-xs text-muted-foreground truncate">{catalogueUrl}</span>
              </span>
              <svg className="w-4 h-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}

          {/* Sourcing / supplier */}
          {supplier && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-border bg-muted/40">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sourced from
                </span>
              </div>
              <div className="px-4 py-1">
                <Row label="Supplier">{supplier.name}</Row>
                {supplier.location && (
                  <Row label="Location">{supplier.location}</Row>
                )}
                {supplier.contact_name && (
                  <Row label="Contact">{supplier.contact_name}</Row>
                )}
                {supplier.phone && (
                  <div className="flex flex-col gap-0.5 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Phone
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={`tel:${supplier.phone}`}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted text-sm font-semibold text-foreground hover:bg-muted/70 transition-colors min-tap"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {supplier.phone}
                      </a>
                      {isValidIndianMobile(phoneDigits) && waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors min-tap"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.042z"/></svg>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {supplier.notes && <Row label="Notes">{supplier.notes}</Row>}
              </div>
            </div>
          )}

          {onEdit && (
            <Button
              variant="secondary"
              className="w-full mb-2"
              onClick={() => onEdit(node)}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              Edit Product
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
