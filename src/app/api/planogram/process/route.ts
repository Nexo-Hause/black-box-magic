/**
 * Planogram Process — Pick one pending incidence and run comparison
 *
 * Atomic pick via pick_pending_incidence() RPC, downloads planogram +
 * field photos, runs Gemini multi-image comparison, updates result.
 *
 * Called by cron or API client (Bearer auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { downloadPlanogram } from '@/lib/planogram/storage';
import { buildIncidencePrompt } from '@/lib/planogram/incidence-prompt';
import { parseIncidenceResponse } from '@/lib/planogram/incidence-parser';
import { analyzeWithReferences } from '@/lib/gemini';
import { downloadPhoto } from '@/lib/ubiqo/ssrf';
import type { ReferenceData } from '@/types/comparison';
import type { RawIncidenceResponse } from '@/types/incidence';
import type { ImageSource } from '@/lib/gemini';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 1. Bearer auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 },
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado.', status: 503 },
      { status: 503 },
    );
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_AI_API_KEY no configurada.', status: 503 },
      { status: 503 },
    );
  }

  try {
    // 2. Atomic pick — claim one pending incidence
    const { data: rows, error: pickErr } = await supabase.rpc('pick_pending_incidence');

    if (pickErr) {
      console.error('Error picking pending incidence:', pickErr.message);
      return NextResponse.json(
        { error: `Error al seleccionar incidencia: ${pickErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    const incidence = Array.isArray(rows) ? rows[0] : rows;
    if (!incidence) {
      return NextResponse.json({
        success: true,
        message: 'No pending incidences',
      });
    }

    const incidenceId = incidence.id;

    try {
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
      // Reference image first (planogram), then field images
      const planogramImage: ImageSource = {
        base64: planogramBase64,
        mimeType: planogramMimeType,
        label: 'reference',
      };

      // For multi-field photos, combine into a single request
      // analyzeWithReferences expects: fieldImage, referenceImages[], prompt, apiKey
      // But we may have multiple field images. The function sends referenceImages first, then fieldImage.
      // For multiple field photos, we pass the first as fieldImage and the rest as additional references.
      // Actually, looking at the API: allImages = [...referenceImages, fieldImage]
      // So we need: referenceImages = [planogram], fieldImage = combined field images
      // But analyzeWithReferences only accepts one fieldImage.
      // Solution: pass planogram as reference[0], and use callGeminiMultiImage with all images.
      // The simplest correct approach: first field image as "fieldImage", planogram + remaining fields as "references"
      // But the prompt expects planogram first, then field photos.
      // Looking at the implementation: allImages = [...referenceImages, fieldImage]
      // So referenceImages=[planogram, ...otherFieldPhotos], fieldImage=lastFieldPhoto
      // This gives: [planogram, field2, field3, ..., field1] — wrong order.
      //
      // Correct approach: pass planogram + all-but-last field photos as references,
      // last field photo as fieldImage. Order: planogram, field1, field2, ..., fieldN.
      const referenceImages: ImageSource[] = [planogramImage];
      if (fieldImages.length > 1) {
        // Add all field images except the last as "extra references"
        referenceImages.push(...fieldImages.slice(0, -1));
      }
      const primaryFieldImage = fieldImages[fieldImages.length - 1];

      const startTime = Date.now();
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
        .eq('id', incidenceId);

      if (updateErr) {
        console.error('Error updating incidence result:', updateErr.message);
      }

      return NextResponse.json({
        success: true,
        incidence_id: incidenceId,
        status: 'completed',
        incidence_count: parsed.incidenceCount,
        severity_critical: parsed.severityCritical,
        severity_high: parsed.severityHigh,
        model: result.model,
        processing_time_ms: processingTime,
      });
    } catch (error) {
      // 11. On error: mark as failed
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`Processing incidence ${incidenceId} failed:`, message);

      await supabase
        .from('bbm_incidences')
        .update({
          status: 'failed',
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', incidenceId);

      return NextResponse.json({
        success: false,
        incidence_id: incidenceId,
        status: 'failed',
        error: message,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Planogram process failed:', message);
    return NextResponse.json(
      { error: `Error en process: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
