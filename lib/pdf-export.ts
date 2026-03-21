import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OrderWithCategory } from '@/types/database';
import { formatDate } from './utils';

export function generateOrderReportPDF(orders: OrderWithCategory[]) {
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

  // Map orders to autoTable rows
  const tableData = orders.map(o => [
    o.order_no,
    o.customer_name,
    o.categories?.name || 'Uncategorized',
    o.status,
    formatDate(o.date),
    formatDate(o.due_date),
    formatDate(o.dispatch_date),
    o.qty.toString(),
    o.description || '',
  ]);

  // Generate Table
  autoTable(doc, {
    startY: 30,
    head: [['Order No', 'Customer Name', 'Category', 'Status', 'Date', 'Due Date', 'Dispatch', 'Qty', 'Description']],
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
      0: { cellWidth: 25 }, // Order No
      1: { cellWidth: 40 }, // Customer
      2: { cellWidth: 25 }, // Category
      3: { cellWidth: 25 }, // Status
      4: { cellWidth: 22 }, // Date
      5: { cellWidth: 22 }, // Due Date
      6: { cellWidth: 22 }, // Dispatch
      7: { cellWidth: 15, halign: 'center' }, // Qty
      8: { cellWidth: 'auto' }, // Description (takes remaining space)
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

  // Save the PDF
  const filename = `order-report-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
