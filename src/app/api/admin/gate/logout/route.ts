import { NextResponse } from 'next/server';

const ADMIN_COOKIE = 'bbm_admin';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
