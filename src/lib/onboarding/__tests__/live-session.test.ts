import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEphemeralToken, LIVE_MODEL } from '../live-session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_API_KEY = 'AIzaSy_test_api_key_1234';
const FAKE_TOKEN = 'ya29.ephemeral_token_abcdef';
const FAKE_EXPIRE_TIME = '2099-01-01T00:30:00.000Z';

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateEphemeralToken', () => {
  it('returns token, expiresAt, and wsUrl on success', async () => {
    mockFetch(200, {
      name: FAKE_TOKEN,
      expireTime: FAKE_EXPIRE_TIME,
      newSessionExpireTime: '2099-01-01T00:01:00.000Z',
    });

    const result = await generateEphemeralToken(FAKE_API_KEY);

    expect(result.token).toBe(FAKE_TOKEN);
    expect(result.expiresAt).toBe(FAKE_EXPIRE_TIME);
    expect(result.wsUrl).toContain('wss://generativelanguage.googleapis.com');
    expect(result.wsUrl).toContain(encodeURIComponent(FAKE_TOKEN));
  });

  it('sends the request to the v1alpha auth_tokens endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: FAKE_TOKEN, expireTime: FAKE_EXPIRE_TIME }),
      text: async () => '{}',
    });
    vi.stubGlobal('fetch', fetchSpy);

    await generateEphemeralToken(FAKE_API_KEY);

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1alpha/auth_tokens');
    expect(url).toContain(FAKE_API_KEY);
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body as string);
    expect(body.authToken.uses).toBe(1);
    expect(body.authToken.liveConnectConstraints.model).toBe(LIVE_MODEL);
  });

  it('falls back to API key when endpoint returns 404', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(404, { error: { code: 404, message: 'Not found' } });

    const result = await generateEphemeralToken(FAKE_API_KEY);

    expect(result.token).toBe(FAKE_API_KEY);
    expect(result.wsUrl).toContain(encodeURIComponent(FAKE_API_KEY));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT safe for production'));

    consoleSpy.mockRestore();
  });

  it('falls back to API key when endpoint returns 501', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(501, { error: { code: 501, message: 'Not implemented' } });

    const result = await generateEphemeralToken(FAKE_API_KEY);

    expect(result.token).toBe(FAKE_API_KEY);
    consoleSpy.mockRestore();
  });

  it('throws on unexpected API error (non-404/501)', async () => {
    mockFetch(403, { error: { code: 403, message: 'API key invalid' } });

    await expect(generateEphemeralToken(FAKE_API_KEY)).rejects.toThrow(
      /auth_tokens API error \(403\)/,
    );
  });

  it('throws when response is missing the token name field', async () => {
    mockFetch(200, { expireTime: FAKE_EXPIRE_TIME }); // no `name`

    await expect(generateEphemeralToken(FAKE_API_KEY)).rejects.toThrow(
      /without a token name/,
    );
  });

  it('throws on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    );

    await expect(generateEphemeralToken(FAKE_API_KEY)).rejects.toThrow(
      /Network error calling auth_tokens API/,
    );
  });
});
