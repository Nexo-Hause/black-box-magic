/**
 * Black Box Magic — API Key Authentication
 *
 * Simple bearer token auth. Keys are stored in env var as comma-separated values.
 * Each key can optionally have a label: "label:key"
 */

import { timingSafeEqual } from 'crypto';

export interface AuthResult {
  authenticated: boolean;
  client?: string;
  error?: string;
}

export function authenticate(request: Request): AuthResult {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { authenticated: false, error: 'Empty bearer token' };
  }

  const validKeys = (process.env.BBM_API_KEYS || '').split(',').filter(Boolean);

  if (validKeys.length === 0) {
    return { authenticated: false, error: 'No API keys configured on server' };
  }

  for (const entry of validKeys) {
    const [labelOrKey, maybeKey] = entry.split(':');
    const key = maybeKey || labelOrKey;
    const label = maybeKey ? labelOrKey : 'default';

    const tokenBuf = Buffer.from(token, 'utf8');
    const keyBuf = Buffer.from(key.trim(), 'utf8');
    if (tokenBuf.length === keyBuf.length && timingSafeEqual(tokenBuf, keyBuf)) {
      return { authenticated: true, client: label.trim() };
    }
  }

  return { authenticated: false, error: 'Invalid API key' };
}
