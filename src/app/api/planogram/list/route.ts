import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { resolveSession } from '@/lib/auth/session';
import { scopedQuery } from '@/lib/tenant/scope';

export const maxDuration = 10;

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

  // 2. Supabase required for this endpoint
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado. No se pueden listar planogramas.', status: 503 },
      { status: 503 },
    );
  }

  // 3. Resolve tenant session (replaces DASHBOARD_ALLOWED_EMAILS)
  const session = await resolveSession(cookiePayload.email, supabase);
  if (!session) {
    return NextResponse.json(
      { error: 'Acceso no autorizado. Si consideras que es un error, por favor contacta al administrador de tu cuenta.', status: 403 },
      { status: 403 },
    );
  }

  try {
    // 4. Query active planograms
    let builder = supabase
      .from('bbm_planograms')
      .select('*, bbm_planogram_assignments(form_id)')
      .eq('active', true);
    builder = scopedQuery(builder, session, {});
    const { data: planograms, error: queryErr } = await builder
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
      (planograms || []).map(async (p: any) => {
        const bucket = p.storage_bucket || 'planograms';
        const { data: signedData } = await sb.storage
          .from(bucket)
          .createSignedUrl(p.storage_path, 3600); // 1 hour expiry

        const assignments = p.bbm_planogram_assignments;
        const formId = Array.isArray(assignments) && assignments.length > 0 ? assignments[0].form_id : null;

        return {
          id: p.id,
          client_id: p.client_id,
          client_key: p.client_key,
          name: p.name,
          section: p.section,
          storage_path: p.storage_path,
          storage_bucket: p.storage_bucket,
          file_type: p.file_type,
          file_size_bytes: p.file_size_bytes,
          uploaded_by: p.uploaded_by,
          active: p.active,
          created_at: p.created_at,
          signedUrl: signedData?.signedUrl || null,
          form_id: formId,
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
