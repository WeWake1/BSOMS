import jsPDF from 'jspdf';
import type { OrderWithCategory } from '@/types/database';
import { formatDate, formatInches } from './utils';

// Status → printable color mapping [bg RGB, text RGB]
const STATUS_COLORS: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
  'Pending':     { fill: [254, 243, 199], text: [146,  64,  14] }, // amber-100 / amber-800
  'In Progress': { fill: [219, 234, 254], text: [ 30,  64, 175] }, // blue-100  / blue-800
  'Packing':     { fill: [237, 233, 254], text: [ 91,  33, 182] }, // violet-100/ violet-800
  'Dispatched':  { fill: [220, 252, 231], text: [ 22, 101,  52] }, // green-100 / green-800
};

// A4 portrait sticker grid — 2 columns × 5 rows = 10 fixed-size cards per sheet.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
const COLS = 2;
const ROWS = 5;
const GUTTER_X = 6;
const GUTTER_Y = 5;
const CARD_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GUTTER_X) / COLS; // 94mm
const CARD_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GUTTER_Y) / ROWS; // ~52mm
const PER_PAGE = COLS * ROWS;

function drawCard(doc: jsPDF, order: OrderWithCategory, x: number, y: number) {
  const pad = 5;
  const status = STATUS_COLORS[order.status] ?? { fill: [229, 231, 235], text: [55, 65, 81] };

  // Card border
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2.5, 2.5, 'S');

  const innerW = CARD_W - pad * 2;
  let cy = y + pad + 3;

  // ── Header: Order No (left) + Status pill (right) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39); // near-black
  doc.text(order.order_no, x + pad, cy);

  // Status pill, right-aligned
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  const pillText = order.status.toUpperCase();
  const pillTextW = doc.getTextWidth(pillText);
  const pillW = pillTextW + 6;
  const pillH = 5;
  const pillX = x + CARD_W - pad - pillW;
  const pillY = cy - 3.6;
  doc.setFillColor(status.fill[0], status.fill[1], status.fill[2]);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2.5, 2.5, 'F');
  doc.setTextColor(status.text[0], status.text[1], status.text[2]);
  doc.text(pillText, pillX + 3, pillY + 3.5);

  cy += 6;

  // ── Customer name ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(31, 41, 55);
  const custLines = doc.splitTextToSize(order.customer_name, innerW);
  doc.text(custLines[0], x + pad, cy);
  cy += 4.5;

  // ── Category ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(order.categories?.name || 'Uncategorized', x + pad, cy);
  cy += 5;

  // ── Meta row: Due | Qty | Dimensions ──
  const dims = (order.length || order.width)
    ? `${formatInches(order.length)} × ${formatInches(order.width)}`
    : '—';
  const metaLabel = (label: string, value: string, mx: number, mw: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(label.toUpperCase(), mx, cy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text(doc.splitTextToSize(value, mw)[0], mx, cy + 3.8);
  };
  const colW = innerW / 3;
  metaLabel('Due', formatDate(order.due_date), x + pad, colW - 2);
  metaLabel('Qty', String(order.qty), x + pad + colW, colW - 2);
  metaLabel('Size', dims, x + pad + colW * 2, colW - 2);
  cy += 8;

  // ── Description (fills remaining space) ──
  if (order.description) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(x + pad, cy - 1.5, x + CARD_W - pad, cy - 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99); // gray-600
    const bottomLimit = y + CARD_H - pad;
    const lineH = 3.4;
    const maxLines = Math.max(0, Math.floor((bottomLimit - cy) / lineH));
    const descLines = doc.splitTextToSize(order.description, innerW) as string[];
    const shown = descLines.slice(0, maxLines);
    if (descLines.length > maxLines && shown.length > 0) {
      shown[shown.length - 1] = shown[shown.length - 1].replace(/\s*\S*$/, '') + '…';
    }
    shown.forEach((line, i) => doc.text(line, x + pad, cy + 1.5 + i * lineH));
  }
}

/**
 * Generate a sheet of order "stickers" — fixed-size cards, 10 per A4 page,
 * meant to be printed on sticker paper and stuck on the order's door.
 * @param action 'download' saves the file; 'view' opens a preview tab.
 */
export function generateStickerPDF(
  orders: OrderWithCategory[],
  action: 'download' | 'view' = 'download'
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  orders.forEach((order, i) => {
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
