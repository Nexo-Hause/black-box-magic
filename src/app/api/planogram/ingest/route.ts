/**
 * Planogram Ingest — Discover Ubiqo captures and queue for comparison
 *
 * Fetches captures from Ubiqo Evidence API, looks up planogram assignments
 * by form_id, groups photos by capture, and inserts pending incidences.
 *
 * Called by cron or API client (Bearer auth, NOT cookie auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchCaptures, extractPhotos, buildPhotoUrl } from '@/lib/ubiqo/client';
import { ingestRequestSchema } from '@/lib/ubiqo/types';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // 1. Bearer auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 },
    );
  }

  // 2. Supabase required
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado.', status: 503 },
      { status: 503 },
    );
  }

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Se esperaba JSON en el body.', status: 400 },
      { status: 400 },
    );
  }

  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validacion fallida', details: parsed.error.issues, status: 400 },
      { status: 400 },
    );
  }

  const { form_id, from, to, tz } = parsed.data;

  try {
    // 4. Fetch captures from Ubiqo
    const captures = await fetchCaptures(form_id, from, to, tz);

    // 5. Lookup planogram assignment for this form_id
    const { data: assignment, error: assignErr } = await supabase
      .from('bbm_planogram_assignments')
      .select('planogram_id')
      .eq('form_id', String(form_id))
      .maybeSingle();

    if (assignErr) {
      console.error('Error looking up planogram assignment:', assignErr.message);
      return NextResponse.json(
        { error: `Error al buscar asignacion: ${assignErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 6. No assignment = skip
    if (!assignment) {
      return NextResponse.json({
        success: true,
        skipped: 'no planogram assignment',
        form_id,
        captures_found: captures.length,
      });
    }

    const planogramId = assignment.planogram_id;

    // 7. Group photos by capture (ubiqo_grupo)
    let discovered = 0;
    let skipped = 0;
    let pending = 0;

    for (const captura of captures) {
      const photos = extractPhotos(captura);
      if (photos.length === 0) {
        skipped++;
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

      // 8. INSERT into bbm_incidences with dedup on ubiqo_capture_id
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
          },
          {
            onConflict: 'ubiqo_capture_id',
            ignoreDuplicates: true,
          },
        );

      if (insertErr) {
        console.error(`Error inserting incidence for capture ${captura.grupo}:`, insertErr.message);
        skipped++;
        continue;
      }

      pending++;
    }

    return NextResponse.json({
      success: true,
      form_id,
      planogram_id: planogramId,
      discovered,
      skipped,
      pending,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Planogram ingest failed:', message);
    return NextResponse.json(
      { error: `Error en ingest: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
