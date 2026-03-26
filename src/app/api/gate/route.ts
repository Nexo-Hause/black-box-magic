import { NextRequest, NextResponse } from 'next/server';
import { signCookie, getCookieOptions, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';

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

  // Upsert user in Supabase
  if (supabase) {
    try {
      const { error } = await supabase
        .from('bbm_users')
        .upsert(
          { email, last_seen_at: new Date().toISOString() },
          { onConflict: 'email' }
        );
      if (error) console.error('Failed to upsert bbm_user:', error.message);
    } catch (e) {
      console.error('Supabase upsert exception:', e);
    }
  }

  // Sign and set cookie
  const token = signCookie(email);
  const opts = getCookieOptions();

  const response = NextResponse.json({ success: true, email });
  response.cookies.set(opts.name, token, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });

  return response;
}
