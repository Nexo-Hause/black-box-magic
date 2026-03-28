import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/onboarding/auth';
import { createEmptyPartialConfig } from '@/lib/onboarding/tools';
import { exchangeCodeRequestSchema } from '@/types/onboarding';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export const maxDuration = 10;

export async function POST(request: NextRequest) {
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
  const parsed = exchangeCodeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: code must be a valid UUID', status: 400 },
      { status: 400 }
    );
  }

  const { code } = parsed.data;

  // Exchange code for JWT
  const exchanged = await exchangeCode(code);
  if (!exchanged) {
    return NextResponse.json(
      { error: 'Invalid or expired code', status: 401 },
      { status: 401 }
    );
  }

  const { token, payload } = exchanged;
  const { clientId, clientName } = payload;

  // ─── Supabase: check for existing draft config (S6: reuse if exists) ───────
  if (supabase) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('bbm_client_configs')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('[onboarding/session] Error fetching existing config:', fetchError.message);
      }

      if (existing) {
        // Reuse existing draft session
        return NextResponse.json({
          sessionId: existing.id,
          clientId,
          clientName,
          token,
        });
      }

      // Create new draft config row
      const newId = randomUUID();
      const { error: insertError } = await supabase
        .from('bbm_client_configs')
        .insert({
          id: newId,
          client_id: clientId,
          client_name: clientName,
          industry: 'qsr',
          status: 'draft',
          transcript: [],
          partial_config: createEmptyPartialConfig(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[onboarding/session] Error creating config row:', insertError.message);
        // Graceful degradation: return a session without persistent storage
        return NextResponse.json({
          sessionId: newId,
          clientId,
          clientName,
          token,
        });
      }

      return NextResponse.json({
        sessionId: newId,
        clientId,
        clientName,
        token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/session] Supabase error:', message);
      // Graceful degradation
    }
  }

  // Supabase unavailable — return ephemeral session
  return NextResponse.json({
    sessionId: randomUUID(),
    clientId,
    clientName,
    token,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { code: string }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
