import jsPDF, { GState } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatSize } from './pricelist-utils';
import type { PricelistNodeWithRelations, PricelistPrice } from '@/types/database';

// Customer-facing business name on the quotation. Change here if it differs.
export const BUSINESS_NAME = 'Bhakti Sales';

export interface QuoteLine {
  node: PricelistNodeWithRelations;
  path: string[];
  price: PricelistPrice | null; // chosen rate tier (null = on request)
  qty: number;
}

export interface QuoteMeta {
  clientName: string;
  clientPhone: string;
  date: string; // ISO yyyy-mm-dd
  validUntil: string; // ISO or ''
  note: string;
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
/** PDF-safe rupee formatting — the ₹ glyph isn't in jsPDF's core fonts. */
const rs = (n: number) => `Rs ${inr.format(n)}`;

export function lineAmount(line: QuoteLine): number | null {
  if (!line.price) return null;
  return line.price.rate * line.qty;
}

export function quoteTotal(lines: QuoteLine[]): number {
  return lines.reduce((sum, l) => sum + (lineAmount(l) ?? 0), 0);
}

function prettyDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function loadWatermark(url: string): Promise<{ data: string; aspectRatio: number } | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = data;
    });
    return { data, aspectRatio: img.naturalWidth / img.naturalHeight };
  } catch {
    return null;
  }
}

export async function generateQuotePDF(
  lines: QuoteLine[],
  meta: QuoteMeta,
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
  doc.text('Quotation', 14, 27);
  doc.setTextColor(0);

  doc.setFontSize(10);
  doc.text(`Date: ${prettyDate(meta.date)}`, pageWidth - 14, 20, { align: 'right' });
  if (meta.validUntil) {
    doc.text(`Valid until: ${prettyDate(meta.validUntil)}`, pageWidth - 14, 26, { align: 'right' });
  }

  // ── Client block ────────────────────────────────────────────────
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

  // ── Items table ─────────────────────────────────────────────────
  const body = lines.map((l, i) => {
    const amt = lineAmount(l);
    const productCell = l.path.length
      ? `${l.node.name}\n${l.path.join(' / ')}`
      : l.node.name;
    return [
      String(i + 1),
      productCell,
      formatSize(l.node) || '—',
      l.price ? rs(l.price.rate) : 'On request',
      String(l.qty),
      amt != null ? rs(amt) : '—',
    ];
  });

  autoTable(doc, {
    startY: y + 6,
    head: [['#', 'Product', 'Size', 'Rate', 'Qty', 'Amount']],
    body,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 28 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // De-emphasise the breadcrumb second line in the product cell.
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontSize = 9;
      }
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

  // ── Total ───────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY as number;
  const total = quoteTotal(lines);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', pageWidth - 60, finalY + 10);
  doc.text(rs(total), pageWidth - 14, finalY + 10, { align: 'right' });

  const hasOnRequest = lines.some((l) => !l.price);
  if (hasOnRequest) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('Total excludes items marked “On request”.', pageWidth - 14, finalY + 16, { align: 'right' });
    doc.setTextColor(0);
  }

  // ── Note ────────────────────────────────────────────────────────
  if (meta.note.trim()) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Note: ${meta.note.trim()}`, 14, finalY + (hasOnRequest ? 24 : 18), {
      maxWidth: pageWidth - 28,
    });
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
  doc.save(`quote-${safeClient}-${meta.date}.pdf`);
}
