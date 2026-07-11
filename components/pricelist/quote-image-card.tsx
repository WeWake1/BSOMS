import { forwardRef } from 'react';
import { formatSize } from '@/lib/pricelist-utils';
import { BUSINESS_NAME, lineAmount, type QuoteLine, type QuoteMeta } from '@/lib/quote-export';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rupees = (n: number) => `₹${inr.format(n)}`;

function prettyDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface QuoteImageCardProps {
  lines: QuoteLine[];
  meta: QuoteMeta;
  total: number;
}

/**
 * Light-themed, WhatsApp-friendly quote card. Uses inline styles so the
 * html-to-image capture looks identical regardless of app theme.
 */
export const QuoteImageCard = forwardRef<HTMLDivElement, QuoteImageCardProps>(
  ({ lines, meta, total }, ref) => {
    const hasOnRequest = lines.some((l) => !l.price);
    return (
      <div
        ref={ref}
        style={{
          width: 520,
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: 32,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #10b981', paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{BUSINESS_NAME}</div>
            <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quotation</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
            <div>{prettyDate(meta.date)}</div>
            {meta.validUntil && <div style={{ marginTop: 2 }}>Valid until {prettyDate(meta.validUntil)}</div>}
          </div>
        </div>

        {/* Client */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prepared for</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>{meta.clientName || '—'}</div>
          {meta.clientPhone && <div style={{ fontSize: 13, color: '#64748b', marginTop: 1 }}>{meta.clientPhone}</div>}
        </div>

        {/* Items */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <div style={{ flex: 1 }}>Product</div>
            <div style={{ width: 60, textAlign: 'center' }}>Qty</div>
            <div style={{ width: 90, textAlign: 'right' }}>Amount</div>
          </div>
          {lines.map((l, i) => {
            const amt = lineAmount(l);
            const size = formatSize(l.node);
            return (
              <div key={l.node.id} style={{ display: 'flex', padding: '11px 14px', borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{l.node.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {l.path.join(' / ')}
                    {size ? `${l.path.length ? ' · ' : ''}${size}` : ''}
                  </div>
                  {l.price && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                      {rupees(l.price.rate)}{l.price.unit ? ` / ${l.price.unit}` : ''}
                      {l.price.label && l.price.label !== 'Standard' ? ` · ${l.price.label}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ width: 60, textAlign: 'center', fontSize: 14, color: '#475569' }}>{l.qty}</div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                  {amt != null ? rupees(amt) : <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>On request</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{rupees(total)}</div>
        </div>
        {hasOnRequest && (
          <div style={{ textAlign: 'right', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            Total excludes items marked “On request”.
          </div>
        )}

        {meta.note.trim() && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: 12 }}>
            <span style={{ fontWeight: 700 }}>Note: </span>{meta.note.trim()}
          </div>
        )}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 10, color: '#cbd5e1' }}>
          Generated by {BUSINESS_NAME} · {prettyDate(meta.date)}
        </div>
      </div>
    );
  }
);
QuoteImageCard.displayName = 'QuoteImageCard';
