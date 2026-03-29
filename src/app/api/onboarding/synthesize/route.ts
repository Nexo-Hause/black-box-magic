import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { synthesizeConfig } from '@/lib/onboarding/synthesis';
import { createEmptyPartialConfig, type PartialOnboardingConfig } from '@/lib/onboarding/tools';
import { synthesizeRequestSchema } from '@/types/onboarding';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/gemini-chat';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status }
    );
  }

  const { payload } = auth;

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
  const parsed = synthesizeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: sessionId (UUID) required', status: 400 },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  // ─── Fetch session from Supabase ─────────────────────────────────────────
  let transcript: ChatMessage[] = [];
  let partialConfig: PartialOnboardingConfig = createEmptyPartialConfig();

  if (supabase) {
    try {
      const { data: sessionRow, error: fetchError } = await supabase
        .from('bbm_client_configs')
        .select('transcript, partial_config')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError) {
        console.error('[onboarding/synthesize] Error fetching session:', fetchError.message);
        // Continue with empty data — synthesis may produce low-confidence result
      } else if (sessionRow) {
        transcript = (sessionRow.transcript as ChatMessage[]) ?? [];
        partialConfig =
          (sessionRow.partial_config as PartialOnboardingConfig) ?? createEmptyPartialConfig();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/synthesize] Supabase fetch error:', errMsg);
    }
  }

  // ─── Synthesize config ────────────────────────────────────────────────────
  try {
    const result = await synthesizeConfig(transcript, partialConfig, {
      clientId: payload.clientId,
      clientName: payload.clientName,
      email: payload.email,
    });

    // ─── Update config row on success ───────────────────────────────────────
    if (supabase) {
      try {
        const { error: updateError } = await supabase
          .from('bbm_client_configs')
          .update({
            config: result.config,
            status: 'testing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          console.error('[onboarding/synthesize] Error updating config row:', updateError.message);
          // Non-fatal — we still return the synthesized config to the caller
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[onboarding/synthesize] Supabase update error:', errMsg);
      }
    }

    return NextResponse.json({
      config: result.config,
      gaps: result.gaps,
      confidence: result.confidence,
    });
  } catch (error) {
    // S7: never expose Gemini internals
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[onboarding/synthesize] Synthesis failed:', message);

    return NextResponse.json(
      { error: 'La síntesis de configuración falló. Por favor intente nuevamente.', status: 500 },
      { status: 500 }
    );
  }
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
