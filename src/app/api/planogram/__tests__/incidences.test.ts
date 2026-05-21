import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getIncidences } from '../incidences/route';
import { GET as getIncidenceDetail } from '../incidences/[id]/route';
import { verifyCookie } from '@/lib/cookie';
import { resolveSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase';
import { getSignedUrl, getSignedUrls } from '@/lib/planogram/storage';

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

vi.mock('@/lib/planogram/storage', () => ({
  getSignedUrl: vi.fn(),
  getSignedUrls: vi.fn(),
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

describe('GET /api/planogram/incidences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 401 si no hay cookie de sesión', async () => {
    const req = new NextRequest('http://localhost/api/planogram/incidences');
    const res = await getIncidences(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar 403 si el usuario no tiene sesión válida', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'ghost@x.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/planogram/incidences', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await getIncidences(req);
    expect(res.status).toBe(403);
  });

  it('client_user -> debe retornar solo incidencias de su client_id', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const mockRows = [{ id: 'inc-1', client_id: 'cli-fotl' }];
    const query = mockSupabaseQuery(mockRows, 1);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/incidences?clientId=cli-AJENA', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await getIncidences(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-fotl');
    expect(query.eq).not.toHaveBeenCalledWith('client_id', 'cli-AJENA');
  });

  it('debe aplicar filtros adicionales y paginación con clamping de limit', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'gonzalo@x.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'gonzalo@x.com',
      role: 'bbm_admin',
      accountId: null,
      clientId: null,
    });

    const query = mockSupabaseQuery([], 0);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest(
      'http://localhost/api/planogram/incidences?promoter=Jose&store=Oxxo&minSeverity=high&status=completed&limit=500&offset=10&sort=captured_asc',
      { headers: { cookie: 'bbm_email_session=token' } },
    );
    const res = await getIncidences(req);
    expect(res.status).toBe(200);

    // Limit debe clampear a 200
    expect(query.range).toHaveBeenCalledWith(10, 10 + 200 - 1);
    // Promoter ilike
    expect(query.ilike).toHaveBeenCalledWith('promoter_name', '%Jose%');
    // Store ilike
    expect(query.ilike).toHaveBeenCalledWith('store_name', '%Oxxo%');
    // minSeverity -> high (critical or high)
    expect(query.or).toHaveBeenCalledWith('severity_critical.gt.0,severity_high.gt.0');
    // status
    expect(query.eq).toHaveBeenCalledWith('status', 'completed');
    // sort asc
    expect(query.order).toHaveBeenCalledWith('photo_captured_at', { ascending: true });
  });
});

describe('GET /api/planogram/incidences/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 404 si la incidencia no existe o pertenece a otro tenant (leak prevention)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const query = mockSupabaseQuery(null); // maybeSingle retorna null
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/incidences/inc-AJENO', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await getIncidenceDetail(req, { params: { id: 'inc-AJENO' } });
    expect(res.status).toBe(404);
    expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-fotl');
  });

  it('debe retornar detalle completo con signed URLs si pertenece al scope', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const mockIncidence = {
      id: 'inc-123',
      client_id: 'cli-fotl',
      field_photo_paths: ['path1.jpg', 'path2.jpg'],
      bbm_planograms: {
        storage_path: 'ref-planogram.jpg',
      },
    };

    const query = mockSupabaseQuery(mockIncidence);
    vi.mocked(supabase!.from).mockReturnValue(query as any);
    vi.mocked(getSignedUrls).mockResolvedValue({ 'path1.jpg': 'signed1', 'path2.jpg': 'signed2' });
    vi.mocked(getSignedUrl).mockResolvedValue('signed-ref');

    const req = new NextRequest('http://localhost/api/planogram/incidences/inc-123', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await getIncidenceDetail(req, { params: { id: 'inc-123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.incidence.fieldPhotoUrls).toEqual(['signed1', 'signed2']);
    expect(body.incidence.planogramUrl).toBe('signed-ref');
    expect(getSignedUrls).toHaveBeenCalledWith(['path1.jpg', 'path2.jpg'], 1800);
    expect(getSignedUrl).toHaveBeenCalledWith('ref-planogram.jpg', 1800);
  });
});
