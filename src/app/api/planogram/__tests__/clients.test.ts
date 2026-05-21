import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../clients/route';
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
  };
  query.then = (onfulfilled: any) =>
    Promise.resolve({ data, error }).then(onfulfilled);
  return query;
}

describe('GET /api/planogram/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 401 si no hay cookie de sesión', async () => {
    const req = new NextRequest('http://localhost/api/planogram/clients');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Ingresa tu email primero');
  });

  it('debe retornar 403 si la sesión no es válida (resolveSession -> null)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'ghost@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/planogram/clients', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Acceso no autorizado');
  });

  it('client_user -> debe retornar solo su propio cliente', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'acc-ubiqo',
      clientId: 'cli-fotl',
    });

    const mockClients = [{ id: 'cli-fotl', name: 'Fruit of the Loom', client_key: 'fotl', account_id: 'acc-ubiqo' }];
    const query = mockSupabaseQuery(mockClients);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/clients', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(1);
    expect(body.clients[0].id).toBe('cli-fotl');
    expect(supabase!.from).toHaveBeenCalledWith('bbm_clients');
    expect(query.select).toHaveBeenCalledWith('id, name, client_key, account_id');
    expect(query.eq).toHaveBeenCalledWith('id', 'cli-fotl');
  });

  it('reseller_admin -> debe retornar todos los clientes de su account_id', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'enrique@ubiqo.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'enrique@ubiqo.com',
      role: 'reseller_admin',
      accountId: 'acc-ubiqo',
      clientId: null,
    });

    const mockClients = [
      { id: 'cli-fotl', name: 'Fruit of the Loom', client_key: 'fotl', account_id: 'acc-ubiqo' },
      { id: 'cli-other', name: 'Other Client', client_key: 'other', account_id: 'acc-ubiqo' },
    ];
    const query = mockSupabaseQuery(mockClients);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/clients', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(2);
    expect(supabase!.from).toHaveBeenCalledWith('bbm_clients');
    expect(query.select).toHaveBeenCalledWith('id, name, client_key, account_id');
    expect(query.eq).toHaveBeenCalledWith('account_id', 'acc-ubiqo');
  });

  it('bbm_admin -> debe retornar todos los clientes globales (sin filtrar account_id)', async () => {
    vi.mocked(verifyCookie).mockReturnValue({ email: 'gonzalo@x.com', timestamp: Date.now() });
    vi.mocked(resolveSession).mockResolvedValue({
      email: 'gonzalo@x.com',
      role: 'bbm_admin',
      accountId: null,
      clientId: null,
    });

    const mockClients = [
      { id: 'cli-fotl', name: 'Fruit of the Loom', client_key: 'fotl', account_id: 'acc-ubiqo' },
      { id: 'cli-other', name: 'Other Client', client_key: 'other', account_id: 'acc-other' },
    ];
    const query = mockSupabaseQuery(mockClients);
    vi.mocked(supabase!.from).mockReturnValue(query as any);

    const req = new NextRequest('http://localhost/api/planogram/clients', {
      headers: { cookie: 'bbm_email_session=token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(2);
    expect(supabase!.from).toHaveBeenCalledWith('bbm_clients');
    expect(query.select).toHaveBeenCalledWith('id, name, client_key, account_id');
    expect(query.eq).not.toHaveBeenCalled();
  });
});
