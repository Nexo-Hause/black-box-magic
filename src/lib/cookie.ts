import 'server-only';
import { createHmac } from 'crypto';

import { COOKIE_NAME } from './constants';

const SECRET = process.env.BBM_COOKIE_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.error('WARNING: BBM_COOKIE_SECRET must be set and at least 32 characters — cookie auth disabled');
}
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

interface CookiePayload {
  email: string;
  timestamp: number;
}

export function signCookie(email: string): string {
  if (!SECRET || SECRET.length < 32) {
    throw new Error('BBM_COOKIE_SECRET not configured — cannot sign cookies');
  }
  const timestamp = Date.now();
  const data = `${email}:${timestamp}`;
  const signature = createHmac('sha256', SECRET).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ email, timestamp, signature })).toString('base64url');
}

export function verifyCookie(cookieValue: string): CookiePayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(cookieValue, 'base64url').toString());
    const { email, timestamp, signature } = decoded;

    if (!email || !timestamp || !signature) return null;

    // Verify HMAC
    if (!SECRET) return null;
    const expected = createHmac('sha256', SECRET).update(`${email}:${timestamp}`).digest('hex');
    if (signature !== expected) return null;

    // Verify expiration (server-side)
    const ageMs = Date.now() - timestamp;
    if (ageMs > MAX_AGE_SECONDS * 1000) return null;

    return { email, timestamp };
  } catch {
    return null;
  }
}

export function getCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}

export { COOKIE_NAME };
