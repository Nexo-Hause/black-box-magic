import type { AnalysisResponse } from '@/types/analysis';

const PHOTO_TYPE_EMOJI: Record<string, string> = {
  shelf: '\u{1F6D2}',
  cooler: '\u{2744}\u{FE0F}',
  display: '\u{1F4CB}',
  storefront: '\u{1F3EA}',
  warehouse: '\u{1F4E6}',
  damage: '\u{26A0}\u{FE0F}',
  promo: '\u{1F389}',
  general: '\u{1F4F7}',
};

const SEVERITY_MAP: Record<string, string> = {
  CRITICAL: '\u{1F534} CRITICA',
  MODERATE: '\u{1F7E1} MODERADA',
  MINOR: '\u{1F7E2} MENOR',
  'N/A': '\u{26AA} N/A',
};

const COMPLIANCE_MAP: Record<string, string> = {
  HIGH: 'ALTO',
  MEDIUM: 'MEDIO',
  LOW: 'BAJO',
};

const CLEANLINESS_MAP: Record<string, string> = {
  CLEAN: 'LIMPIO',
  ACCEPTABLE: 'ACEPTABLE',
  DIRTY: 'SUCIO',
};

export function formatForWhatsApp(response: AnalysisResponse): string {
  const { analysis, meta, condition_detail } = response;
  const lines: string[] = [];

  // Header with photo_type badge
  const photoType = analysis.photo_type?.toLowerCase() ?? 'general';
  const emoji = PHOTO_TYPE_EMOJI[photoType] ?? '\u{1F4F7}';
  lines.push(`${emoji} *Analisis BBM* — ${analysis.photo_type ?? 'General'}`);
  lines.push('');

  // Severity badge
  const severityKey = (analysis.severity ?? condition_detail?.severity ?? 'N/A').toUpperCase();
  const severityLabel = SEVERITY_MAP[severityKey] ?? `\u{26AA} ${severityKey}`;
  lines.push(`Gravedad: ${severityLabel}`);
  lines.push('');

  // Summary
  lines.push(`Resumen: ${analysis.summary}`);
  lines.push('');

  // Key inventory count
  if (analysis.inventory) {
    lines.push(`Productos detectados: ${analysis.inventory.total_skus_detected}`);
  }

  // Dominant brand
  if (analysis.shelf_share?.dominant_brand) {
    lines.push(`Marca dominante: ${analysis.shelf_share.dominant_brand}`);
  }

  // Compliance score
  if (analysis.compliance?.score) {
    const complianceKey = analysis.compliance.score.toUpperCase();
    const complianceLabel = COMPLIANCE_MAP[complianceKey] ?? analysis.compliance.score;
    lines.push(`Cumplimiento: ${complianceLabel}`);
  }

  // Condition / cleanliness
  if (analysis.condition?.cleanliness) {
    const cleanKey = analysis.condition.cleanliness.toUpperCase();
    const cleanLabel = CLEANLINESS_MAP[cleanKey] ?? analysis.condition.cleanliness;
    lines.push(`Condicion: ${cleanLabel}`);
  }

  // Spacing before recommendations
  if (
    analysis.inventory ||
    analysis.shelf_share?.dominant_brand ||
    analysis.compliance?.score ||
    analysis.condition?.cleanliness
  ) {
    lines.push('');
  }

  // Top 3 recommendations
  if (analysis.insights?.recommendations && analysis.insights.recommendations.length > 0) {
    lines.push('Recomendaciones:');
    const top3 = analysis.insights.recommendations.slice(0, 3);
    top3.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  // Escalation note
  if (meta.escalated) {
    lines.push('\u{26A0}\u{FE0F} Este analisis fue escalado por complejidad.');
    lines.push('');
  }

  // Truncation note
  if (meta.truncated) {
    lines.push('Nota: El analisis puede estar incompleto.');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('Generado por Black Box Magic | bbm.integrador.pro');

  return lines.join('\n');
}
