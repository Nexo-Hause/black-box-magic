import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { resolveSession } from '@/lib/auth/session';
import { scopedQuery } from '@/lib/tenant/scope';
import { buildIncidencesWorkbook } from '@/lib/exports/incidences-excel';
import * as XLSX from 'xlsx';

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

    // 8. Execute count query to verify the defensive 5,000-record limit
    const { count: totalCount, error: countErr } = await countBuilder;
    if (countErr) {
      console.error('Error al totalizar incidencias:', countErr.message);
      return NextResponse.json(
        { error: `Error al totalizar incidencias: ${countErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    const maxRecords = 5000;
    if (totalCount && totalCount > maxRecords) {
      return NextResponse.json(
        {
          error: `Demasiadas filas; aplicá más filtros para reducir a menos de ${maxRecords} registros. Total actual: ${totalCount}`,
          status: 413
        },
        { status: 413 },
      );
    }

    // 9. Execute data query for the entire matching dataset (up to 5,000 rows)
    builder = builder.order('photo_captured_at', { ascending: sort === 'captured_asc' });
    const { data: rows, error: queryErr } = await builder;
    if (queryErr) {
      console.error('Error al consultar incidencias para exportación:', queryErr.message);
      return NextResponse.json(
        { error: `Error al consultar incidencias: ${queryErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 10. Generate the Excel workbook on the server-side
    const workbook = buildIncidencesWorkbook(rows || []);
    
    // Write workbook to a binary buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Format current date in America/Mexico_City for filename
    const dateStamp = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()).replace(/\//g, '-');

    const filename = `incidencias-${dateStamp}.xlsx`;

    // 11. Respond with the spreadsheet file and correct download headers
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('GET incidences export falló:', message);
    return NextResponse.json(
      { error: `Error interno: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
