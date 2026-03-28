import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateOnboardingToken,
  verifyOnboardingToken,
  generateOnboardingCode,
  exchangeCode,
  requireOnboardingAuth,
} from '../auth';
import type { OnboardingTokenPayload } from '@/types/onboarding';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';

const mockRequest = (authHeader?: string): NextRequest =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (authHeader ?? null) : null,
    },
  } as unknown as NextRequest);

const samplePayload: OnboardingTokenPayload = {
  clientId: 'client-001',
  clientName: 'Test Client',
  email: 'test@example.com',
};

beforeAll(() => {
  process.env.BBM_COOKIE_SECRET = TEST_SECRET;
});

// ─── generateOnboardingToken ──────────────────────────────────────────────────

describe('generateOnboardingToken', () => {
  it('returns a string JWT', async () => {
    const token = await generateOnboardingToken(samplePayload);
    expect(typeof token).toBe('string');
    // JWTs have three dot-separated segments
    expect(token.split('.')).toHaveLength(3);
  });
});

// ─── verifyOnboardingToken ────────────────────────────────────────────────────

describe('verifyOnboardingToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await generateOnboardingToken(samplePayload);
    const result = await verifyOnboardingToken(token);
    expect(result).not.toBeNull();
    expect(result?.clientId).toBe(samplePayload.clientId);
    expect(result?.clientName).toBe(samplePayload.clientName);
    expect(result?.email).toBe(samplePayload.email);
  });

  it('returns null for an invalid token', async () => {
    const result = await verifyOnboardingToken('not.a.valid.jwt');
    expect(result).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const token = await generateOnboardingToken(samplePayload);
    const tampered = token.slice(0, -4) + 'XXXX';
    const result = await verifyOnboardingToken(tampered);
    expect(result).toBeNull();
  });
});

// ─── generateOnboardingCode ───────────────────────────────────────────────────

describe('generateOnboardingCode', () => {
  it('returns a UUID string', async () => {
    const code = await generateOnboardingCode(
      samplePayload.clientId,
      samplePayload.clientName,
      samplePayload.email,
    );
    expect(typeof code).toBe('string');
    // UUID v4 regex
    expect(code).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

// ─── exchangeCode ─────────────────────────────────────────────────────────────

describe('exchangeCode', () => {
  it('returns token and payload for a valid code', async () => {
    const code = await generateOnboardingCode(
      samplePayload.clientId,
      samplePayload.clientName,
      samplePayload.email,
    );
    const result = await exchangeCode(code);
    expect(result).not.toBeNull();
    expect(typeof result?.token).toBe('string');
    expect(result?.payload.clientId).toBe(samplePayload.clientId);
    expect(result?.payload.clientName).toBe(samplePayload.clientName);
    expect(result?.payload.email).toBe(samplePayload.email);
  });

  it('returns null for an invalid / unknown code', async () => {
    const result = await exchangeCode('00000000-0000-4000-8000-000000000000');
    expect(result).toBeNull();
  });

  it('deletes the code after use — second call returns null', async () => {
    const code = await generateOnboardingCode(
      samplePayload.clientId,
      samplePayload.clientName,
      samplePayload.email,
    );
    const first = await exchangeCode(code);
    expect(first).not.toBeNull();

    const second = await exchangeCode(code);
    expect(second).toBeNull();
  });
});

// ─── requireOnboardingAuth ────────────────────────────────────────────────────

describe('requireOnboardingAuth', () => {
  it('returns payload for a valid Bearer token', async () => {
    const token = await generateOnboardingToken(samplePayload);
    const request = mockRequest(`Bearer ${token}`);
    const result = await requireOnboardingAuth(request);
    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.clientId).toBe(samplePayload.clientId);
    }
  });

  it('returns error for a missing Authorization header', async () => {
    const request = mockRequest(undefined);
    const result = await requireOnboardingAuth(request);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('returns error for a non-Bearer Authorization header', async () => {
    const request = mockRequest('Basic dXNlcjpwYXNz');
    const result = await requireOnboardingAuth(request);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('returns error for an invalid token', async () => {
    const request = mockRequest('Bearer invalid.token.here');
    const result = await requireOnboardingAuth(request);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });
});
