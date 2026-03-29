import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { ONBOARDING_SYSTEM_PROMPT } from '@/lib/onboarding/system-prompt';
import { getOnboardingToolDeclarations } from '@/lib/onboarding/tools';
import { generateEphemeralToken } from '@/lib/onboarding/live-session';
import { supabase } from '@/lib/supabase';
import { z } from 'zod/v4';

export const maxDuration = 10;

const voiceRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Validate Gemini key before doing any other work
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service not available', status: 500 },
      { status: 500 },
    );
  }

  // Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status },
    );
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 },
    );
  }

  // Validate
  const parsed = voiceRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: sessionId (UUID) required', status: 400 },
      { status: 400 },
    );
  }

  const { sessionId } = parsed.data;

  // Validate sessionId exists in Supabase with an active status
  if (supabase) {
    try {
      const { data: session, error } = await supabase
        .from('bbm_client_configs')
        .select('id, status')
        .eq('id', sessionId)
        .in('status', ['draft', 'testing'])
        .maybeSingle();

      if (error) {
        console.error('[onboarding/voice] Supabase error:', error.message);
        // Graceful degradation — proceed without blocking the user
      } else if (!session) {
        return NextResponse.json(
          { error: 'Session not found or no longer active', status: 404 },
          { status: 404 },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/voice] Unexpected Supabase error:', message);
      // Graceful degradation
    }
  }

  // Generate ephemeral token
  let ephemeral: Awaited<ReturnType<typeof generateEphemeralToken>>;
  try {
    ephemeral = await generateEphemeralToken(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[onboarding/voice] Failed to generate ephemeral token:', message);
    return NextResponse.json(
      { error: 'Failed to initialize voice session', status: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: ephemeral.token,
    wsUrl: ephemeral.wsUrl,
    expiresAt: ephemeral.expiresAt,
    sessionId,
    systemPrompt: ONBOARDING_SYSTEM_PROMPT,
    tools: getOnboardingToolDeclarations(),
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { sessionId }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 },
  );
}
