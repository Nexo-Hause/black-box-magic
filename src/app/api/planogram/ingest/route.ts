import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchCaptures, extractPhotos, buildPhotoUrl } from '@/lib/ubiqo/client';
import { ingestRequestSchema } from '@/lib/ubiqo/types';
import { ingestPlanogramCaptures } from '@/lib/pipeline/planogram';

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
    const result = await ingestPlanogramCaptures(
      { form_id, from, to, tz },
      { fetchCaptures, extractPhotos, buildPhotoUrl, supabase }
    );

    if (result.skipped) {
      if (result.skipped === 'no planogram assignment') {
        return NextResponse.json({
          success: true,
          skipped: 'no planogram assignment',
          form_id: result.form_id,
          captures_found: result.captures_found,
        });
      }
      if (result.skipped === 'planogram inactive or deleted') {
        return NextResponse.json({
          success: true,
          skipped: 'planogram inactive or deleted',
          form_id: result.form_id,
          planogram_id: result.planogram_id,
          captures_found: result.captures_found,
        });
      }
    }

    return NextResponse.json({
      success: true,
      form_id: result.form_id,
      planogram_id: result.planogram_id,
      discovered: result.discovered,
      skipped: result.skipped_count,
      pending: result.pending,
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
