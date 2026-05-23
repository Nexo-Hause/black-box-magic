import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sessionPOST } from '@/app/api/onboarding/session/route';
import { POST as resumePOST } from '@/app/api/onboarding/session/resume/route';
import { POST as photosPOST } from '@/app/api/onboarding/photos/route';
import { GET as historyGET } from '@/app/api/onboarding/session/history/route';
import { supabase } from '@/lib/supabase';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';

beforeAll(() => {
  process.env.BBM_COOKIE_SECRET = TEST_SECRET;
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/onboarding/auth', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requireOnboardingAuth: vi.fn(),
  };
});

function mockSupabaseChain(data: any, error: any = null) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error })),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
  };
  chain.then = (onfulfilled: any) =>
    Promise.resolve({ data, error }).then(onfulfilled);
  return chain;
}

describe('Onboarding Phase 4 Endpoints Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/onboarding/session ──────────────────────────────────────────
  describe('POST /api/onboarding/session', () => {
    it('debe crear una nueva sesión draft exitosamente con email y clientName', async () => {
      const query = mockSupabaseChain(null); // No existing draft
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/onboarding/session', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rene@fruit.com',
          clientName: 'Fruit of the Loom Retail',
        }),
      });

      const res = await sessionPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sessionId).toBeDefined();
      expect(body.clientId).toContain('cli-fruit-of-the-loom-retail');
      expect(body.clientName).toBe('Fruit of the Loom Retail');
      expect(body.token).toBeDefined();

      expect(supabase!.from).toHaveBeenCalledWith('bbm_client_configs');
      expect(query.insert).toHaveBeenCalled();
    });

    it('debe reusar sesión draft existente si ya existe para el clientId', async () => {
      const existingSession = {
        id: 'existing-session-uuid',
        transcript: [{ role: 'assistant', content: 'Hola!' }],
        partial_config: { areas: [] },
        config: null,
        status: 'draft',
      };
      const query = mockSupabaseChain(existingSession);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/onboarding/session', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rene@fruit.com',
          clientName: 'Fruit of the Loom Retail',
        }),
      });

      const res = await sessionPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sessionId).toBe('existing-session-uuid');
      expect(body.transcript).toEqual(existingSession.transcript);
      expect(body.partialConfig).toEqual(existingSession.partial_config);
      expect(body.synthesizedConfig).toBeNull();
      expect(body.status).toBe('draft');
    });
  });

  // ─── POST /api/onboarding/session/resume ───────────────────────────────────
  describe('POST /api/onboarding/session/resume', () => {
    it('debe buscar sesiones por email y retornar la lista de clientes', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          client_id: 'cli-test',
          client_name: 'Test Client 1',
          status: 'draft',
          industry: 'qsr',
          updated_at: '2026-05-22T21:00:00Z',
        },
      ];
      const query = mockSupabaseChain(mockSessions);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/onboarding/session/resume', {
        method: 'POST',
        body: JSON.stringify({ email: 'rene@fruit.com' }),
      });

      const res = await resumePOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0].sessionId).toBe('session-1');
      expect(body.sessions[0].clientName).toBe('Test Client 1');
      expect(query.eq).toHaveBeenCalledWith('created_by', 'rene@fruit.com');
    });

    it('debe rehidratar estado por sessionId y generar token JWT fresco', async () => {
      const mockSession = {
        id: 'session-uuid-123',
        client_id: 'cli-kebab',
        client_name: 'Test Kebab Client',
        status: 'testing',
        industry: 'retail_btl',
        transcript: [{ role: 'user', content: 'Reglas' }],
        partial_config: { areas: [], sandbox_photos: [] },
        config: { globalScoringMethod: 'weighted' },
        created_by: 'rene@fruit.com',
      };
      const query = mockSupabaseChain(mockSession);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/onboarding/session/resume', {
        method: 'POST',
        body: JSON.stringify({ sessionId: '00000000-0000-4000-8000-000000000000' }),
      });

      const res = await resumePOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sessionId).toBe('session-uuid-123');
      expect(body.clientId).toBe('cli-kebab');
      expect(body.clientName).toBe('Test Kebab Client');
      expect(body.token).toBeDefined();
      expect(body.transcript).toEqual(mockSession.transcript);
      expect(body.partialConfig).toEqual(mockSession.partial_config);
      expect(body.synthesizedConfig).toEqual(mockSession.config);
      expect(body.status).toBe('testing');
    });
  });

  // ─── POST /api/onboarding/photos ───────────────────────────────────────────
  describe('POST /api/onboarding/photos', () => {
    it('debe persistir incrementalmente fotos del Sandbox en Supabase', async () => {
      vi.mocked(requireOnboardingAuth).mockResolvedValue({
        payload: {
          clientId: 'cli-test',
          clientName: 'Test Client',
          email: 'test@example.com',
        },
      } as any);

      const currentPartialConfig = { partial_config: { areas: [], isComplete: false } };
      const query = mockSupabaseChain(currentPartialConfig);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const mockPhotos = [
        { id: 'photo-1', fileName: 'test.jpg', rating: 'ok', feedback: 'Perfect' },
      ];

      const req = new NextRequest('http://localhost/api/onboarding/photos', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          sessionId: '00000000-0000-4000-8000-000000000000',
          photos: mockPhotos,
          iterationCount: 2,
        }),
      });

      const res = await photosPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      expect(supabase!.from).toHaveBeenCalledWith('bbm_client_configs');
      expect(query.update).toHaveBeenCalledWith({
        partial_config: {
          areas: [],
          isComplete: false,
          sandbox_photos: mockPhotos,
          iteration_count: 2,
        },
        updated_at: expect.any(String),
      });
    });
  });

  // ─── GET /api/onboarding/session/history ───────────────────────────────────
  describe('GET /api/onboarding/session/history', () => {
    it('debe obtener la lista de versiones y configuraciones históricas para el clientId', async () => {
      vi.mocked(requireOnboardingAuth).mockResolvedValue({
        payload: {
          clientId: 'cli-test',
          clientName: 'Test Client',
          email: 'test@example.com',
        },
      } as any);

      const mockHistory = [
        {
          id: 'v2-uuid',
          client_id: 'cli-test',
          client_name: 'Test Client',
          status: 'active',
          industry: 'retail_btl',
          version: 2,
          config: {},
          partial_config: {},
          created_at: '2026-05-22T22:00:00Z',
          updated_at: '2026-05-22T22:00:00Z',
        },
        {
          id: 'v1-uuid',
          client_id: 'cli-test',
          client_name: 'Test Client',
          status: 'archived',
          industry: 'retail_btl',
          version: 1,
          config: {},
          partial_config: {},
          created_at: '2026-05-22T20:00:00Z',
          updated_at: '2026-05-22T20:00:00Z',
        },
      ];

      const query = mockSupabaseChain(mockHistory);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/onboarding/session/history', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const res = await historyGET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.history).toHaveLength(2);
      expect(body.history[0].id).toBe('v2-uuid');
      expect(body.history[0].version).toBe(2);
      expect(body.history[1].id).toBe('v1-uuid');
      expect(body.history[1].version).toBe(1);

      expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-test');
    });
  });
});
