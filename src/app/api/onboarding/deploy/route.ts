import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { supabase } from '@/lib/supabase';

export const maxDuration = 10;

// ─── Request Schema ───────────────────────────────────────────────────────────

const deployRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

// ─── Route Handler ────────────────────────────────────────────────────────────

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

  // Validate with Zod schema
  const parsed = deployRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: sessionId (UUID) required', status: 400 },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  // Supabase is required for deploy
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database unavailable', status: 503 },
      { status: 503 }
    );
  }

  // Fetch the config row
  const { data: configRow, error: fetchError } = await supabase
    .from('bbm_client_configs')
    .select('id, client_id, status, version')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchError) {
    console.error('[onboarding/deploy] Error fetching config:', fetchError.message);
    return NextResponse.json(
      { error: 'Failed to fetch session config', status: 500 },
      { status: 500 }
    );
  }

  if (!configRow) {
    return NextResponse.json(
      { error: 'Session not found', status: 404 },
      { status: 404 }
    );
  }

  // Must be in 'testing' status to deploy
  if (configRow.status !== 'testing') {
    const hint =
      configRow.status === 'active'
        ? 'Config is already active.'
        : configRow.status === 'archived'
          ? 'Config has been archived and cannot be deployed.'
          : configRow.status === 'draft'
            ? 'Config must be promoted to testing before deploying.'
            : `Unexpected status: ${configRow.status}.`;

    return NextResponse.json(
      { error: `Cannot deploy config with status "${configRow.status}". ${hint}`, status: 400 },
      { status: 400 }
    );
  }

  const clientId = configRow.client_id as string;
  const now = new Date().toISOString();

  // Archive any existing active config for this client_id
  const { error: archiveError } = await supabase
    .from('bbm_client_configs')
    .update({ status: 'archived', updated_at: now })
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (archiveError) {
    console.error('[onboarding/deploy] Error archiving active config:', archiveError.message);
    return NextResponse.json(
      { error: 'Failed to archive existing active config', status: 500 },
      { status: 500 }
    );
  }

  // Activate the new config
  const { data: updatedRow, error: activateError } = await supabase
    .from('bbm_client_configs')
    .update({
      status: 'active',
      version: (configRow.version as number) + 1,
      updated_at: now,
    })
    .eq('id', sessionId)
    .select('version')
    .single();

  if (activateError) {
    console.error('[onboarding/deploy] Error activating config:', activateError.message);
    return NextResponse.json(
      { error: 'Failed to activate config', status: 500 },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: 'active',
    clientId,
    configVersion: updatedRow.version as number,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { sessionId }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
