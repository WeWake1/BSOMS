import jsPDF from 'jspdf';
import type { OrderWithCategory } from '@/types/database';
import { formatDate, formatInches } from './utils';

// A4 portrait sticker grid — 2 columns × 10 rows = 20 fixed-size cards per sheet.
// Card height is fixed at exactly 25mm; the vertical gutter is derived so the
// 10 rows distribute evenly down the usable page height.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
const COLS = 2;
const ROWS = 10;
const GUTTER_X = 6;
const CARD_H = 25; // exact, per requirement
const CARD_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GUTTER_X) / COLS; // 94mm
const GUTTER_Y = (PAGE_H - 2 * MARGIN - ROWS * CARD_H) / (ROWS - 1); // ~3.4mm
const PER_PAGE = COLS * ROWS;

// Defensive ceiling so a stray large quantity can't freeze the browser.
const MAX_CARDS = 2000;

/** First line that fits `w`, with an ellipsis if the text overflows. */
function clampLine(doc: jsPDF, text: string, w: number): string {
  const lines = doc.splitTextToSize(text, w) as string[];
  if (lines.length <= 1) return lines[0] ?? '';
  return lines[0].replace(/\s*\S*$/, '') + '…';
}

function drawCard(doc: jsPDF, order: OrderWithCategory, x: number, y: number) {
  const pad = 3;
  const left = x + pad;
  const right = x + CARD_W - pad;
  const innerW = CARD_W - pad * 2;

  // Card border
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'S');

  // ── Row A: Order No (left) + created Date (right) ──
  let cy = y + pad + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39); // near-black
  doc.text(order.order_no, left, cy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(formatDate(order.date), right, cy, { align: 'right' });

  // ── Row B: Customer name ──
  cy += 4.4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(clampLine(doc, order.customer_name, innerW), left, cy);

  // ── Row C: Category · Dimensions (more prominent) ──
  cy += 4.0;
  const dims = (order.length || order.width)
    ? `${formatInches(order.length)} × ${formatInches(order.width)}`
    : '';
  const cat = order.categories?.name || 'Uncategorized';
  const metaLine = dims ? `${cat}  ·  ${dims}` : cat;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81); // gray-700
  doc.text(clampLine(doc, metaLine, innerW), left, cy);

  // ── Row D: Description (fills remaining space) ──
  if (order.description) {
    cy += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99); // gray-600
    const bottomLimit = y + CARD_H - pad + 1;
    const lineH = 3.0;
    const maxLines = Math.max(0, Math.floor((bottomLimit - cy) / lineH));
    if (maxLines > 0) {
      const descLines = doc.splitTextToSize(order.description, innerW) as string[];
      const shown = descLines.slice(0, maxLines);
      if (descLines.length > maxLines && shown.length > 0) {
        shown[shown.length - 1] = shown[shown.length - 1].replace(/\s*\S*$/, '') + '…';
      }
      shown.forEach((line, i) => doc.text(line, left, cy + i * lineH));
    }
  }
}

/**
 * Generate a sheet of order "stickers" — fixed-size cards, 20 per A4 page,
 * meant to be printed on sticker paper and stuck on the order's door.
 * One card is emitted per unit of quantity (qty 3 → 3 identical cards).
 * @param action 'download' saves the file; 'view' opens a preview tab.
 */
export function generateStickerPDF(
  orders: OrderWithCategory[],
  action: 'download' | 'view' = 'download'
) {
  // Expand each order into one card per unit of quantity.
  const cards: OrderWithCategory[] = [];
  for (const o of orders) {
    const count = Math.max(1, Math.floor(o.qty || 1));
    for (let k = 0; k < count && cards.length < MAX_CARDS; k++) cards.push(o);
    if (cards.length >= MAX_CARDS) break;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  cards.forEach((order, i) => {
    const slot = i % PER_PAGE;
    if (i > 0 && slot === 0) doc.addPage();
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * (CARD_W + GUTTER_X);
    const y = MARGIN + row * (CARD_H + GUTTER_Y);
    drawCard(doc, order, x, y);
  });

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  const single = orders.length === 1;
  const filename = single
    ? `sticker-${orders[0].order_no}.pdf`
    : `order-stickers-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
