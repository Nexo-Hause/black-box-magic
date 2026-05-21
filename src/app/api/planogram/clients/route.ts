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
      { error: 'Supabase no configurado. No se pueden obtener clientes.', status: 503 },
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
    // 4. Query clients with appropriate tenant scoping
    let builder = supabase.from('bbm_clients').select('id, name, client_key, account_id');

    if (session.role === 'client_user') {
      // client_user is locked to their specific client ID (which maps to id in bbm_clients)
      builder = builder.eq('id', session.clientId);
    } else {
      // For reseller_admin and bbm_admin, we can use scopedQuery safely on account_id
      builder = scopedQuery(builder, session, {});
    }

    const { data: clients, error: queryErr } = await builder;

    if (queryErr) {
      console.error('Error al consultar clientes:', queryErr.message);
      return NextResponse.json(
        { error: `Error al consultar clientes: ${queryErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      clients: clients || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('GET clients falló:', message);
    return NextResponse.json(
      { error: `Error interno: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
