import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as exportIncidences } from '../export/route';
import { GET as getIncidences } from '../incidences/route';
import { GET as getIncidenceDetail } from '../incidences/[id]/route';
import { verifyCookie } from '@/lib/cookie';
import { resolveSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase';
import { buildIncidencesWorkbook } from '@/lib/exports/incidences-excel';
import { getSignedUrl, getSignedUrls } from '@/lib/planogram/storage';
import { IncidenceRecord } from '@/types/incidence';
import * as XLSX from 'xlsx';

// Mock authorization and Supabase to run fully controlled security simulations
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

// Helper to mock chainable Supabase QueryBuilder
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

describe('🛡️ BBM Bulletproof Security & Reliability Suite (WS2 + WS3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // ESCENARIO A: PREVENCIÓN DE ACCESO CRUZADO (CROSS-TENANT DATA LEAKS)
  // ==========================================================================
  describe('A. Prevención de Fugas de Información Cross-Tenant', () => {
    
    it('Debe neutralizar intentos de inyección de clientId malicioso por parte de un client_user', async () => {
      // Simula a Carlos (FOTL) logueado con cookie válida
      vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'carlos@fotl.com',
        role: 'client_user',
        accountId: 'acc-ubiqo',
        clientId: 'cli-fotl', // Su ID real
      });

      const query = mockSupabaseQuery([], 0);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      // Carlos intenta solicitar datos del cliente competidor (Hanes) inyectando 'cli-hanes'
      const req = new NextRequest('http://localhost/api/planogram/incidences?clientId=cli-hanes', {
        headers: { cookie: 'bbm_email_session=token' },
      });

      const res = await getIncidences(req);
      expect(res.status).toBe(200);

      // ASSERT CRÍTICO: El backend DEBE ignorar 'cli-hanes' y filtrar estrictamente por 'cli-fotl'
      expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-fotl');
      expect(query.eq).not.toHaveBeenCalledWith('client_id', 'cli-hanes');
    });

    it('Debe retornar un código HTTP 404 al intentar ver el detalle de una incidencia ajena para evitar enumeración', async () => {
      // Simula a Carlos (FOTL)
      vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'carlos@fotl.com',
        role: 'client_user',
        accountId: 'acc-ubiqo',
        clientId: 'cli-fotl',
      });

      // La consulta a Supabase no arroja resultados porque se filtra con su client_id
      const query = mockSupabaseQuery(null);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      // Carlos intenta abrir una incidencia que pertenece a Hanes
      const req = new NextRequest('http://localhost/api/planogram/incidences/inc-hanes-123', {
        headers: { cookie: 'bbm_email_session=token' },
      });

      const res = await getIncidenceDetail(req, { params: { id: 'inc-hanes-123' } });
      
      // ASSERT CRÍTICO: Debe retornar 404 Not Found (no 403) para no confirmar la existencia del registro ajeno
      expect(res.status).toBe(404);
      expect(query.eq).toHaveBeenCalledWith('client_id', 'cli-fotl');
    });
  });

  // ==========================================================================
  // ESCENARIO B: EXCEL BOMB & CSV FORMULA INJECTION PREVENTION (DDE)
  // ==========================================================================
  describe('B. Sanitización de Celdas contra Inyección de Fórmulas CSV/DDE', () => {
    
    it('Debe prefijar con comilla simple (\') cualquier celda de texto que comience con caracteres de control de fórmula', () => {
      // Creamos un registro con valores maliciosos inyectados
      const mockIncidences: IncidenceRecord[] = [
        {
          id: 'inc-123',
          planogram_id: 'plano-123',
          client_id: 'cli-fotl',
          ubiqo_capture_id: null,
          promoter_name: '=cmd|\' /C calc\'!A1', // Intento de ejecución de calculadora (DDE attack)
          store_name: '+1+2',                    // Intento de suma aritmética al abrir
          photo_captured_at: '2026-05-21T10:00:00Z',
          field_photo_paths: [],
          status: 'completed',
          incidences: [
            {
              id: '1',
              category: 'missing_product',
              severity: 'critical',
              product: '@SUM(A1:A2)',            // Intento de inyección de fórmula @
              description: '-Daño físico',         // Intento de fórmula -
              location: '\tEstante 3',            // Tabulación peligrosa
            }
          ],
          incidence_count: 1,
          severity_critical: 1,
          severity_high: 0,
          severity_medium: 0,
          severity_low: 0,
          summary: '\rSalto de línea malicioso',
          photo_quality: 'good',
          coverage: 'full',
          processing_time_ms: 1500,
          model: 'gpt-4o',
          tokens_total: 1000,
          error_message: null,
          created_at: '2026-05-21T10:05:00Z',
          processed_at: '2026-05-21T10:05:00Z',
        }
      ];

      // Generamos el libro de Excel
      const workbook = buildIncidencesWorkbook(mockIncidences);

      // Leemos las celdas generadas en las hojas correspondientes
      const sheetResumen = workbook.Sheets['Resumen'];
      const sheetIncidencias = workbook.Sheets['Incidencias'];

      // ASSERT CRÍTICO: Todos los caracteres de fórmula deben estar sanitizados (prefijados con ')
      
      // Hoja Resumen
      expect(sheetResumen['B2'].v).toBe('\'=cmd|\' /C calc\'!A1'); // Promotor sanitizado
      expect(sheetResumen['C2'].v).toBe('\'+1+2');                 // Tienda sanitizada
      expect(sheetResumen['H2'].v).toBe('\'\rSalto de línea malicioso'); // Resumen sanitizado

      // Hoja Incidencias
      expect(sheetIncidencias['D2'].v).toBe('\'@SUM(A1:A2)');       // Producto sanitizado
      expect(sheetIncidencias['E2'].v).toBe('\'-Daño físico');      // Descripción sanitizada
      expect(sheetIncidencias['F2'].v).toBe('\'\tEstante 3');       // Ubicación sanitizada
    });
  });

  // ==========================================================================
  // ESCENARIO C: CONTROL DE RECURSOS DEL SERVIDOR (OUT-OF-MEMORY DEFENSE)
  // ==========================================================================
  describe('C. Protección contra Desbordamiento de Memoria (OOM) en Exportación', () => {
    
    it('Debe detener la exportación y retornar HTTP 413 si la consulta arroja más de 5,000 registros', async () => {
      // Simula a Gonzalo (BBM Admin) solicitando una consulta masiva
      vi.mocked(verifyCookie).mockReturnValue({ email: 'gonzalo@integrador.pro', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'gonzalo@integrador.pro',
        role: 'bbm_admin',
        accountId: null,
        clientId: null,
      });

      // Simulamos que el conteo de la base de datos reporta 5,001 registros
      const query = mockSupabaseQuery([], 5001);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/planogram/export', {
        headers: { cookie: 'bbm_email_session=token' },
      });

      const res = await exportIncidences(req);

      // ASSERT CRÍTICO: Debe bloquear el procesamiento pesado retornando HTTP 413
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain('Demasiadas filas; aplicá más filtros');
    });

    it('Debe permitir la exportación normal si la consulta está en el límite (≤ 5,000)', async () => {
      vi.mocked(verifyCookie).mockReturnValue({ email: 'gonzalo@integrador.pro', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'gonzalo@integrador.pro',
        role: 'bbm_admin',
        accountId: null,
        clientId: null,
      });

      // Simulamos 5,000 registros exactos (máximo permitido)
      const query = mockSupabaseQuery([], 5000);
      vi.mocked(supabase!.from).mockReturnValue(query as any);

      const req = new NextRequest('http://localhost/api/planogram/export', {
        headers: { cookie: 'bbm_email_session=token' },
      });

      const res = await exportIncidences(req);

      // ASSERT CRÍTICO: Debe continuar sin retornar 413
      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // ESCENARIO D: RESILIENCIA EN FIRMADO DE URLS (ROBUSTNESS)
  // ==========================================================================
  describe('D. Seguridad y Resiliencia en URLs Firmadas', () => {
    
    it('Debe generar las URLs firmadas con un TTL seguro de 1,800 segundos (30 minutos)', async () => {
      vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'carlos@fotl.com',
        role: 'client_user',
        accountId: 'acc-ubiqo',
        clientId: 'cli-fotl',
      });

      const mockIncidence = {
        id: 'inc-1',
        client_id: 'cli-fotl',
        field_photo_paths: ['photo1.png'],
        bbm_planograms: {
          storage_path: 'ref1.png',
        },
      };

      const query = mockSupabaseQuery(mockIncidence);
      vi.mocked(supabase!.from).mockReturnValue(query as any);
      vi.mocked(getSignedUrls).mockResolvedValue({ 'photo1.png': 'http://secure/photo1?token=xyz' });
      vi.mocked(getSignedUrl).mockResolvedValue('http://secure/ref1?token=abc');

      const req = new NextRequest('http://localhost/api/planogram/incidences/inc-1', {
        headers: { cookie: 'bbm_email_session=token' },
      });
      const res = await getIncidenceDetail(req, { params: { id: 'inc-1' } });
      expect(res.status).toBe(200);

       // ASSERT CRÍTICO: El TTL (segundo parámetro) debe ser estrictamente 1800 segundos
      expect(getSignedUrls).toHaveBeenCalledWith(['photo1.png'], 1800);
      expect(getSignedUrl).toHaveBeenCalledWith('ref1.png', 1800);
    });

    it('Debe pasar de forma directa URLs de fotos que ya inicien con http:// o https:// sin intentar firmarlas vía Supabase Storage', async () => {
      vi.mocked(verifyCookie).mockReturnValue({ email: 'carlos@fotl.com', timestamp: Date.now() });
      vi.mocked(resolveSession).mockResolvedValue({
        email: 'carlos@fotl.com',
        role: 'client_user',
        accountId: 'acc-ubiqo',
        clientId: 'cli-fotl',
      });

      const mockIncidence = {
        id: 'inc-2',
        client_id: 'cli-fotl',
        field_photo_paths: [
          'http://cloudfront.net/raw-photo.jpg',
          'storage-relative-photo.png'
        ],
        bbm_planograms: {
          storage_path: 'ref2.png',
        },
      };

      const query = mockSupabaseQuery(mockIncidence);
      vi.mocked(supabase!.from).mockReturnValue(query as any);
      vi.mocked(getSignedUrls).mockResolvedValue({ 'storage-relative-photo.png': 'http://secure/relative?token=xyz' });
      vi.mocked(getSignedUrl).mockResolvedValue('http://secure/ref2?token=abc');

      const req = new NextRequest('http://localhost/api/planogram/incidences/inc-2', {
        headers: { cookie: 'bbm_email_session=token' },
      });
      const res = await getIncidenceDetail(req, { params: { id: 'inc-2' } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.incidence.fieldPhotoUrls).toContain('http://cloudfront.net/raw-photo.jpg');
      expect(body.incidence.fieldPhotoUrls).toContain('http://secure/relative?token=xyz');

      // ASSERT CRÍTICO: getSignedUrls solo debió ser llamado con el path relativo, no con la URL completa
      expect(getSignedUrls).toHaveBeenCalledWith(['storage-relative-photo.png'], 1800);
      expect(getSignedUrls).not.toHaveBeenCalledWith(expect.arrayContaining(['http://cloudfront.net/raw-photo.jpg']), 1800);
    });
  });
});
