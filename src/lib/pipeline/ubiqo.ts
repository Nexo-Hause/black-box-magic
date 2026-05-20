import type { PipelineDeps, ProcessResult } from './types';

export interface UbiqoCaptureRow {
  id: string;
  url_base: string;
  photo_path: string;
  firma: string;
  custom_rules?: string | null;
  retry_count?: number;
  status: string;
}

export interface UbiqoProcessResult extends ProcessResult {
  execution_score: number | null;
  photo_type: string | null;
  severity: string | null;
}

export async function processUbiqoCapture(
  capture: UbiqoCaptureRow,
  deps: PipelineDeps
): Promise<UbiqoProcessResult> {
  const { downloadPhoto, analyzePhoto, decryptFirma, supabase } = deps;

  // Reconstruct photo URL: url_base + photo_path + firma
  // Decrypt firma (no-op if stored as plaintext / key not configured).
  const decryptedFirma = decryptFirma(capture.firma);
  const urlBase = capture.url_base.endsWith('/') ? capture.url_base : capture.url_base + '/';
  const photoPath = capture.photo_path.startsWith('/') ? capture.photo_path.slice(1) : capture.photo_path;
  const firma = decryptedFirma.startsWith('?') ? decryptedFirma : '?' + decryptedFirma;
  const photoUrl = urlBase + photoPath + firma;

  // Download with SSRF protection
  const { buffer, contentType } = await downloadPhoto(photoUrl);

  // Convert to base64
  const base64 = buffer.toString('base64');

  // Analyze with legacy 2-pass engine
  const customRules = process.env.UBIQO_QSR_CUSTOM_RULES || undefined;
  const result = await analyzePhoto(base64, contentType, customRules);

  // Extract key fields from analysis
  // The Gemini response may include fields beyond the TS type definition
  const analysis = result.analysis;
  const analysisRaw = analysis as unknown as Record<string, unknown>;
  const executionScore = typeof analysisRaw.execution_score === 'number'
    ? analysisRaw.execution_score
    : null;
  const photoType = analysis.photo_type || null;
  const severity = analysis.severity || null;

  // Update row with results
  const { error: updateError } = await supabase
    .from('bbm_ubiqo_captures')
    .update({
      status: 'completed',
      retry_count: 0, // Reset on success
      analysis_result: analysis,
      execution_score: executionScore,
      photo_type: photoType,
      severity,
      escalated: result.meta.escalated,
      model: result.meta.model,
      tokens_total: result.meta.tokens.total,
      processing_time_ms: result.meta.processing_time_ms,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', capture.id);

  if (updateError) {
    console.error('Failed to update completed capture:', updateError.message);
  }

  return {
    status: 'completed',
    captureId: capture.id,
    model: result.meta.model,
    tokens: result.meta.tokens.total,
    processingTimeMs: result.meta.processing_time_ms,
    escalated: result.meta.escalated,
    execution_score: executionScore,
    photo_type: photoType,
    severity,
  };
}
