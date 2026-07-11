import jsPDF, { GState } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OrderWithCategory } from '@/types/database';
import { formatDate, formatInches } from './utils';

async function loadWatermark(url: string): Promise<{ data: string; aspectRatio: number }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  const img = new Image();
  await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = data; });
  return { data, aspectRatio: img.naturalWidth / img.naturalHeight };
}

export async function generateOrderReportPDF(
  orders: OrderWithCategory[],
  action: 'download' | 'view' = 'download'
) {
  const watermark = await loadWatermark('/watermark logo.png');

  // Create jsPDF instance in landscape mode
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  
  // Header: Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('OrderFlow — Order Report', 14, 22);

  // Header: Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateStr = `Exported: ${new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })}`;
  doc.text(dateStr, pageWidth - 14, 22, { align: 'right' });

  // Column order: Date | Category | Dimensions | Description | Qty | Order & Customer | Status | Due Date | Dispatch
  const tableData = orders.map(o => {
    const dims = (o.length || o.width)
      ? `${formatInches(o.length)} × ${formatInches(o.width)}`
      : '—';
    return [
      formatDate(o.date),
      o.categories?.name || 'Uncategorized',
      dims,
      o.description || '',
      o.qty.toString(),
      `${o.order_no} – ${o.customer_name}`,
      o.status,
      formatDate(o.due_date),
      formatDate(o.dispatch_date),
    ];
  });

  // Status → printable color mapping [bg RGB, text RGB]
  const STATUS_COLORS: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
    'Pending':     { fill: [254, 243, 199], text: [146,  64,  14] }, // amber-100 / amber-800
    'In Progress': { fill: [219, 234, 254], text: [ 30,  64, 175] }, // blue-100  / blue-800
    'Packing':     { fill: [237, 233, 254], text: [ 91,  33, 182] }, // violet-100/ violet-800
    'Dispatched':  { fill: [220, 252, 231], text: [ 22, 101,  52] }, // green-100 / green-800
  };

  // Generate Table
  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Category', 'Dimensions', 'Description', 'Qty', 'Order No & Customer Name', 'Status', 'Due Date', 'Dispatch']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 25 }, // Category
      2: { cellWidth: 30 }, // Dimensions
      3: { cellWidth: 'auto' }, // Description (takes remaining space)
      4: { cellWidth: 12, halign: 'center' }, // Qty
      5: { cellWidth: 50 }, // Order & Customer
      6: { cellWidth: 25, fontStyle: 'bold' }, // Status
      7: { cellWidth: 22 }, // Due Date
      8: { cellWidth: 22, halign: 'center' }, // Dispatch
    },
    // Color-code the Status column (index 6) per row
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const statusText = String(data.cell.raw || '');
        const colors = STATUS_COLORS[statusText];
        if (colors) {
          data.cell.styles.fillColor = colors.fill;
          data.cell.styles.textColor = colors.text;
        }
      }
    },
    // Footer: Page Numbers
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    },
  });

  // Stamp watermark on every page (centered, low opacity, behind nothing — added last)
  const pageHeight = doc.internal.pageSize.height;
  const wmWidth = 220;
  const wmHeight = wmWidth / watermark.aspectRatio;
  const wmX = (pageWidth - wmWidth) / 2;
  const wmY = (pageHeight - wmHeight) / 2;
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setGState(new GState({ opacity: 0.1 }));
    doc.addImage(watermark.data, 'PNG', wmX, wmY, wmWidth, wmHeight);
    doc.setGState(new GState({ opacity: 1 }));
  }

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  // Save the PDF
  const filename = `order-report-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
