import type { PlanogramPipelineDeps, ProcessResult } from './types';
import type { ReferenceData } from '@/types/comparison';
import type { RawIncidenceResponse } from '@/types/incidence';
import type { ImageSource } from '@/lib/gemini';

export interface IncidenceRow {
  id: string;
  planogram_id: string;
  field_photo_paths: string[];
  status: string;
}

export interface PlanogramProcessResult extends ProcessResult {
  incidence_count: number;
  severity_critical: number;
  severity_high: number;
}

export async function processIncidence(
  incidence: IncidenceRow,
  deps: PlanogramPipelineDeps
): Promise<PlanogramProcessResult> {
  const {
    downloadPlanogram,
    downloadPhoto,
    buildIncidencePrompt,
    analyzeWithReferences,
    parseIncidenceResponse,
    supabase,
  } = deps;

  // 3. Get planogram record
  const { data: planogram, error: planogramErr } = await supabase
    .from('bbm_planograms')
    .select('*')
    .eq('id', incidence.planogram_id)
    .eq('active', true)
    .maybeSingle();

  if (planogramErr) {
    throw new Error(`Error fetching planogram: ${planogramErr.message}`);
  }

  if (!planogram) {
    throw new Error(`No active planogram found for id ${incidence.planogram_id}`);
  }

  // 4. Download planogram image from Supabase Storage
  const planogramResult = await downloadPlanogram(planogram.storage_path);
  if ('error' in planogramResult) {
    throw new Error(`Failed to download planogram: ${planogramResult.error}`);
  }

  const planogramBlob = planogramResult.data;
  const planogramBuffer = Buffer.from(await planogramBlob.arrayBuffer());
  const planogramBase64 = planogramBuffer.toString('base64');
  const planogramMimeType = planogram.file_type || 'image/jpeg';

  // 5. Download field photos from stored URLs
  const fieldPhotoUrls: string[] = incidence.field_photo_paths || [];
  if (fieldPhotoUrls.length === 0) {
    throw new Error('No field photo paths in incidence record');
  }

  const fieldImages: ImageSource[] = [];
  for (const photoUrl of fieldPhotoUrls) {
    const { buffer, contentType } = await downloadPhoto(photoUrl);
    fieldImages.push({
      base64: buffer.toString('base64'),
      mimeType: contentType,
      label: 'field',
    });
  }

  // 6. Build reference data from planogram metadata
  const referenceData: ReferenceData = {
    type: 'planogram',
    section: planogram.section || undefined,
    items: planogram.reference_items || [],
  };

  // 7. Build prompt
  const prompt = buildIncidencePrompt(referenceData, fieldImages.length);

  // 8. Call Gemini with multi-image comparison
  const planogramImage: ImageSource = {
    base64: planogramBase64,
    mimeType: planogramMimeType,
    label: 'reference',
  };

  const referenceImages: ImageSource[] = [planogramImage];
  if (fieldImages.length > 1) {
    referenceImages.push(...fieldImages.slice(0, -1));
  }
  const primaryFieldImage = fieldImages[fieldImages.length - 1];

  const startTime = Date.now();
  const apiKey = process.env.GOOGLE_AI_API_KEY!;
  const result = await analyzeWithReferences(
    primaryFieldImage,
    referenceImages,
    prompt,
    apiKey,
  );

  // 9. Parse response
  const rawResponse = result.data as unknown as RawIncidenceResponse;
  const parsed = parseIncidenceResponse(rawResponse);
  const processingTime = Date.now() - startTime;

  // 10. UPDATE incidence with results
  const { error: updateErr } = await supabase
    .from('bbm_incidences')
    .update({
      status: 'completed',
      raw_response: result.data,
      incidences: parsed.incidences,
      incidence_count: parsed.incidenceCount,
      severity_critical: parsed.severityCritical,
      severity_high: parsed.severityHigh,
      severity_medium: parsed.severityMedium,
      severity_low: parsed.severityLow,
      summary: parsed.summary,
      photo_quality: parsed.photoQuality,
      coverage: parsed.coverage,
      processing_time_ms: processingTime,
      model: result.model,
      tokens_total: result.tokens.total,
      processed_at: new Date().toISOString(),
    })
    .eq('id', incidence.id);

  if (updateErr) {
    console.error('Error updating incidence result:', updateErr.message);
  }

  return {
    status: 'completed',
    captureId: incidence.id,
    model: result.model,
    tokens: result.tokens.total,
    processingTimeMs: processingTime,
    escalated: parsed.severityCritical > 0 || parsed.severityHigh > 0, // escalation logic equivalent
    incidence_count: parsed.incidenceCount,
    severity_critical: parsed.severityCritical,
    severity_high: parsed.severityHigh,
  };
}

import type { IngestParams, PlanogramIngestDeps, PlanogramIngestResult, TenantInfo } from './types';

export async function ingestPlanogramCaptures(
  params: IngestParams,
  deps: PlanogramIngestDeps
): Promise<PlanogramIngestResult> {
  const { form_id, from, to, tz } = params;
  const { fetchCaptures, extractPhotos, buildPhotoUrl, supabase } = deps;

  // 4. Fetch captures from Ubiqo
  const numericFormId = typeof form_id === 'number' ? form_id : parseInt(form_id, 10);
  const captures = await fetchCaptures(numericFormId, from, to, tz);

  // 5. Lookup planogram assignment for this form_id
  const { data: assignment, error: assignErr } = await supabase
    .from('bbm_planogram_assignments')
    .select('planogram_id')
    .eq('form_id', String(form_id))
    .maybeSingle();

  if (assignErr) {
    throw new Error(`Error al buscar asignacion: ${assignErr.message}`);
  }

  // 6. No assignment = skip
  if (!assignment) {
    return {
      success: true,
      skipped: 'no planogram assignment',
      form_id,
      captures_found: captures.length,
    };
  }

  const planogramId = assignment.planogram_id;

  // 5b. Verify planogram is still active
  const { data: planogramCheck, error: planogramCheckErr } = await supabase
    .from('bbm_planograms')
    .select('id')
    .eq('id', planogramId)
    .eq('active', true)
    .maybeSingle();

  if (planogramCheckErr) {
    throw new Error(`Error al verificar planograma: ${planogramCheckErr.message}`);
  }

  if (!planogramCheck) {
    return {
      success: true,
      skipped: 'planogram inactive or deleted',
      form_id,
      planogram_id: planogramId,
      captures_found: captures.length,
    };
  }

  // Resolve tenant from planogram's client_id
  let tenantInfo: TenantInfo | null = null;
  if (deps.resolveTenantFromFormId) {
    tenantInfo = await deps.resolveTenantFromFormId(String(form_id), supabase);
  }

  // 7. Group photos by capture (ubiqo_grupo)
  let discovered = 0;
  let skippedCount = 0;
  let pending = 0;

  for (const captura of captures) {
    const photos = extractPhotos(captura);
    if (photos.length === 0) {
      skippedCount++;
      continue;
    }

    discovered++;

    // Build full URLs for all photos in this capture
    const fieldPhotoUrls = photos.map((photo) =>
      buildPhotoUrl(
        { urlBase: captura.urlBase, firma: captura.firma },
        { url: photo.url },
      )
    );

    // 8. INSERT into bbm_incidences with dedup on ubiqo_capture_id.
    const { error: insertErr } = await supabase
      .from('bbm_incidences')
      .upsert(
        {
          planogram_id: planogramId,
          ubiqo_capture_id: captura.grupo,
          promoter_name: captura.alias || null,
          store_name: captura.alias || null,
          photo_captured_at: captura.fecha || null,
          field_photo_paths: fieldPhotoUrls,
          status: 'pending',
          ...(tenantInfo ? {
            account_id: tenantInfo.accountId,
            client_id: tenantInfo.clientId,
          } : {}),
        },
        {
          onConflict: 'ubiqo_capture_id',
          ignoreDuplicates: true,
        },
      );

    if (insertErr) {
      console.error(`Error inserting incidence for capture ${captura.grupo}:`, insertErr.message);
      skippedCount++;
      continue;
    }

    pending++;
  }

  return {
    success: true,
    form_id,
    planogram_id: planogramId,
    discovered,
    skipped_count: skippedCount,
    pending,
  };
}

