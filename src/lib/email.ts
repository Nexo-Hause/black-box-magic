import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

export const isEmailConfigured = !!(SMTP_USER && SMTP_PASS);

function createTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ── Translation maps ──

const SEVERITY_ES: Record<string, string> = {
  CRITICAL: 'CRITICA', MODERATE: 'MODERADA', MINOR: 'MENOR', 'N/A': 'N/A',
};
const COMPLIANCE_ES: Record<string, string> = {
  HIGH: 'ALTO', MEDIUM: 'MEDIO', LOW: 'BAJO',
};
const CLEANLINESS_ES: Record<string, string> = {
  CLEAN: 'LIMPIO', ACCEPTABLE: 'ACEPTABLE', DIRTY: 'SUCIO',
};

function t(map: Record<string, string>, key?: string): string {
  if (!key) return '—';
  return map[key.toUpperCase()] ?? key;
}

// ── Types ──

interface InventoryItem {
  name: string;
  brand?: string;
  quantity?: string | number;
}

interface PriceEntry {
  item: string;
  price: number;
  currency?: string;
  type?: string;
}

interface ShelfBrand {
  name: string;
  estimated_share_pct: number;
}

export interface FullAnalysisEmailData {
  photoType?: string;
  severity?: string;
  summary?: string;
  totalSkus?: number;
  complianceScore?: string;
  cleanliness?: string;
  dominantBrand?: string;
  escalated?: boolean;
  processingTime?: number;
  inventory?: InventoryItem[];
  prices?: PriceEntry[];
  shelfBrands?: ShelfBrand[];
  recommendations?: string[];
  conditionNotes?: string;
  imageBase64?: string;
  pdfBuffer?: Buffer;
  fileName?: string;
}

// ── Main send function ──

export async function sendAnalysisEmail(
  to: string,
  data: FullAnalysisEmailData
): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('SMTP not configured — email not sent');
    return false;
  }

  const html = buildEmailHtml(data);
  const sevLabel = t(SEVERITY_ES, data.severity);
  const typeLabel = data.photoType?.replace('_', ' ') || 'Foto';

  const attachments: { filename: string; content: Buffer; contentType: string; cid?: string }[] = [];

  // Embed image as CID attachment for inline display
  if (data.imageBase64) {
    const match = data.imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      attachments.push({
        filename: 'analysis-photo.jpg',
        content: Buffer.from(match[2], 'base64'),
        contentType: match[1],
        cid: 'analysis-photo',
      });
    }
  }

  if (data.pdfBuffer) {
    attachments.push({
      filename: `bbm-reporte-${data.fileName || 'analisis'}.pdf`,
      content: data.pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  try {
    await transporter.sendMail({
      from: `"Black Box Magic" <${SMTP_USER}>`,
      replyTo: 'ventas@integrador.pro',
      to,
      subject: `BBM Reporte: ${typeLabel} — Gravedad ${sevLabel}`,
      html,
      attachments,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? `${err.message} | code=${(err as NodeJS.ErrnoException).code}` : String(err);
    console.error(`Email send failed: ${msg} | user=${SMTP_USER}`);
    return false;
  }
}

// ── HTML Builder ──

function buildEmailHtml(data: FullAnalysisEmailData): string {
  const sevColor =
    data.severity === 'CRITICAL' ? '#ef4444' :
    data.severity === 'MODERATE' ? '#eab308' : '#22c55e';

  const sevLabel = t(SEVERITY_ES, data.severity);
  const compLabel = t(COMPLIANCE_ES, data.complianceScore);
  const cleanLabel = t(CLEANLINESS_ES, data.cleanliness);

  // Inventory table rows
  let inventoryHtml = '';
  if (data.inventory && data.inventory.length > 0) {
    const rows = data.inventory.slice(0, 20).map(item =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:0.85rem;">${item.name}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:0.85rem;color:#666;">${item.brand || '—'}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:0.85rem;text-align:center;">${item.quantity ?? '—'}</td></tr>`
    ).join('');

    inventoryHtml = `
      <h3 style="font-size:0.95rem;color:#1A1A2E;margin:1.5rem 0 0.5rem;border-bottom:2px solid #D35230;padding-bottom:4px;">Inventario</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f5f5fa;">
          <th style="padding:6px 8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#666;">Producto</th>
          <th style="padding:6px 8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#666;">Marca</th>
          <th style="padding:6px 8px;text-align:center;font-size:0.75rem;text-transform:uppercase;color:#666;">Cant.</th>
        </tr>
        ${rows}
      </table>
      ${data.inventory.length > 20 ? '<p style="font-size:0.75rem;color:#888;">... y más items (ver PDF adjunto)</p>' : ''}`;
  }

  // Shelf share
  let shelfHtml = '';
  if (data.shelfBrands && data.shelfBrands.length > 0) {
    const bars = data.shelfBrands.slice(0, 5).map(b =>
      `<div style="margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>${b.name}</span><span style="font-weight:700;">${b.estimated_share_pct}%</span></div>
        <div style="background:#eee;height:6px;border-radius:3px;"><div style="background:#D35230;height:6px;border-radius:3px;width:${Math.min(b.estimated_share_pct, 100)}%;"></div></div>
      </div>`
    ).join('');
    shelfHtml = `
      <h3 style="font-size:0.95rem;color:#1A1A2E;margin:1.5rem 0 0.5rem;border-bottom:2px solid #D35230;padding-bottom:4px;">Participación en Anaquel</h3>
      ${data.dominantBrand ? `<p style="font-size:0.85rem;margin-bottom:8px;">Marca dominante: <strong>${data.dominantBrand}</strong></p>` : ''}
      ${bars}`;
  }

  // Recommendations
  let recsHtml = '';
  if (data.recommendations && data.recommendations.length > 0) {
    const items = data.recommendations.slice(0, 5).map(r =>
      `<li style="margin-bottom:4px;font-size:0.85rem;color:#333;">${r}</li>`
    ).join('');
    recsHtml = `
      <h3 style="font-size:0.95rem;color:#1A1A2E;margin:1.5rem 0 0.5rem;border-bottom:2px solid #D35230;padding-bottom:4px;">Recomendaciones</h3>
      <ul style="padding-left:1.25rem;margin:0;">${items}</ul>`;
  }

  // Prices (top 5)
  let pricesHtml = '';
  if (data.prices && data.prices.length > 0) {
    const rows = data.prices.slice(0, 10).map(p =>
      `<tr><td style="padding:4px 8px;font-size:0.85rem;border-bottom:1px solid #eee;">${p.item}</td>
       <td style="padding:4px 8px;font-size:0.85rem;border-bottom:1px solid #eee;font-weight:700;">${p.currency || '$'}${p.price}</td>
       <td style="padding:4px 8px;font-size:0.75rem;border-bottom:1px solid #eee;color:#666;">${p.type || '—'}</td></tr>`
    ).join('');
    pricesHtml = `
      <h3 style="font-size:0.95rem;color:#1A1A2E;margin:1.5rem 0 0.5rem;border-bottom:2px solid #D35230;padding-bottom:4px;">Precios Detectados</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f5f5fa;">
          <th style="padding:4px 8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#666;">Producto</th>
          <th style="padding:4px 8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#666;">Precio</th>
          <th style="padding:4px 8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#666;">Tipo</th>
        </tr>
        ${rows}
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:1.5rem;">

    <!-- Header -->
    <div style="background:#1A1A2E;color:#fff;padding:1.5rem 2rem;text-align:center;">
      <h1 style="margin:0;font-size:1.4rem;letter-spacing:0.1em;">BLACK BOX MAGIC</h1>
      <p style="margin:0.5rem 0 0;font-size:0.85rem;color:#D35230;">Reporte de Análisis</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;border:2px solid #1A1A2E;border-top:none;padding:1.5rem 2rem;">

      <!-- Badges -->
      <div style="margin-bottom:1rem;">
        ${data.photoType ? `<span style="display:inline-block;padding:3px 10px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:#1A1A2E;color:#fff;margin-right:6px;">${data.photoType.replace('_', ' ')}</span>` : ''}
        ${data.severity && data.severity !== 'N/A' ? `<span style="display:inline-block;padding:3px 10px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:${sevColor};color:#fff;margin-right:6px;">Gravedad: ${sevLabel}</span>` : ''}
        ${data.escalated ? '<span style="display:inline-block;padding:3px 10px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:#ef4444;color:#fff;">ESCALADO</span>' : ''}
      </div>

      <!-- Photo -->
      ${data.imageBase64 ? '<div style="margin-bottom:1rem;"><img src="cid:analysis-photo" alt="Foto analizada" style="max-width:100%;height:auto;border:2px solid #1A1A2E;" /></div>' : ''}

      <!-- Summary -->
      <p style="font-size:0.95rem;line-height:1.7;color:#4A4A6A;margin-bottom:1rem;">
        ${data.summary || 'Análisis completado exitosamente.'}
      </p>

      <!-- Key metrics -->
      <div style="background:#F5F5FA;padding:12px 16px;margin-bottom:1rem;">
        <table style="width:100%;font-size:0.85rem;color:#4A4A6A;">
          <tr>
            ${data.totalSkus != null ? `<td><strong>SKUs:</strong> ${data.totalSkus}</td>` : ''}
            ${data.complianceScore ? `<td><strong>Cumplimiento:</strong> ${compLabel}</td>` : ''}
          </tr>
          <tr>
            ${data.cleanliness ? `<td><strong>Condición:</strong> ${cleanLabel}</td>` : ''}
            ${data.dominantBrand ? `<td><strong>Marca dominante:</strong> ${data.dominantBrand}</td>` : ''}
          </tr>
        </table>
      </div>

      ${inventoryHtml}
      ${shelfHtml}
      ${pricesHtml}
      ${recsHtml}

      ${data.conditionNotes ? `
      <h3 style="font-size:0.95rem;color:#1A1A2E;margin:1.5rem 0 0.5rem;border-bottom:2px solid #D35230;padding-bottom:4px;">Notas de Condición</h3>
      <p style="font-size:0.85rem;color:#4A4A6A;line-height:1.6;">${data.conditionNotes}</p>` : ''}

      ${data.pdfBuffer ? '<p style="font-size:0.8rem;color:#888;margin-top:1.5rem;padding-top:0.75rem;border-top:1px solid #ccc;">📎 PDF con reporte completo adjunto a este correo.</p>' : ''}

      <!-- CTA -->
      <div style="text-align:center;padding-top:1rem;margin-top:1rem;border-top:1px solid #ccc;">
        <a href="https://bbm.integrador.pro/demo" style="display:inline-block;padding:0.75rem 2rem;background:#D35230;color:#fff;text-decoration:none;font-weight:700;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;">
          VER ANÁLISIS COMPLETO
        </a>
      </div>
    </div>

    <!-- Footer / Firma -->
    <div style="text-align:center;padding:1.5rem 0;font-size:0.75rem;color:#888;">
      <p style="margin:0 0 4px;"><strong style="color:#1A1A2E;">Integrador Pro</strong></p>
      <p style="margin:0 0 2px;">ventas@integrador.pro | integrador.pro</p>
      <p style="margin:0;">442 391 1129</p>
    </div>
  </div>
</body>
</html>`;
}
