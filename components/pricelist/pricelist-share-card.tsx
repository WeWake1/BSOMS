import { forwardRef } from 'react';
import { BUSINESS_NAME, prettyDate } from '@/lib/quote-export';
import {
  formatRateUnit,
  tierLabel,
  type PricelistShareMeta,
  type SharedProduct,
} from '@/lib/pricelist-share-export';

interface PricelistShareCardProps {
  items: SharedProduct[];
  meta: PricelistShareMeta;
}

/**
 * Light-themed, WhatsApp-friendly price list card. Inline styles (like the
 * quote card) so the html-to-image capture is identical in any app theme.
 */
export const PricelistShareCard = forwardRef<HTMLDivElement, PricelistShareCardProps>(
  ({ items, meta }, ref) => (
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
          <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price List</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
          <div>{prettyDate(meta.date)}</div>
          {meta.validUntil && <div style={{ marginTop: 2 }}>Valid until {prettyDate(meta.validUntil)}</div>}
        </div>
      </div>

      {/* Customer */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prepared for</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>{meta.clientName || '—'}</div>
        {meta.clientPhone && <div style={{ fontSize: 13, color: '#64748b', marginTop: 1 }}>{meta.clientPhone}</div>}
      </div>

      {/* Products */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <div key={item.node.id} style={{ padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.node.name}</div>
            {item.path.length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.path.join(' / ')}</div>
            )}
            <div style={{ marginTop: 6 }}>
              {item.tiers.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Price on request</div>
              ) : (
                item.tiers.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 13 }}>
                    <span style={{ color: '#475569' }}>{tierLabel(t) || 'Price'}</span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRateUnit(t.rate, t.unit)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {meta.note.trim() && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: 12 }}>
          <span style={{ fontWeight: 700 }}>Note: </span>{meta.note.trim()}
        </div>
      )}

      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 10, color: '#cbd5e1' }}>
        {BUSINESS_NAME} · {prettyDate(meta.date)}
      </div>
    </div>
  )
);
PricelistShareCard.displayName = 'PricelistShareCard';
