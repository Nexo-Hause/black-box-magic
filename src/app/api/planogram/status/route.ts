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
      { error: 'Supabase no configurado. No se puede consultar el estado.', status: 503 },
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
    // 4. Query incidence counts grouped by status
    let statusBuilder = supabase.from('bbm_incidences').select('status');
    statusBuilder = scopedQuery(statusBuilder, session, {});
    const { data: statusCounts, error: countErr } = await statusBuilder;

    if (countErr) {
      console.error('Error al consultar incidencias:', countErr.message);
      return NextResponse.json(
        { error: `Error al consultar incidencias: ${countErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of statusCounts || []) {
      const s = row.status as keyof typeof counts;
      if (s in counts) {
        counts[s]++;
      }
    }

    // 5. Query last completed timestamp
    let lastBuilder = supabase.from('bbm_incidences').select('processed_at').eq('status', 'completed');
    lastBuilder = scopedQuery(lastBuilder, session, {});
    const { data: lastCompletedRow, error: lastErr } = await lastBuilder
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('Error al consultar última incidencia completada:', lastErr.message);
    }

    const lastCompleted = lastCompletedRow?.processed_at || null;

    // 6. Query active planogram count
    let planogramBuilder = supabase.from('bbm_planograms').select('id', { count: 'exact', head: true }).eq('active', true);
    planogramBuilder = scopedQuery(planogramBuilder, session, {});
    const { count: activePlanograms, error: planogramErr } = await planogramBuilder;

    if (planogramErr) {
      console.error('Error al contar planogramas activos:', planogramErr.message);
    }

    return NextResponse.json({
      success: true,
      counts,
      lastCompleted,
      activePlanograms: activePlanograms ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Consulta de estado falló:', message);
    return NextResponse.json(
      { error: `Error al consultar estado: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
