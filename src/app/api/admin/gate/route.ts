import { NextRequest, NextResponse } from 'next/server';
import { signCookie } from '@/lib/cookie';

const ADMIN_COOKIE = 'bbm_admin';
const ADMIN_EMAIL = 'gonzalo@integrador.pro';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  if (email !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Solo administradores pueden acceder' },
      { status: 403 },
    );
  }

  const token = signCookie(email);
  const response = NextResponse.json({ success: true, email });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  return response;
}
