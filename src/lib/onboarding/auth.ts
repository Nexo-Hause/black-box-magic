// ─── Onboarding JWT Auth ──────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { OnboardingTokenPayload } from '@/types/onboarding';

// ─── Secret (HMAC derivation from cookie secret as fallback) ─────────────────

let cachedSecret: Uint8Array | null = null;

async function deriveSecret(): Promise<Uint8Array> {
  // Prefer dedicated JWT secret
  const jwtSecret = process.env.BBM_JWT_SECRET;
  if (jwtSecret) {
    return new TextEncoder().encode(jwtSecret);
  }

  // Fall back to HMAC derivation from cookie secret
  const cookieSecret = process.env.BBM_COOKIE_SECRET || '';
  if (!cookieSecret) {
    console.warn('[onboarding/auth] No JWT secret configured. Set BBM_JWT_SECRET or BBM_COOKIE_SECRET.');
    return new TextEncoder().encode('');
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(cookieSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const derived = await crypto.subtle.sign('HMAC', key, encoder.encode('bbm_jwt_derivation_v1'));
  return new Uint8Array(derived);
}

async function getSecret(): Promise<Uint8Array> {
  if (!cachedSecret) {
    cachedSecret = await deriveSecret();
  }
  return cachedSecret;
}

// ─── Code Store (in-memory, short-lived) ─────────────────────────────────────

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CodeEntry {
  payload: OnboardingTokenPayload;
  expiresAt: number;
  exchanged: boolean;
}

const codeStore = new Map<string, CodeEntry>();

function pruneExpiredCodes(): void {
  const now = Date.now();
  for (const [key, entry] of Array.from(codeStore.entries())) {
    if (entry.expiresAt <= now) {
      codeStore.delete(key);
    }
  }
}

// ─── Token Functions ──────────────────────────────────────────────────────────

export async function generateOnboardingToken(
  payload: OnboardingTokenPayload,
): Promise<string> {
  const secret = await getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyOnboardingToken(
  token: string,
): Promise<OnboardingTokenPayload | null> {
  const secret = await getSecret();
  if (!secret.length) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return {
      clientId: payload['clientId'] as string,
      clientName: payload['clientName'] as string,
      email: payload['email'] as string,
    };
  } catch {
    return null;
  }
}

// ─── Code Functions ───────────────────────────────────────────────────────────

export async function generateOnboardingCode(
  clientId: string,
  clientName: string,
  email: string,
): Promise<string> {
  pruneExpiredCodes();
  const code = randomUUID();
  codeStore.set(code, {
    payload: { clientId, clientName, email },
    expiresAt: Date.now() + TTL_MS,
    exchanged: false,
  });
  return code;
}

export async function exchangeCode(
  code: string,
): Promise<{ token: string; payload: OnboardingTokenPayload } | null> {
  pruneExpiredCodes();
  const entry = codeStore.get(code);
  if (!entry || entry.expiresAt <= Date.now() || entry.exchanged) {
    codeStore.delete(code);
    return null;
  }
  entry.exchanged = true;
  codeStore.delete(code);
  const token = await generateOnboardingToken(entry.payload);
  return { token, payload: entry.payload };
}

// ─── Middleware Helper ────────────────────────────────────────────────────────

export async function requireOnboardingAuth(
  request: NextRequest,
): Promise<{ payload: OnboardingTokenPayload } | { error: string; status: number }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }
  const token = authHeader.slice(7);
  const payload = await verifyOnboardingToken(token);
  if (!payload) {
    return { error: 'Invalid or expired token', status: 401 };
  }
  return { payload };
}
