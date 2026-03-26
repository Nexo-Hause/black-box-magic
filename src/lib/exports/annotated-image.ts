import type { AnalysisResponse } from '@/types/analysis';

const MAX_DIMENSION = 2048;

const COLORS = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  gray: '#666666',
  overlay: 'rgba(0, 0, 0, 0.7)',
  white: '#ffffff',
} as const;

const FONT_FAMILY = 'Arial, sans-serif';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityColor(severity: string | undefined): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return COLORS.red;
    case 'MODERATE':
      return COLORS.yellow;
    case 'MINOR':
      return COLORS.green;
    default:
      return COLORS.gray;
  }
}

function complianceColor(score: string | undefined): string {
  switch (score?.toUpperCase()) {
    case 'HIGH':
      return COLORS.green;
    case 'MEDIUM':
      return COLORS.yellow;
    case 'LOW':
      return COLORS.red;
    default:
      return COLORS.gray;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

/** Load an image from any URL (including blob: URLs). */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/** Compute scaled dimensions so neither side exceeds MAX_DIMENSION. */
function scaledSize(
  w: number,
  h: number,
): { width: number; height: number } {
  if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) return { width: w, height: h };
  const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

/** Convert a canvas to a Blob (PNG). Returns null if conversion fails. */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/png',
    );
  });
}

// ---------------------------------------------------------------------------
// Badge drawing helpers
// ---------------------------------------------------------------------------

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  fontSize: number,
  align: 'left' | 'right' = 'left',
): { width: number; height: number } {
  const paddingH = 12;
  const paddingV = 6;
  ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  const metrics = ctx.measureText(text);
  const badgeW = metrics.width + paddingH * 2;
  const badgeH = fontSize + paddingV * 2;

  const drawX = align === 'right' ? x - badgeW : x;

  ctx.fillStyle = bgColor;
  roundRect(ctx, drawX, y, badgeW, badgeH, 6);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, drawX + paddingH, y + badgeH / 2);

  return { width: badgeW, height: badgeH };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate an annotated PNG from a photo and its analysis result.
 *
 * Returns `null` when anything goes wrong (e.g. mobile memory pressure,
 * canvas security errors on tainted images, etc.).
 */
export async function generateAnnotatedImage(
  imageUrl: string,
  response: AnalysisResponse,
): Promise<Blob | null> {
  try {
    const img = await loadImage(imageUrl);
    const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // --- Draw source image (scaled) ---
    ctx.drawImage(img, 0, 0, width, height);

    const { analysis, meta } = response;
    const margin = 12;
    const badgeFontSize = Math.max(14, Math.round(width * 0.018));
    const gap = 8;

    // --- 1. Photo type badge (top-left) ---
    if (analysis.photo_type) {
      drawBadge(
        ctx,
        analysis.photo_type.toUpperCase(),
        margin,
        margin,
        COLORS.overlay,
        badgeFontSize,
        'left',
      );
    }

    // --- 2. Severity badge (top-right) ---
    const severityText = (analysis.severity ?? 'N/A').toUpperCase();
    const sevColor = severityColor(analysis.severity);
    const sevBadge = drawBadge(
      ctx,
      severityText,
      width - margin,
      margin,
      sevColor,
      badgeFontSize,
      'right',
    );

    // --- 5. Escalation indicator (red "!" next to severity) ---
    if (meta.escalated) {
      const exclamationSize = badgeFontSize;
      const excX = width - margin - sevBadge.width - gap;
      drawBadge(ctx, '!', excX, margin, COLORS.red, exclamationSize, 'right');
    }

    // --- 3. Compliance score badge (below severity) ---
    const complianceScore = analysis.compliance?.score;
    if (complianceScore) {
      const compColor = complianceColor(complianceScore);
      const compText = `COMPLIANCE: ${complianceScore.toUpperCase()}`;
      drawBadge(
        ctx,
        compText,
        width - margin,
        margin + sevBadge.height + gap,
        compColor,
        badgeFontSize,
        'right',
      );
    }

    // --- 4. Bottom info bar ---
    const barHeight = 60;
    const barY = height - barHeight;

    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, barY, width, barHeight);

    const barFontSize = Math.max(13, Math.round(width * 0.016));
    ctx.font = `${barFontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.white;
    ctx.textBaseline = 'middle';

    // Left: summary
    const summaryText = truncate(analysis.summary, 80);
    ctx.textAlign = 'left';
    ctx.fillText(summaryText, margin, barY + barHeight / 2, width - 100);

    // Right: BBM watermark
    ctx.font = `bold ${barFontSize + 2}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.6;
    ctx.fillText('BBM', width - margin, barY + barHeight / 2);
    ctx.globalAlpha = 1.0;

    // --- Convert canvas to PNG blob ---
    return await canvasToBlob(canvas);
  } catch {
    return null;
  }
}

/**
 * Trigger a file download for a Blob in the browser.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup after a tick so the browser has time to start the download.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
