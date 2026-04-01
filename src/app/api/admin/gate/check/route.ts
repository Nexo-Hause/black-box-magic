import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie } from '@/lib/cookie';

const ADMIN_COOKIE = 'bbm_admin';
const ADMIN_EMAIL = process.env.BBM_ADMIN_EMAIL || 'gonzalo@integrador.pro';

export async function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(ADMIN_COOKIE)?.value;

  if (!cookieValue) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = verifyCookie(cookieValue);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const authorized = payload.email === ADMIN_EMAIL;
  return NextResponse.json({
    authenticated: true,
    authorized,
    email: payload.email,
  });
}
