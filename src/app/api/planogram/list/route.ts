import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';

export const maxDuration = 10;

// ─── Helpers ───

function isAllowedEmail(email: string): boolean {
  const allowlist = process.env.DASHBOARD_ALLOWED_EMAILS || '';
  if (!allowlist) return true; // If not configured, allow all authenticated users
  return allowlist.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase());
}

// ─── Route handler ───

export async function GET(request: NextRequest) {
  // 1. Auth — require email cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const cookiePayload = cookieValue ? verifyCookie(cookieValue) : null;
  if (!cookiePayload) {
    return NextResponse.json(
      { error: 'Se requiere email. Ingresa tu email primero.', status: 401 },
      { status: 401 },
    );
  }

  // 2. Allowlist check
  if (!isAllowedEmail(cookiePayload.email)) {
    return NextResponse.json(
      { error: 'No tienes permisos para ver planogramas.', status: 403 },
      { status: 403 },
    );
  }

  // 3. Supabase required for this endpoint
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado. No se pueden listar planogramas.', status: 503 },
      { status: 503 },
    );
  }

  try {
    // 4. Query active planograms
    const { data: planograms, error: queryErr } = await supabase
      .from('bbm_planograms')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (queryErr) {
      console.error('Error al consultar planogramas:', queryErr.message);
      return NextResponse.json(
        { error: `Error al consultar planogramas: ${queryErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 5. Generate signed URLs for each planogram
    // supabase is guaranteed non-null here (checked above), but TS doesn't narrow in closures
    const sb = supabase;
    const planogramsWithUrls = await Promise.all(
      (planograms || []).map(async (p) => {
        const bucket = p.storage_bucket || 'planograms';
        const { data: signedData } = await sb.storage
          .from(bucket)
          .createSignedUrl(p.storage_path, 3600); // 1 hour expiry

        return {
          ...p,
          signedUrl: signedData?.signedUrl || null,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      planograms: planogramsWithUrls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Listado de planogramas falló:', message);
    return NextResponse.json(
      { error: `Error al listar planogramas: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
