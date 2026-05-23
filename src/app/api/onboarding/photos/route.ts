import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { supabase } from '@/lib/supabase';
import { z } from 'zod/v4';

const savePhotosRequestSchema = z.object({
  sessionId: z.string().uuid(),
  photos: z.array(z.object({
    id: z.string(),
    fileName: z.string().max(255).optional(),
    previewUrl: z.string().max(2048).optional(),
    status: z.enum(['pending', 'analyzing', 'done', 'error']),
    result: z.any().optional().nullable(),
    rating: z.enum(['ok', 'no']).optional().nullable(),
    feedback: z.string().max(1000).optional().nullable(),
  })).max(100, 'Maximum 100 photos per request'),
  iterationCount: z.number().optional(),
});

export const maxDuration = 20;

export async function POST(request: NextRequest) {
  // Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status }
    );
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  // Validate
  const parsed = savePhotosRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: sessionId (UUID) and structured photos (array) required', status: 400 },
      { status: 400 }
    );
  }

  const { sessionId, photos, iterationCount } = parsed.data;

  // Payload size validation to avoid JSONB database overflow or memory abuse
  const totalPayloadSize = JSON.stringify(photos).length;
  if (totalPayloadSize > 800 * 1024) { // 800KB conservative limit for JSONB
    return NextResponse.json(
      { error: 'El tamaño de las fotos es demasiado grande. Reduce la cantidad de imágenes o descripciones.', status: 413 },
      { status: 413 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service is unavailable', status: 503 },
      { status: 503 }
    );
  }

  try {
    // 1. Fetch current partial_config to avoid overriding other fields
    const { data: configRow, error: fetchError } = await supabase
      .from('bbm_client_configs')
      .select('partial_config')
      .eq('id', sessionId)
      .maybeSingle();

    if (fetchError) {
      console.error('[onboarding/photos] Fetch partial_config error:', fetchError.message);
      return NextResponse.json(
        { error: 'Failed to fetch existing configuration state', status: 500 },
        { status: 500 }
      );
    }

    const currentPartialConfig = configRow?.partial_config && typeof configRow.partial_config === 'object'
      ? (configRow.partial_config as Record<string, unknown>)
      : {};

    // 2. Update keys
    const updatedPartialConfig = {
      ...currentPartialConfig,
      sandbox_photos: photos,
      ...(iterationCount !== undefined && { iteration_count: iterationCount }),
    };

    // 3. Save back to Supabase
    const { error: updateError } = await supabase
      .from('bbm_client_configs')
      .update({
        partial_config: updatedPartialConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[onboarding/photos] Update partial_config error:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to persist sandbox photos', status: 500 },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[onboarding/photos] Server error:', message);
    return NextResponse.json(
      { error: 'Internal server error', status: 500 },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { sessionId, photos }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
