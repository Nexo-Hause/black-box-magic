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
      { error: 'No tienes permisos para ver el estado de planogramas.', status: 403 },
      { status: 403 },
    );
  }

  // 3. Supabase required for this endpoint
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado. No se puede consultar el estado.', status: 503 },
      { status: 503 },
    );
  }

  try {
    // 4. Query incidence counts grouped by status
    const { data: statusCounts, error: countErr } = await supabase
      .from('bbm_incidences')
      .select('status');

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
    const { data: lastCompletedRow, error: lastErr } = await supabase
      .from('bbm_incidences')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('Error al consultar última incidencia completada:', lastErr.message);
    }

    const lastCompleted = lastCompletedRow?.completed_at || null;

    // 6. Query active planogram count
    const { count: activePlanograms, error: planogramErr } = await supabase
      .from('bbm_planograms')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);

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
