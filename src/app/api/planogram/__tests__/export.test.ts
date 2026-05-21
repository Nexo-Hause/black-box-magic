import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as exportIncidences } from '../export/route';
import { verifyCookie } from '@/lib/cookie';
import { resolveSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/cookie', () => ({
  verifyCookie: vi.fn(),
  COOKIE_NAME: 'bbm_email_session',
}));

vi.mock('@/lib/auth/session', () => ({
  resolveSession: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Helper to mock Supabase QueryBuilder in a chainable and awaitable way
function mockSupabaseQuery(data: any, count: number | null = null, error: any = null) {
  const query: any = {
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    ilike: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    gt: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
  };
  query.then = (onfulfilled: any) =>
    Promise.resolve({ data, error, count }).then(onfulfilled);
  return query;
}

describe('GET /api/planogram/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 401 si no hay cookie de sesión', async () => {
    const req = new NextRequest('http://localhost/api/planogram/export');
    const res = await exportIncidences(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar 403 si el usuario no tiene sesión válida (email no registrado)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'ghost@x.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/planogram/export', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await exportIncidences(req);
    expect(res.status).toBe(403);
  });

  it('client_user -> debe restringir la exportación a su client_id (prevención de fugas cruzadas)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const mockRows = [{ id: 'inc-1', client_id: 'cli-fotl', promoter_name: 'Juan', store_name: 'Soriana', incidences: [] }];
    const query = mockSupabaseQuery(mockRows, 1);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    // Intentar consultar un clientId ajeno en el query string
    const req = new NextRequest('http://localhost/api/planogram/export?clientId=cli-AJENA', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await exportIncidences(req);
    expect(res.status).toBe(200);

    // Debe aplicar el filtro por la tenencia correcta
    expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-fotl');
    expect(query.eq).not.toHaveBeenCalledWith('client_id', 'cli-AJENA');

    // Debe retornar un buffer de Excel XLSX
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="incidencias-');
  });

  it('debe retornar HTTP 413 si la consulta excede el tope defensivo de 5,000 registros', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'gonzalo@x.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'gonzalo@x.com',
      role: 'bbm_admin',
      accountId: null,
      clientId: null,
    });

    // Simulamos que el conteo exacto devuelve 5,001 registros
    const query = mockSupabaseQuery([], 5001);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/export', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await exportIncidences(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toContain('Demasiadas filas; aplicá más filtros');
  });

  it('debe generar el buffer Excel correctamente cuando está dentro de los límites', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const mockRows = [
      {
        id: 'inc-1',
        client_id: 'cli-fotl',
        promoter_name: 'Juan Pérez',
        store_name: 'Soriana Coyoacán',
        photo_captured_at: '2026-05-21T10:00:00Z',
        incidences: [
          {
            id: '1',
            category: 'missing_product',
            severity: 'critical',
            product: 'Playera XL',
            description: 'Faltante',
            location: 'Charola 2',
          }
        ],
        severity_critical: 1,
        severity_high: 0,
        severity_medium: 0,
        severity_low: 0,
        summary: 'Faltantes detectados',
        status: 'completed',
        created_at: '2026-05-21T10:05:00Z',
      }
    ];

    const query = mockSupabaseQuery(mockRows, 1);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/export', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await exportIncidences(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="incidencias-');
    
    // El arrayBuffer no debe estar vacío
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
