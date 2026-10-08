import jsPDF, { GState } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { formatRupees } from './pricelist-utils';
import { BUSINESS_NAME, loadWatermark, prettyDate, rs, type QuoteMeta } from './quote-export';
import type { PricelistNodeWithRelations } from '@/types/database';

/** One tier as it goes out to the customer — the final (marked-up) rate. */
export interface SharedTier {
  id: string;
  label: string;
  rate: number;
  unit: string | null;
}

/** One product on a shared price list. Empty `tiers` = price on request. */
export interface SharedProduct {
  node: PricelistNodeWithRelations;
  path: string[];
  tiers: SharedTier[];
}

/** Same customer fields as a quote. */
export type PricelistShareMeta = QuoteMeta;

/** Tier label for customers — the placeholder "Standard" says nothing. */
export function tierLabel(t: SharedTier): string {
  return t.label === 'Standard' ? '' : t.label;
}

/** "₹54 per sq.ft." / "₹2,400 / box" — avoids "₹2,400 / per sheet". */
export function formatRateUnit(
  rate: number,
  unit: string | null,
  money: (n: number) => string = formatRupees
): string {
  const base = money(rate);
  if (!unit) return base;
  return /^per\b/i.test(unit.trim()) ? `${base} ${unit.trim()}` : `${base} / ${unit.trim()}`;
}

/**
 * Plain-text price list for a WhatsApp message (WhatsApp renders *bold*
 * and _italic_). Pre-filled via wa.me, so keep it compact.
 */
export function buildPricelistText(items: SharedProduct[], meta: PricelistShareMeta): string {
  const out: string[] = [`*${BUSINESS_NAME} — Price List*`];
  if (meta.clientName.trim()) out.push(`For: ${meta.clientName.trim()}`);
  out.push(`Date: ${prettyDate(meta.date)}`);

  for (const item of items) {
    out.push('', `*${item.node.name}*`);
    if (item.path.length) out.push(`_${item.path.join(' / ')}_`);
    if (item.tiers.length === 0) {
      out.push('• Price on request');
      continue;
    }
    for (const t of item.tiers) {
      const label = tierLabel(t);
      out.push(`• ${label ? `${label}: ` : ''}${formatRateUnit(t.rate, t.unit)}`);
    }
  }

  if (meta.validUntil || meta.note.trim()) out.push('');
  if (meta.validUntil) out.push(`Prices valid until ${prettyDate(meta.validUntil)}`);
  if (meta.note.trim()) out.push(`Note: ${meta.note.trim()}`);
  return out.join('\n');
}

export async function generatePricelistPDF(
  items: SharedProduct[],
  meta: PricelistShareMeta,
  action: 'download' | 'view' = 'download'
) {
  const watermark = await loadWatermark('/watermark logo.png');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // ── Header ──────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(BUSINESS_NAME, 14, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('Price List', 14, 27);
  doc.setTextColor(0);

  doc.setFontSize(10);
  doc.text(`Date: ${prettyDate(meta.date)}`, pageWidth - 14, 20, { align: 'right' });
  if (meta.validUntil) {
    doc.text(`Valid until: ${prettyDate(meta.validUntil)}`, pageWidth - 14, 26, { align: 'right' });
  }

  // ── Customer block ──────────────────────────────────────────────
  let y = 38;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('PREPARED FOR', 14, y);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  y += 6;
  doc.text(meta.clientName || '—', 14, y);
  if (meta.clientPhone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 5;
    doc.text(meta.clientPhone, 14, y);
  }

  // ── Products table — one row per tier, product cell spans its tiers ──
  const body: RowInput[] = [];
  items.forEach((item, i) => {
    const productCell = item.path.length
      ? `${item.node.name}\n${item.path.join(' / ')}`
      : item.node.name;
    if (item.tiers.length === 0) {
      body.push([String(i + 1), productCell, '—', 'On request']);
      return;
    }
    item.tiers.forEach((t, ti) => {
      const cells: RowInput = [];
      if (ti === 0) {
        cells.push(
          { content: String(i + 1), rowSpan: item.tiers.length },
          { content: productCell, rowSpan: item.tiers.length }
        );
      }
      cells.push(tierLabel(t) || '—', formatRateUnit(t.rate, t.unit, rs));
      body.push(cells);
    });
  });

  autoTable(doc, {
    startY: y + 6,
    head: [['#', 'Product', 'Size / Type', 'Rate']],
    body,
    theme: 'grid',
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40 },
      3: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(
        `${BUSINESS_NAME} · Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
      doc.setTextColor(0);
    },
  });

  // ── Note ────────────────────────────────────────────────────────
  if (meta.note.trim()) {
    const finalY = (doc as any).lastAutoTable.finalY as number;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Note: ${meta.note.trim()}`, 14, finalY + 10, { maxWidth: pageWidth - 28 });
    doc.setTextColor(0);
  }

  // ── Watermark on every page ─────────────────────────────────────
  if (watermark) {
    const wmWidth = 130;
    const wmHeight = wmWidth / watermark.aspectRatio;
    const wmX = (pageWidth - wmWidth) / 2;
    const wmY = (pageHeight - wmHeight) / 2;
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setGState(new GState({ opacity: 0.07 }));
      doc.addImage(watermark.data, 'PNG', wmX, wmY, wmWidth, wmHeight);
      doc.setGState(new GState({ opacity: 1 }));
    }
  }

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  const safeClient = (meta.clientName || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`pricelist-${safeClient}-${meta.date}.pdf`);
}
