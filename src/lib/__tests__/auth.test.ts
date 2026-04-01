/**
 * API key authentication — unit tests
 *
 * Tests the authenticate() function with timing-safe comparison.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authenticate } from '@/lib/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set('Authorization', authHeader);
  }
  return new Request('https://api.example.com/analyze', { headers });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('authenticate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BBM_API_KEYS = 'client1:abc123,client2:def456';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts a correct token and returns the client label', () => {
    const result = authenticate(makeRequest('Bearer abc123'));
    expect(result.authenticated).toBe(true);
    expect(result.client).toBe('client1');
    expect(result.error).toBeUndefined();
  });

  it('accepts the second configured key', () => {
    const result = authenticate(makeRequest('Bearer def456'));
    expect(result.authenticated).toBe(true);
    expect(result.client).toBe('client2');
  });

  it('accepts keys without labels (uses "default")', () => {
    process.env.BBM_API_KEYS = 'simple-key-no-label';
    const result = authenticate(makeRequest('Bearer simple-key-no-label'));
    expect(result.authenticated).toBe(true);
    expect(result.client).toBe('default');
  });

  it('rejects a wrong token', () => {
    const result = authenticate(makeRequest('Bearer wrong-token'));
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('rejects tokens with different length (timing-safe)', () => {
    // This verifies the length check before timingSafeEqual
    const result = authenticate(makeRequest('Bearer short'));
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('rejects missing Authorization header', () => {
    const result = authenticate(makeRequest());
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Missing Authorization header');
  });

  it('rejects empty bearer token (Bearer with no key)', () => {
    // 'Bearer ' after regex replace and trim becomes '' which fails key matching
    const result = authenticate(makeRequest('Bearer '));
    expect(result.authenticated).toBe(false);
    // Empty string after extraction still goes through key comparison and fails
    expect(result.error).toBeDefined();
  });

  it('rejects a bare "Bearer" header with no token value', () => {
    // Just the word "Bearer" with nothing after it
    const result = authenticate(makeRequest('Bearer'));
    expect(result.authenticated).toBe(false);
  });

  it('rejects when no API keys are configured', () => {
    process.env.BBM_API_KEYS = '';
    const result = authenticate(makeRequest('Bearer abc123'));
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('No API keys configured on server');
  });

  it('handles Bearer prefix case-insensitively', () => {
    const result = authenticate(makeRequest('bearer abc123'));
    expect(result.authenticated).toBe(true);
    expect(result.client).toBe('client1');
  });

  it('trims whitespace from keys', () => {
    process.env.BBM_API_KEYS = 'test: spaced-key ';
    const result = authenticate(makeRequest('Bearer spaced-key'));
    expect(result.authenticated).toBe(true);
    expect(result.client).toBe('test');
  });
});
