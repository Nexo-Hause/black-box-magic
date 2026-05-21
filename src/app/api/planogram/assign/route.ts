import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { resolveSession } from '@/lib/auth/session';
import { scopedQuery } from '@/lib/tenant/scope';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
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
    // 4. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido, se esperaba JSON.', status: 400 },
        { status: 400 },
      );
    }

    const { planogram_id, form_id } = body;

    // Validate fields
    if (!planogram_id || !planogram_id.trim() || !form_id || !form_id.trim()) {
      return NextResponse.json(
        { error: 'Los campos planogram_id y form_id son requeridos.', status: 400 },
        { status: 400 },
      );
    }

    const cleanPlanogramId = planogram_id.trim();
    const cleanFormId = form_id.trim();

    // 5. Query planogram using scopedQuery to enforce tenancy boundaries
    let planogramBuilder = supabase
      .from('bbm_planograms')
      .select('id, name, active')
      .eq('id', cleanPlanogramId);

    planogramBuilder = scopedQuery(planogramBuilder, session, {});

    const { data: planogram, error: planogramErr } = await planogramBuilder.maybeSingle();

    if (planogramErr) {
      console.error('Error al verificar planograma:', planogramErr.message);
      return NextResponse.json(
        { error: `Error al consultar planograma: ${planogramErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 404 if not found or belongs to another tenant
    if (!planogram) {
      return NextResponse.json(
        { error: 'Planograma no encontrado o no autorizado.', status: 404 },
        { status: 404 },
      );
    }

    // 6. Check for duplicate form_id assignments on active planograms
    // Join with bbm_planograms to see if the assigned planogram is active
    const { data: duplicate, error: duplicateErr } = await supabase
      .from('bbm_planogram_assignments')
      .select('planogram_id, form_id, bbm_planograms!inner(name, active)')
      .eq('form_id', cleanFormId)
      .eq('bbm_planograms.active', true)
      .maybeSingle();

    if (duplicateErr) {
      console.error('Error al checar duplicados de asignación:', duplicateErr.message);
      return NextResponse.json(
        { error: `Error al verificar asignación existente: ${duplicateErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    if (duplicate && duplicate.planogram_id !== cleanPlanogramId) {
      const planogramName = (duplicate.bbm_planograms as any)?.name || 'otro planograma';
      return NextResponse.json(
        {
          error: `El formulario ya está asignado al planograma activo: ${planogramName}`,
          status: 409,
        },
        { status: 409 },
      );
    }

    // 7. Perform the upsert atomic operation
    const { error: upsertErr } = await supabase
      .from('bbm_planogram_assignments')
      .upsert(
        { planogram_id: cleanPlanogramId, form_id: cleanFormId },
        { onConflict: 'planogram_id' }
      );

    if (upsertErr) {
      console.error('Error al guardar asignación:', upsertErr.message);
      return NextResponse.json(
        { error: `Error al guardar la asignación: ${upsertErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Planograma asignado exitosamente.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Asignación de planograma falló:', message);
    return NextResponse.json(
      { error: `Error interno: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
