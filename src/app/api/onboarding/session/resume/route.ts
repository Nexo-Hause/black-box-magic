import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateOnboardingToken } from '@/lib/onboarding/auth';
import { createEmptyPartialConfig } from '@/lib/onboarding/tools';
import { z } from 'zod/v4';

const resumeRequestSchema = z.union([
  z.object({
    email: z.string().email().min(3).max(254).transform(v => v.toLowerCase().trim()),
  }),
  z.object({
    sessionId: z.string().uuid(),
  })
]);

export const maxDuration = 15;

// In-memory rate limiting store (production should ideally use Redis)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup every 5 minutes to avoid memory leaks
const intervalId = setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  });
}, 5 * 60 * 1000);

if (typeof intervalId !== 'number' && intervalId && 'unref' in intervalId) {
  (intervalId as any).unref();
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

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

  // Rate limiting by IP + email combination
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const body = rawBody as any;
  const emailKey = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : 'unknown';
  const rateLimitKey = `${ip}:${emailKey}`;

  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Por favor intente más tarde.', status: 429 },
      { status: 429 }
    );
  }

  const parsed = resumeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: must provide email or sessionId', status: 400 },
      { status: 400 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service is unavailable', status: 503 },
      { status: 503 }
    );
  }

  try {
    if ('email' in parsed.data) {
      const { email } = parsed.data;

      // Query sessions created by this email
      const { data: configs, error } = await supabase
        .from('bbm_client_configs')
        .select('id, client_id, client_name, status, industry, updated_at')
        .eq('created_by', email)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[onboarding/resume] Error querying sessions:', error.message);
        return NextResponse.json(
          { error: 'Failed to query onboarding sessions', status: 500 },
          { status: 500 }
        );
      }

      return NextResponse.json({
        sessions: configs.map(c => ({
          sessionId: c.id,
          clientId: c.client_id,
          clientName: c.client_name,
          status: c.status,
          industry: c.industry,
          updatedAt: c.updated_at,
        }))
      });
    } else {
      const { sessionId } = parsed.data;

      // Query single session details
      const { data: config, error } = await supabase
        .from('bbm_client_configs')
        .select('id, client_id, client_name, status, industry, transcript, partial_config, config, created_by')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('[onboarding/resume] Error fetching session:', error.message);
        return NextResponse.json(
          { error: 'Failed to fetch onboarding session', status: 500 },
          { status: 500 }
        );
      }

      if (!config) {
        return NextResponse.json(
          { error: 'Session not found', status: 404 },
          { status: 404 }
        );
      }

      // Generate a new JWT token for this session
      const token = await generateOnboardingToken({
        clientId: config.client_id,
        clientName: config.client_name,
        email: config.created_by || 'unknown@client.com',
      });

      return NextResponse.json({
        sessionId: config.id,
        clientId: config.client_id,
        clientName: config.client_name,
        token,
        transcript: config.transcript || [],
        partialConfig: config.partial_config || createEmptyPartialConfig(),
        synthesizedConfig: config.config || null,
        status: config.status,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[onboarding/resume] Server error:', message);
    return NextResponse.json(
      { error: 'Internal server error', status: 500 },
      { status: 500 }
    );
  }
}
