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

  // Fall back to HKDF derivation from cookie secret
  const cookieSecret = process.env.BBM_COOKIE_SECRET || '';
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error('[onboarding/auth] JWT secret not configured. Set BBM_JWT_SECRET or ensure BBM_COOKIE_SECRET is at least 32 chars.');
  }

  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(cookieSecret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('bbm_onboarding_v1'),
      info: encoder.encode('jwt-signing-key'),
    },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign', 'verify'],
  );
  return new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey));
}

async function getSecret(): Promise<Uint8Array> {
  if (!cachedSecret) {
    cachedSecret = await deriveSecret();
  }
  return cachedSecret;
}

// ─── Code Store (Supabase-backed, falls back to in-memory) ───────────────────

import { supabase } from '@/lib/supabase';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const memoryStore = new Map<string, { payload: OnboardingTokenPayload; expiresAt: number }>();

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

// ─── Code Functions (Supabase-backed with in-memory fallback) ────────────────

export async function generateOnboardingCode(
  clientId: string,
  clientName: string,
  email: string,
): Promise<string> {
  const code = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const payload = { clientId, clientName, email };

  if (supabase) {
    const { error } = await supabase.from('bbm_onboarding_codes').insert({
      code,
      payload,
      expires_at: expiresAt,
    });
    if (error) {
      console.warn('[onboarding/auth] Failed to store code in Supabase, using memory:', error.message);
      memoryStore.set(code, { payload, expiresAt: Date.now() + TTL_MS });
    }
  } else {
    memoryStore.set(code, { payload, expiresAt: Date.now() + TTL_MS });
  }

  return code;
}

export async function exchangeCode(
  code: string,
): Promise<{ token: string; payload: OnboardingTokenPayload } | null> {
  // Try Supabase first
  if (supabase) {
    const { data, error } = await supabase
      .from('bbm_onboarding_codes')
      .select('payload, expires_at')
      .eq('code', code)
      .maybeSingle();

    if (!error && data) {
      // Delete immediately (single-use)
      await supabase.from('bbm_onboarding_codes').delete().eq('code', code);

      if (new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
      }

      const payload = data.payload as OnboardingTokenPayload;
      const token = await generateOnboardingToken(payload);
      return { token, payload };
    }
  }

  // Fallback to memory
  const entry = memoryStore.get(code);
  if (!entry) return null;
  memoryStore.delete(code);
  if (entry.expiresAt <= Date.now()) return null;

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
