import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

export const isEmailConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

interface AnalysisEmailData {
  photoType?: string;
  severity?: string;
  summary?: string;
  totalSkus?: number;
  complianceScore?: string;
  escalated?: boolean;
  processingTime?: number;
}

export async function sendAnalysisEmail(
  to: string,
  data: AnalysisEmailData
): Promise<boolean> {
  if (!transporter) {
    console.warn('SMTP not configured — email not sent');
    return false;
  }

  const html = buildEmailHtml(data);

  try {
    await transporter.sendMail({
      from: `"Black Box Magic" <${SMTP_USER}>`,
      to,
      subject: `BBM Analysis: ${data.photoType || 'Photo'} — ${data.severity || 'N/A'}`,
      html,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}

function buildEmailHtml(data: AnalysisEmailData): string {
  const severityColor =
    data.severity === 'CRITICAL' ? '#ef4444' :
    data.severity === 'MODERATE' ? '#eab308' : '#22c55e';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:2rem;">
    <div style="background:#111;color:#fff;padding:1.5rem 2rem;text-align:center;">
      <h1 style="margin:0;font-size:1.5rem;letter-spacing:0.1em;">BLACK BOX MAGIC</h1>
      <p style="margin:0.5rem 0 0;font-size:0.85rem;opacity:0.7;">Analysis Results</p>
    </div>

    <div style="background:#fff;border:2px solid #111;border-top:none;padding:2rem;">
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
        ${data.photoType ? `<span style="display:inline-block;padding:0.15rem 0.5rem;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border:2px solid #3b82f6;color:#3b82f6;">${data.photoType.replace('_', ' ')}</span>` : ''}
        ${data.severity ? `<span style="display:inline-block;padding:0.15rem 0.5rem;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border:2px solid ${severityColor};color:${severityColor};">${data.severity}</span>` : ''}
        ${data.escalated ? '<span style="display:inline-block;padding:0.15rem 0.5rem;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border:2px solid #ef4444;color:#ef4444;">ESCALATED</span>' : ''}
      </div>

      <p style="font-size:0.95rem;line-height:1.7;color:#333;margin-bottom:1.5rem;">
        ${data.summary || 'Analysis completed successfully.'}
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
        ${data.totalSkus != null ? `<div style="font-size:0.8rem;"><strong>SKUs Detected:</strong> ${data.totalSkus}</div>` : ''}
        ${data.complianceScore ? `<div style="font-size:0.8rem;"><strong>Compliance:</strong> ${data.complianceScore}</div>` : ''}
        ${data.processingTime ? `<div style="font-size:0.8rem;"><strong>Processing:</strong> ${(data.processingTime / 1000).toFixed(1)}s</div>` : ''}
      </div>

      <div style="text-align:center;padding-top:1rem;border-top:1px solid #ccc;">
        <a href="https://bbm.integrador.pro/demo" style="display:inline-block;padding:0.75rem 2rem;background:#111;color:#fff;text-decoration:none;font-weight:700;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;">
          VIEW FULL ANALYSIS
        </a>
      </div>
    </div>

    <div style="text-align:center;padding:1.5rem 0;font-size:0.7rem;color:#888;">
      <p>Powered by <strong>Integrador Pro</strong></p>
      <p>gonzalo@integrador.pro | integrador.pro | 442 391 1129</p>
    </div>
  </div>
</body>
</html>`;
}
