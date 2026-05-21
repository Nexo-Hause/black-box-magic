import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { resolveSession } from '@/lib/auth/session';
import { scopedQuery } from '@/lib/tenant/scope';
import { getSignedUrl, getSignedUrls } from '@/lib/planogram/storage';

export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Auth — require email cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const cookiePayload = cookieValue ? verifyCookie(cookieValue) : null;
  if (!cookiePayload) {
    return NextResponse.json(
      { error: 'Se requiere email. Ingresa tu email primero.', status: 401 },
      { status: 401 },
    );
  }

  // 2. Supabase required
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado.', status: 503 },
      { status: 503 },
    );
  }

  // 3. Resolve tenant session
  const session = await resolveSession(cookiePayload.email, supabase);
  if (!session) {
    return NextResponse.json(
      { error: 'Acceso no autorizado.', status: 403 },
      { status: 403 },
    );
  }

  try {
    const { id } = params;

    // 4. Fetch the incidence row, pre-scoped to prevent cross-tenant enumeration leakage!
    // We join bbm_planograms to retrieve its storage_path in one trip
    let builder = supabase
      .from('bbm_incidences')
      .select('*, bbm_planograms(storage_path)')
      .eq('id', id);

    builder = scopedQuery(builder, session, {});

    const { data: incidenceRow, error: queryErr } = await builder.maybeSingle();

    if (queryErr) {
      console.error(`Error al consultar incidencia ${id}:`, queryErr.message);
      return NextResponse.json(
        { error: `Error interno al consultar detalle: ${queryErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 5. If not found or outside user's tenant boundary, return HTTP 404 (don't reveal existence)
    if (!incidenceRow) {
      return NextResponse.json(
        { error: 'Incidencia no encontrada o no autorizada.', status: 404 },
        { status: 404 },
      );
    }

    // 6. Generate signed URLs on-the-fly for photos (TTL 1800s)
    let fieldPhotoUrls: string[] = [];
    if (incidenceRow.field_photo_paths && incidenceRow.field_photo_paths.length > 0) {
      fieldPhotoUrls = await getSignedUrls(incidenceRow.field_photo_paths, 1800);
    }

    let planogramUrl: string | null = null;
    const planogramPath = incidenceRow.bbm_planograms?.storage_path;
    if (planogramPath) {
      planogramUrl = await getSignedUrl(planogramPath, 1800);
    }

    // 7. Structure clean response without exposing raw storage paths
    const incidenceDetail = {
      ...incidenceRow,
      fieldPhotoUrls,
      planogramUrl,
      bbm_planograms: undefined, // cleanup join data
    };

    return NextResponse.json({
      success: true,
      incidence: incidenceDetail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`GET incidence detail ${params.id} falló:`, message);
    return NextResponse.json(
      { error: `Error interno: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
