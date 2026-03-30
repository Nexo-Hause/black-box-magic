import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { authenticate } from '@/lib/auth';
import { generateOnboardingCode } from '@/lib/onboarding/auth';

export const maxDuration = 10;

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
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
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

  // Generate code
  const code = await generateOnboardingCode(clientId, clientName, email);

  const baseUrl = getBaseUrl(request);
  const url = `${baseUrl}/onboarding?code=${code}`;

  return NextResponse.json({
    code,
    url,
    expiresIn: '5 minutes',
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
