/**
 * Server-side PDF generation for email attachments.
 * Uses jspdf without image embedding (no canvas in Node).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TERRACOTA = '#D35230';
const NAVY = '#1A1A2E';
const BODY_COLOR = '#4A4A6A';
const GRAY = '#888888';
const LAVANDA = '#F5F5FA';

const PAGE_MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function hexToRGB(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return PAGE_MARGIN + 5;
  }
  return y;
}

function sectionHeader(doc: jsPDF, y: number, label: string): number {
  y = ensureSpace(doc, y, 14);
  doc.setFillColor(...hexToRGB(TERRACOTA));
  doc.rect(PAGE_MARGIN, y, 3, 8, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRGB(NAVY));
  doc.text(label, PAGE_MARGIN + 6, y + 6);
  return y + 12;
}

function bodyText(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRGB(BODY_COLOR));
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  for (const line of lines) {
    y = ensureSpace(doc, y, 6);
    doc.text(line, PAGE_MARGIN, y);
    y += 5;
  }
  return y + 2;
}

function bulletList(doc: jsPDF, y: number, items: string[], color = TERRACOTA): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRGB(BODY_COLOR));
  for (const item of items) {
    y = ensureSpace(doc, y, 6);
    doc.setFillColor(...hexToRGB(color));
    doc.circle(PAGE_MARGIN + 2, y - 1.2, 1, 'F');
    const wrapped = doc.splitTextToSize(item, CONTENT_WIDTH - 8);
    for (const line of wrapped) {
      doc.text(line, PAGE_MARGIN + 6, y);
      y += 5;
    }
  }
  return y + 2;
}

export async function generatePDFBuffer(resultJson: Record<string, unknown>): Promise<Buffer> {
  const analysis = resultJson.analysis as Record<string, unknown> | undefined;
  const meta = resultJson.meta as Record<string, unknown> | undefined;
  if (!analysis) throw new Error('No analysis data');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = PAGE_MARGIN;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRGB(NAVY));
  doc.text('BLACK BOX MAGIC', PAGE_MARGIN, y + 6);
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRGB(TERRACOTA));
  doc.text('Reporte de Analisis', PAGE_MARGIN, y + 4);
  y += 8;
  doc.setDrawColor(...hexToRGB(TERRACOTA));
  doc.setLineWidth(0.8);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 8;

  // Date + meta
  doc.setFontSize(8);
  doc.setTextColor(...hexToRGB(GRAY));
  const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Fecha: ${dateStr}  |  Modelo: ${meta?.model || '—'}`, PAGE_MARGIN, y);
  y += 8;

  // Summary
  y = sectionHeader(doc, y, 'Resumen');
  y = bodyText(doc, y, (analysis.summary as string) || 'Sin resumen disponible.');

  // Inventory
  const inv = analysis.inventory as { items?: Array<{ name: string; brand?: string; category?: string; quantity?: string | number; location?: string }>; total_skus_detected?: number } | undefined;
  if (inv?.items?.length) {
    y = sectionHeader(doc, y, 'Inventario');
    doc.setFontSize(9);
    doc.setTextColor(...hexToRGB(BODY_COLOR));
    doc.text(`Total SKUs: ${inv.total_skus_detected}`, PAGE_MARGIN, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Producto', 'Marca', 'Cantidad']],
      body: inv.items.map(i => [i.name, i.brand ?? '—', String(i.quantity ?? '—')]),
      headStyles: { fillColor: hexToRGB(TERRACOTA), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: hexToRGB(BODY_COLOR), fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRGB(LAVANDA) },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;
  }

  // Pricing
  const pricing = analysis.pricing as { prices_found?: Array<{ item: string; price: number; currency?: string; type?: string }> } | undefined;
  if (pricing?.prices_found?.length) {
    y = sectionHeader(doc, y, 'Precios Detectados');
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Producto', 'Precio', 'Tipo']],
      body: pricing.prices_found.map(p => [p.item, `${p.currency || '$'}${p.price}`, p.type ?? '—']),
      headStyles: { fillColor: hexToRGB(TERRACOTA), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: hexToRGB(BODY_COLOR), fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRGB(LAVANDA) },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;
  }

  // Recommendations
  const insights = analysis.insights as { recommendations?: string[]; strengths?: string[]; opportunities?: string[] } | undefined;
  if (insights?.recommendations?.length) {
    y = sectionHeader(doc, y, 'Recomendaciones');
    y = bulletList(doc, y, insights.recommendations, NAVY);
  }
  if (insights?.strengths?.length) {
    y = sectionHeader(doc, y, 'Fortalezas');
    y = bulletList(doc, y, insights.strengths, '#2D8B4E');
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...hexToRGB(GRAY));
    const footerY = doc.internal.pageSize.getHeight() - 12;
    doc.setDrawColor(...hexToRGB(GRAY));
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, footerY, PAGE_WIDTH - PAGE_MARGIN, footerY);
    doc.text('Generado por Black Box Magic | bbm.integrador.pro | ventas@integrador.pro', PAGE_MARGIN, footerY + 5);
    doc.text(`Pagina ${i} / ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, footerY + 5, { align: 'right' });
  }

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
