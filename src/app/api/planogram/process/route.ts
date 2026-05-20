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
import { processIncidence } from '@/lib/pipeline/planogram';
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

    // Defensive: pick_pending_incidence() should always return a 'processing' row.
    // Guard against unlikely race conditions (e.g. manual status change between pick and this check).
    if (incidence.status !== 'processing') {
      console.warn(`Picked incidence ${incidenceId} has unexpected status "${incidence.status}", skipping`);
      return NextResponse.json({
        success: false,
        message: 'Unexpected incidence status after pick, skipped',
      });
    }

    try {
      const realDeps = {
        downloadPlanogram,
        downloadPhoto,
        buildIncidencePrompt,
        analyzeWithReferences,
        parseIncidenceResponse,
        supabase,
        decryptFirma: (f: string) => f,
        analyzePhoto: () => { throw new Error('Not used'); },
      };

      const result = await processIncidence(incidence, realDeps);

      return NextResponse.json({
        success: true,
        incidence_id: result.captureId,
        status: result.status,
        incidence_count: result.incidence_count,
        severity_critical: result.severity_critical,
        severity_high: result.severity_high,
        model: result.model,
        processing_time_ms: result.processingTimeMs,
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
