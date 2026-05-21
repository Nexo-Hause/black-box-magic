import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { resolveSession } from '@/lib/auth/session';
import { scopedQuery } from '@/lib/tenant/scope';

export const maxDuration = 30;

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
      { error: 'Supabase no configurado. No se pueden consultar incidencias.', status: 503 },
      { status: 503 },
    );
  }

  // 3. Resolve tenant session
  const session = await resolveSession(cookiePayload.email, supabase);
  if (!session) {
    return NextResponse.json(
      { error: 'Acceso no autorizado. Si consideras que es un error, por favor contacta al administrador de tu cuenta.', status: 403 },
      { status: 403 },
    );
  }

  try {
    // 4. Parse & sanitize parameters
    const { searchParams } = request.nextUrl;
    
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const promoter = searchParams.get('promoter');
    const store = searchParams.get('store');
    const minSeverity = searchParams.get('minSeverity');
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId') || undefined;
    
    // Sort
    const sort = searchParams.get('sort') === 'captured_asc' ? 'captured_asc' : 'captured_desc';
    
    // Offset & limit clamping
    let limit = parseInt(searchParams.get('limit') || '20', 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 200) limit = 200; // clamp max
    
    let offset = parseInt(searchParams.get('offset') || '0', 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    // 5. Build base queries
    let builder = supabase.from('bbm_incidences').select('*');
    let countBuilder = supabase.from('bbm_incidences').select('*', { count: 'exact', head: true });

    // 6. Apply tenant-scoping (Mandatory!)
    builder = scopedQuery(builder, session, { requestedClientId: clientId });
    countBuilder = scopedQuery(countBuilder, session, { requestedClientId: clientId });

    // 7. Apply optional business filters to both builders
    const applyFilters = (q: any) => {
      let filtered = q;
      
      if (dateFrom) {
        filtered = filtered.gte('photo_captured_at', dateFrom);
      }
      if (dateTo) {
        filtered = filtered.lte('photo_captured_at', dateTo);
      }
      if (promoter && promoter.trim()) {
        filtered = filtered.ilike('promoter_name', `%${promoter.trim()}%`);
      }
      if (store && store.trim()) {
        filtered = filtered.ilike('store_name', `%${store.trim()}%`);
      }
      if (status && status.trim()) {
        filtered = filtered.eq('status', status.trim());
      }
      
      // Severity threshold filter using PostgreSQL OR logic on counts
      if (minSeverity) {
        switch (minSeverity) {
          case 'critical':
            filtered = filtered.gt('severity_critical', 0);
            break;
          case 'high':
            filtered = filtered.or('severity_critical.gt.0,severity_high.gt.0');
            break;
          case 'medium':
            filtered = filtered.or('severity_critical.gt.0,severity_high.gt.0,severity_medium.gt.0');
            break;
          case 'low':
            filtered = filtered.or('severity_critical.gt.0,severity_high.gt.0,severity_medium.gt.0,severity_low.gt.0');
            break;
        }
      }
      
      return filtered;
    };

    builder = applyFilters(builder);
    countBuilder = applyFilters(countBuilder);

    // 8. Execute count query (without pagination limits)
    const { count: totalCount, error: countErr } = await countBuilder;
    if (countErr) {
      console.error('Error al totalizar incidencias:', countErr.message);
      return NextResponse.json(
        { error: `Error al totalizar incidencias: ${countErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 9. Apply ordering and range, then execute data query
    builder = builder.order('photo_captured_at', { ascending: sort === 'captured_asc' });
    builder = builder.range(offset, offset + limit - 1);
    
    const { data: rows, error: queryErr } = await builder;
    if (queryErr) {
      console.error('Error al consultar incidencias:', queryErr.message);
      return NextResponse.json(
        { error: `Error al consultar incidencias: ${queryErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      rows: rows || [],
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('GET incidences falló:', message);
    return NextResponse.json(
      { error: `Error interno: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
