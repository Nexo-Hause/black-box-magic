import type { AnalysisResponse } from '@/types/analysis';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------
const TERRACOTA = '#D35230';
const NAVY = '#1A1A2E';
const BODY_COLOR = '#4A4A6A';
const GRAY = '#888888';
const LAVANDA = '#F5F5FA';
const FOOTER_TEXT = 'Generado por Black Box Magic | bbm.integrador.pro';

const PAGE_MARGIN = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Add footer to every page */
function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...hexToRGB(GRAY));
    doc.setFont('helvetica', 'normal');

    // Separator line
    const footerY = doc.internal.pageSize.getHeight() - 12;
    doc.setDrawColor(...hexToRGB(GRAY));
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, footerY, PAGE_WIDTH - PAGE_MARGIN, footerY);

    // Footer text
    doc.text(FOOTER_TEXT, PAGE_MARGIN, footerY + 5);
    doc.text(
      `Pagina ${i} / ${pageCount}`,
      PAGE_WIDTH - PAGE_MARGIN,
      footerY + 5,
      { align: 'right' },
    );
  }
}

/** Check remaining space and add page if needed. Returns current Y. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const maxY = doc.internal.pageSize.getHeight() - 20;
  if (y + needed > maxY) {
    doc.addPage();
    return PAGE_MARGIN + 5;
  }
  return y;
}

/** Draw a section header with terracota background badge + navy title */
function sectionHeader(doc: jsPDF, y: number, label: string): number {
  y = ensureSpace(doc, y, 14);

  // Terracota accent bar
  doc.setFillColor(...hexToRGB(TERRACOTA));
  doc.rect(PAGE_MARGIN, y, 3, 8, 'F');

  // Title text
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRGB(NAVY));
  doc.text(label, PAGE_MARGIN + 6, y + 6);

  return y + 12;
}

/** Draw body text with automatic line wrapping */
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

/** Draw a bullet list */
function bulletList(doc: jsPDF, y: number, items: string[], bulletColor = TERRACOTA): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRGB(BODY_COLOR));

  for (const item of items) {
    y = ensureSpace(doc, y, 6);
    // Bullet dot
    doc.setFillColor(...hexToRGB(bulletColor));
    doc.circle(PAGE_MARGIN + 2, y - 1.2, 1, 'F');

    const wrapped = doc.splitTextToSize(item, CONTENT_WIDTH - 8);
    for (const line of wrapped) {
      doc.text(line, PAGE_MARGIN + 6, y);
      y += 5;
    }
  }
  return y + 2;
}

/** Draw a small badge (inline label) */
function badge(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  bgColor: string,
  textColor = '#FFFFFF',
): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const textWidth = doc.getTextWidth(text);
  const padding = 3;
  const badgeWidth = textWidth + padding * 2;
  const badgeHeight = 6;

  doc.setFillColor(...hexToRGB(bgColor));
  doc.roundedRect(x, y, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
  doc.setTextColor(...hexToRGB(textColor));
  doc.text(text, x + padding, y + 4.2);

  return x + badgeWidth + 4; // return next x position
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Convert image URL to JPEG base64 (max 1200px, quality 0.7) */
async function imageToJpegBase64(url: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load'));
      el.src = url;
    });

    const MAX_DIM = 1200;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX_DIM || h > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

export function generatePDF(
  response: AnalysisResponse,
  imageUrl: string,
  fileName: string,
): void {
  // Start async to allow image loading, then generate
  void (async () => {
    const photoBase64 = await imageToJpegBase64(imageUrl);
    _generatePDFSync(response, photoBase64, fileName);
  })();
}

function _generatePDFSync(
  response: AnalysisResponse,
  photoBase64: string | null,
  fileName: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const a = response.analysis;
  let y = PAGE_MARGIN;

  // ------ Title ------
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

  // Terracota separator
  doc.setDrawColor(...hexToRGB(TERRACOTA));
  doc.setLineWidth(0.8);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 6;

  // ------ Photo ------
  if (photoBase64) {
    const imgMaxW = CONTENT_WIDTH;
    const imgMaxH = 80;
    try {
      doc.addImage(photoBase64, 'JPEG', PAGE_MARGIN, y, imgMaxW, imgMaxH);
      y += imgMaxH + 4;
    } catch {
      // Skip photo if embedding fails
    }
  }

  // ------ Badges line ------
  let bx = PAGE_MARGIN;
  if (a.photo_type) {
    bx = badge(doc, bx, y, a.photo_type.toUpperCase(), NAVY);
  }
  if (a.severity) {
    const sevColor = a.severity.toLowerCase() === 'critical' ? '#C62828' : TERRACOTA;
    bx = badge(doc, bx, y, `Severidad: ${a.severity}`, sevColor);
  }
  if (a.compliance?.score) {
    bx = badge(doc, bx, y, `Cumplimiento: ${a.compliance.score}`, '#2D8B4E');
  }
  if (bx > PAGE_MARGIN) y += 10;

  // ------ Date / meta line ------
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRGB(GRAY));
  const dateStr = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Fecha: ${dateStr}  |  Modelo: ${response.meta.model}`, PAGE_MARGIN, y);
  y += 6;

  // ------ Resumen ------
  y = sectionHeader(doc, y, 'Resumen');
  y = bodyText(doc, y, a.summary);

  // ------ Inventario ------
  if (a.inventory?.items?.length) {
    y = sectionHeader(doc, y, 'Inventario');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRGB(BODY_COLOR));
    doc.text(`Total SKUs detectados: ${a.inventory.total_skus_detected}`, PAGE_MARGIN, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Producto', 'Marca', 'Categoria', 'Cantidad', 'Ubicacion']],
      body: a.inventory.items.map(item => [
        item.name,
        item.brand ?? '-',
        item.category ?? '-',
        String(item.quantity),
        item.location ?? '-',
      ]),
      headStyles: {
        fillColor: hexToRGB(TERRACOTA),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
      },
      bodyStyles: {
        textColor: hexToRGB(BODY_COLOR),
        fontSize: 8,
        font: 'helvetica',
      },
      alternateRowStyles: { fillColor: hexToRGB(LAVANDA) },
      styles: { cellPadding: 2 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;
  }

  // ------ Shelf Share ------
  if (a.shelf_share?.brands?.length) {
    y = sectionHeader(doc, y, 'Participacion en Anaquel');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRGB(BODY_COLOR));
    doc.text(`Marca dominante: ${a.shelf_share.dominant_brand}`, PAGE_MARGIN, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Marca', 'Participacion %', 'Posicion']],
      body: a.shelf_share.brands.map(b => [
        b.name,
        `${b.estimated_share_pct}%`,
        b.position ?? '-',
      ]),
      headStyles: {
        fillColor: hexToRGB(TERRACOTA),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
      },
      bodyStyles: {
        textColor: hexToRGB(BODY_COLOR),
        fontSize: 8,
        font: 'helvetica',
      },
      alternateRowStyles: { fillColor: hexToRGB(LAVANDA) },
      styles: { cellPadding: 2 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;

    if (a.shelf_share.notes) {
      y = bodyText(doc, y, a.shelf_share.notes);
    }
  }

  // ------ Precios ------
  if (a.pricing?.prices_found?.length) {
    y = sectionHeader(doc, y, 'Precios Detectados');

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['Producto', 'Precio', 'Moneda', 'Tipo']],
      body: a.pricing.prices_found.map(p => [
        p.item,
        `$${p.price.toFixed(2)}`,
        p.currency ?? '-',
        p.type ?? '-',
      ]),
      headStyles: {
        fillColor: hexToRGB(TERRACOTA),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
      },
      bodyStyles: {
        textColor: hexToRGB(BODY_COLOR),
        fontSize: 8,
        font: 'helvetica',
      },
      alternateRowStyles: { fillColor: hexToRGB(LAVANDA) },
      styles: { cellPadding: 2 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;

    if (a.pricing.strategies_detected?.length) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...hexToRGB(BODY_COLOR));
      doc.text(
        `Estrategias detectadas: ${a.pricing.strategies_detected.join(', ')}`,
        PAGE_MARGIN,
        y,
      );
      y += 6;
    }
  }

  // ------ Cumplimiento ------
  if (a.compliance) {
    y = sectionHeader(doc, y, 'Cumplimiento');
    const c = a.compliance;

    const complianceLines = [
      `Puntaje: ${c.score}`,
      `Facing de producto: ${c.product_facing}`,
      `Senalizacion: ${c.signage}`,
    ];
    if (c.pop_materials) {
      complianceLines.push(
        `Material POP: ${c.pop_materials.present ? 'Presente' : 'Ausente'} — ${c.pop_materials.condition}`,
      );
    }
    for (const line of complianceLines) {
      y = bodyText(doc, y, line);
    }

    if (c.issues?.length) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hexToRGB(NAVY));
      y = ensureSpace(doc, y, 6);
      doc.text('Problemas detectados:', PAGE_MARGIN, y);
      y += 5;
      y = bulletList(doc, y, c.issues, '#C62828');
    }
  }

  // ------ Condicion ------
  if (a.condition) {
    y = sectionHeader(doc, y, 'Condicion del Establecimiento');
    const cond = a.condition;

    const condLines = [
      `Limpieza: ${cond.cleanliness}`,
      `Exhibidores: ${cond.displays}`,
      `Iluminacion: ${cond.lighting}`,
      `Productos: ${cond.products}`,
    ];
    for (const line of condLines) {
      y = bodyText(doc, y, line);
    }

    if (cond.safety_issues?.length) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hexToRGB(NAVY));
      y = ensureSpace(doc, y, 6);
      doc.text('Riesgos de seguridad:', PAGE_MARGIN, y);
      y += 5;
      y = bulletList(doc, y, cond.safety_issues, '#C62828');
    }
    if (cond.notes) {
      y = bodyText(doc, y, cond.notes);
    }
  }

  // ------ Condition Detail (extended) ------
  if (response.condition_detail) {
    const cd = response.condition_detail;

    if (cd.overall_assessment) {
      y = sectionHeader(doc, y, 'Evaluacion General');
      y = bodyText(doc, y, cd.overall_assessment);
    }

    if (cd.issues?.length) {
      y = sectionHeader(doc, y, 'Detalle de Problemas');
      for (const issue of cd.issues) {
        y = ensureSpace(doc, y, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...hexToRGB(NAVY));
        doc.text(issue.description, PAGE_MARGIN + 4, y);
        y += 5;

        const details: string[] = [];
        if (issue.location) details.push(`Ubicacion: ${issue.location}`);
        if (issue.severity) details.push(`Severidad: ${issue.severity}`);
        if (issue.root_cause) details.push(`Causa raiz: ${issue.root_cause}`);
        if (issue.immediate_action) details.push(`Accion inmediata: ${issue.immediate_action}`);

        for (const d of details) {
          y = bodyText(doc, y, d);
        }
        y += 2;
      }
    }

    if (cd.remediation_plan) {
      y = sectionHeader(doc, y, 'Plan de Remediacion');
      const rp = cd.remediation_plan;
      if (rp.immediate?.length) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...hexToRGB(NAVY));
        y = ensureSpace(doc, y, 6);
        doc.text('Inmediato:', PAGE_MARGIN, y);
        y += 5;
        y = bulletList(doc, y, rp.immediate);
      }
      if (rp.short_term?.length) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...hexToRGB(NAVY));
        y = ensureSpace(doc, y, 6);
        doc.text('Corto plazo:', PAGE_MARGIN, y);
        y += 5;
        y = bulletList(doc, y, rp.short_term);
      }
      if (rp.preventive?.length) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...hexToRGB(NAVY));
        y = ensureSpace(doc, y, 6);
        doc.text('Preventivo:', PAGE_MARGIN, y);
        y += 5;
        y = bulletList(doc, y, rp.preventive);
      }
    }
  }

  // ------ Contexto ------
  if (a.context) {
    y = sectionHeader(doc, y, 'Contexto');
    const ctx = a.context;
    const ctxLines = [
      `Tipo de establecimiento: ${ctx.establishment_type}`,
      `Entorno: ${ctx.setting}`,
      `Trafico peatonal: ${ctx.foot_traffic}`,
    ];
    if (ctx.time_of_day) ctxLines.push(`Hora del dia: ${ctx.time_of_day}`);
    if (ctx.inferred_location) {
      const loc = ctx.inferred_location;
      const locParts: string[] = [];
      if (loc.city_or_region) locParts.push(loc.city_or_region);
      if (loc.country) locParts.push(loc.country);
      if (locParts.length) {
        ctxLines.push(`Ubicacion inferida: ${locParts.join(', ')} (${loc.confidence})`);
      }
    }
    for (const line of ctxLines) {
      y = bodyText(doc, y, line);
    }
  }

  // ------ Insights ------
  if (a.insights) {
    const ins = a.insights;

    if (ins.strengths?.length) {
      y = sectionHeader(doc, y, 'Fortalezas');
      y = bulletList(doc, y, ins.strengths, '#2D8B4E');
    }
    if (ins.opportunities?.length) {
      y = sectionHeader(doc, y, 'Oportunidades');
      y = bulletList(doc, y, ins.opportunities, TERRACOTA);
    }
    if (ins.threats?.length) {
      y = sectionHeader(doc, y, 'Amenazas');
      y = bulletList(doc, y, ins.threats, '#C62828');
    }
    if (ins.recommendations?.length) {
      y = sectionHeader(doc, y, 'Recomendaciones');
      y = bulletList(doc, y, ins.recommendations, NAVY);
    }
  }

  // ------ Truncated warning ------
  if (response.meta.truncated) {
    y = ensureSpace(doc, y, 16);
    doc.setFillColor(...hexToRGB('#FFF3E0'));
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'F');
    doc.setDrawColor(...hexToRGB(TERRACOTA));
    doc.setLineWidth(0.5);
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRGB(TERRACOTA));
    doc.text(
      'Nota: El analisis fue truncado por limites de tokens. Algunos datos pueden estar incompletos.',
      PAGE_MARGIN + 4,
      y + 7,
    );
    y += 16;
  }

  // ------ Footers on every page ------
  addFooters(doc);

  // ------ Save ------
  doc.save(`bbm-reporte-${fileName}.pdf`);
}
