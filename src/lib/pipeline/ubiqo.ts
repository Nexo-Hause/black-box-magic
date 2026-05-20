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

import type { IngestParams, UbiqoIngestDeps, IngestResult } from './types';

export async function ingestUbiqoCaptures(
  params: IngestParams,
  deps: UbiqoIngestDeps
): Promise<IngestResult> {
  const { form_id, from, to, tz } = params;
  const { fetchCaptures, extractPhotos, encryptFirma, supabase } = deps;

  // Fetch captures from Ubiqo API
  const numericFormId = typeof form_id === 'number' ? form_id : parseInt(form_id, 10);
  const captures = await fetchCaptures(numericFormId, from, to, tz);

  // Filter only completed captures and extract photos
  const completedCaptures = captures.filter(c => c.estatus === 'Completa');

  let discovered = 0;

  // Snapshot total rows for this form before upsert to compute alreadyProcessed.
  const { count: countBefore } = await supabase
    .from('bbm_ubiqo_captures')
    .select('*', { count: 'exact', head: true })
    .eq('ubiqo_form_id', String(form_id));

  for (const capture of completedCaptures) {
    const photos = extractPhotos(capture);

    for (const photo of photos) {
      discovered++;

      const { error } = await supabase
        .from('bbm_ubiqo_captures')
        .upsert(
          {
            ubiqo_grupo: capture.grupo,
            ubiqo_folio: capture.folioEvidence,
            ubiqo_form_id: String(form_id),
            ubiqo_alias: capture.alias,
            ubiqo_username: capture.username,
            ubiqo_estatus: capture.estatus,
            photo_path: photo.url,
            photo_lat: photo.latitud ? parseFloat(photo.latitud) : null,
            photo_lon: photo.longitud ? parseFloat(photo.longitud) : null,
            photo_description: photo.descripcion || null,
            photo_captured_at: capture.fecha,
            url_base: capture.urlBase,
            firma: encryptFirma(capture.firma),
          },
          { onConflict: 'ubiqo_grupo,photo_path', ignoreDuplicates: true }
        );

      if (error) {
        console.error('Supabase upsert error:', error.message);
      }
    }
  }

  // alreadyProcessed = photos in this batch that already existed in DB
  const { count: countAfter } = await supabase
    .from('bbm_ubiqo_captures')
    .select('*', { count: 'exact', head: true })
    .eq('ubiqo_form_id', String(form_id));

  const actuallyInserted = (countAfter || 0) - (countBefore || 0);
  const alreadyProcessed = Math.max(0, discovered - actuallyInserted);

  const { count: pendingCount } = await supabase
    .from('bbm_ubiqo_captures')
    .select('*', { count: 'exact', head: true })
    .eq('ubiqo_form_id', String(form_id))
    .eq('status', 'pending');

  return {
    discovered,
    alreadyProcessed,
    pending: pendingCount || 0,
  };
}

