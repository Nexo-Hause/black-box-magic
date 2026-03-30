/**
 * BBM Onboarding — Gemini Live API ephemeral token generation
 *
 * Generates short-lived tokens so the browser can connect directly to
 * the Gemini Live API via WebSocket without exposing the server API key.
 *
 * API reference: https://ai.google.dev/api/live#ephemeral-auth-tokens
 * Endpoint: POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

/**
 * Live API model. Must use v1alpha — ephemeral tokens are only supported there.
 * @see https://ai.google.dev/gemini-api/docs/live
 */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

/**
 * WebSocket endpoint for the Gemini Live BidiGenerateContent service.
 * The access_token query parameter carries the ephemeral token (or API key
 * in dev fallback mode).
 */
const LIVE_WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EphemeralTokenResponse {
  /** The ephemeral token value (use as access_token in the WebSocket URL). */
  token: string;
  /** ISO 8601 timestamp when the token expires. */
  expiresAt: string;
  /** Full WebSocket URL including the token — pass directly to the browser. */
  wsUrl: string;
}

/** Raw response shape from POST /v1alpha/auth_tokens */
interface AuthTokenApiResponse {
  name?: string;
  expire_time?: string;
  new_session_expire_time?: string;
}

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Generate an ephemeral token for browser-to-Gemini direct WebSocket
 * connection via the Live API.
 *
 * Calls POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens
 * with the server's GOOGLE_AI_API_KEY, then returns a short-lived token that
 * the browser can use without ever seeing the real API key.
 *
 * Token defaults: expires in 30 minutes, single-use session.
 *
 * @throws Error if the API call fails and no fallback is appropriate.
 */
export async function generateEphemeralToken(
  apiKey: string,
): Promise<EphemeralTokenResponse> {
  const url = `${GEMINI_BASE_URL}/v1alpha/auth_tokens?key=${apiKey}`;

  // Expire in 30 minutes — generous enough for a full onboarding session
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const requestBody = {
    expire_time: expireTime,
    uses: 1,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[live-session] Network error calling auth_tokens API: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');

    // 404 or 501 most likely means the endpoint is not yet GA in the region or
    // the API version doesn't support it — apply dev fallback.
    if (response.status === 404 || response.status === 501) {
      return devFallback(apiKey, expireTime);
    }

    throw new Error(
      `[live-session] auth_tokens API error (${response.status}): ${body}`,
    );
  }

  const data: AuthTokenApiResponse = await response.json();

  // `name` is the token value per the API discovery schema
  const token = data.name;
  if (!token) {
    throw new Error(
      '[live-session] auth_tokens API returned a response without a token name',
    );
  }

  const expiresAt = data.expire_time ?? expireTime;
  const wsUrl = buildWsUrl(token);

  return { token, expiresAt, wsUrl };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWsUrl(accessToken: string): string {
  return `${LIVE_WS_BASE}?access_token=${encodeURIComponent(accessToken)}`;
}

/**
 * Development fallback: return the raw API key as the "token".
 * This allows local development to work when the ephemeral token endpoint
 * is unavailable (e.g. not yet GA, regional restriction).
 *
 * WARNING: Never use in production — the API key would be exposed to the browser.
 */
function devFallback(apiKey: string, expireTime: string): EphemeralTokenResponse {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[live-session] Ephemeral token endpoint unavailable in production. ' +
        'Voice onboarding is temporarily disabled. Please try again later or use text mode.',
    );
  }
  console.warn(
    '[live-session] Ephemeral token endpoint unavailable — falling back to raw API key. ' +
      'This is NOT safe for production.',
  );
  return {
    token: apiKey,
    expiresAt: expireTime,
    wsUrl: buildWsUrl(apiKey),
  };
}
