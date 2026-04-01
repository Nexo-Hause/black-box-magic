import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { authenticate } from '@/lib/auth';
import { generateOnboardingCode } from '@/lib/onboarding/auth';

export const maxDuration = 10;

// ─── Rate limiter (per-process, resets on deploy) ─────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const RequestSchema = z.object({
  clientId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'clientId must only contain letters, numbers, hyphens, and underscores'),
  clientName: z.string().min(1).max(200),
  email: z.email(),
});

function getBaseUrl(request: NextRequest): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  const host = request.headers.get('host');
  if (!host || !/^[a-zA-Z0-9][-a-zA-Z0-9.:]*$/.test(host)) {
    throw new Error('Unable to determine base URL');
  }
  const proto = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  // Auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 },
    );
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 },
    );
  }

  // Validate
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues, status: 400 },
      { status: 400 },
    );
  }

  const { clientId, clientName, email } = parsed.data;

  // Rate limit per clientId
  if (!checkRateLimit(clientId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', status: 429 },
      { status: 429 },
    );
  }

  // Generate code
  const code = await generateOnboardingCode(clientId, clientName, email);

  const baseUrl = getBaseUrl(request);
  const url = `${baseUrl}/onboarding?code=${code}`;

  return NextResponse.json({
    code,
    url,
    expiresIn: '7 days',
    client: { clientId, clientName, email },
  });
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with { clientId, clientName, email }', status: 405 },
    { status: 405 },
  );
}
