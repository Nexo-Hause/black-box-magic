import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { runTestPhoto } from '@/lib/onboarding/test-runner';
import { clientConfigSchema } from '@/lib/engine/config';
import { supabase } from '@/lib/supabase';
import type { ClientConfig } from '@/types/engine';

export const maxDuration = 60;

// ─── Request Schema ───────────────────────────────────────────────────────────

const testRequestSchema = z.object({
  sessionId: z.string().uuid(),
  photo: z.object({
    base64: z.string().min(1),
    mimeType: z.string().refine((v) => v.startsWith('image/'), {
      message: 'mimeType must start with "image/"',
    }),
    label: z.string().optional(),
  }),
});

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Validate Gemini key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service not available', status: 500 },
      { status: 500 }
    );
  }

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

  // Validate with Zod schema
  const parsed = testRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request: sessionId (UUID), photo.base64, and photo.mimeType (image/*) required',
        status: 400,
      },
      { status: 400 }
    );
  }

  const { sessionId, photo } = parsed.data;

  // Strip data URL prefix if present
  let imageBase64 = photo.base64;
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  let mimeType = photo.mimeType;
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    imageBase64 = dataUrlMatch[2];
  }

  // Validate base64 size (10MB max)
  const estimatedBytes = (imageBase64.length * 3) / 4;
  if (estimatedBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image too large. Maximum 10MB.', status: 413 },
      { status: 413 }
    );
  }

  // Fetch config from Supabase
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database unavailable', status: 503 },
      { status: 503 }
    );
  }

  const { data: configRow, error: fetchError } = await supabase
    .from('bbm_client_configs')
    .select('config, status')
    .eq('id', sessionId)
    .in('status', ['draft', 'testing'])
    .maybeSingle();

  if (fetchError) {
    console.error('[onboarding/test] Error fetching config:', fetchError.message);
    return NextResponse.json(
      { error: 'Failed to fetch session config', status: 500 },
      { status: 500 }
    );
  }

  if (!configRow) {
    return NextResponse.json(
      { error: 'Session not found or not in a testable state (must be draft or testing)', status: 404 },
      { status: 404 }
    );
  }

  // Parse and validate the config JSONB
  const configParse = clientConfigSchema.safeParse(configRow.config);
  if (!configParse.success) {
    console.error('[onboarding/test] Invalid config schema:', configParse.error.message);
    return NextResponse.json(
      { error: 'Session config is invalid or incomplete', status: 422 },
      { status: 422 }
    );
  }

  const config = configParse.data as ClientConfig;

  // Run analysis
  try {
    const testResult = await runTestPhoto(imageBase64, mimeType, config, apiKey);

    return NextResponse.json({
      result: testResult.result,
      ...(photo.label !== undefined && { photoLabel: photo.label }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[onboarding/test] Analysis failed:', message);
    return NextResponse.json(
      { error: `Analysis failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { sessionId, photo: { base64, mimeType, label? } }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
