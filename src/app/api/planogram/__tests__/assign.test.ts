import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../assign/route';
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
function mockSupabaseQuery(data: any, error: any = null) {
  const query: any = {
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    upsert: vi.fn(() => query),
    single: vi.fn(() => query),
  };
  query.then = (onfulfilled: any) =>
    Promise.resolve({ data, error }).then(onfulfilled);
  return query;
}

describe('POST /api/planogram/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 401 si no hay cookie de sesión', async () => {
    const req = new NextRequest('http://localhost/api/planogram/assign', {
      method: 'POST',
      body: JSON.stringify({ planogram_id: 'p-1', form_id: 'f-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar 400 si los campos requeridos no están provistos', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-1',
      clientId: 'cli-1',
    });

    const req = new NextRequest('http://localhost/api/planogram/assign', {
      method: 'POST',
      headers: { cookie: 'bbm_email_session=token' },
      body: JSON.stringify({ planogram_id: 'p-1' }), // falta form_id
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe retornar 404 si el planograma no existe o pertenece a otra tenencia (enumeración protejida)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-1',
      clientId: 'cli-1',
    });

    // Mock planograma no encontrado (retorna null en el scope de su cliente)
    const planogramQuery = mockSupabaseQuery(null);
    vi.mocked(supabase!.from).mockReturnValue(planogramQuery as any);

    const req = new NextRequest('http://localhost/api/planogram/assign', {
      method: 'POST',
      headers: { cookie: 'bbm_email_session=token' },
      body: JSON.stringify({ planogram_id: 'p-AJENO', form_id: 'f-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(planogramQuery.eq).toHaveBeenCalledWith('client_id', 'cli-1');
  });

  it('debe retornar 409 si el form_id ya está asignado a otro planograma activo', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-1',
      clientId: 'cli-1',
    });

    // Mock de supabase.from:
    // 1. Consulta el planograma (existe en su scope)
    // 2. Consulta el assignment duplicado (existe y está activo)
    const planogramQuery = mockSupabaseQuery({ id: 'p-1', name: 'Planograma Actual', active: true });
    const duplicateQuery = mockSupabaseQuery({
      planogram_id: 'p-OTRO',
      form_id: 'f-duplicado',
      bbm_planograms: { name: 'Planograma Duplicado', active: true },
    });

    vi.mocked(supabase!.from).mockImplementation((table: string) => {
      if (table === 'bbm_planograms') return planogramQuery as any;
      if (table === 'bbm_planogram_assignments') return duplicateQuery as any;
      return mockSupabaseQuery(null) as any;
    });

    const req = new NextRequest('http://localhost/api/planogram/assign', {
      method: 'POST',
      headers: { cookie: 'bbm_email_session=token' },
      body: JSON.stringify({ planogram_id: 'p-1', form_id: 'f-duplicado' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Planograma Duplicado');
  });

  it('debe realizar el upsert exitosamente si todo es válido', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-1',
      clientId: 'cli-1',
    });

    const planogramQuery = mockSupabaseQuery({ id: 'p-1', name: 'Planograma Actual', active: true });
    const duplicateQuery = mockSupabaseQuery(null); // sin duplicado activo
    const upsertQuery = mockSupabaseQuery({ planogram_id: 'p-1', form_id: 'f-1' });

    vi.mocked(supabase!.from).mockImplementation((table: string) => {
      if (table === 'bbm_planograms') return planogramQuery as any;
      if (table === 'bbm_planogram_assignments') {
        // Distinguir entre consulta y mutación
        return (duplicateQuery.upsert ? upsertQuery : duplicateQuery) as any;
      }
      return mockSupabaseQuery(null) as any;
    });

    const req = new NextRequest('http://localhost/api/planogram/assign', {
      method: 'POST',
      headers: { cookie: 'bbm_email_session=token' },
      body: JSON.stringify({ planogram_id: 'p-1', form_id: 'f-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      { planogram_id: 'p-1', form_id: 'f-1' },
      { onConflict: 'planogram_id' }
    );
  });
});
