import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileProcessingJobs, ReconcileDeps } from '../reconcile';

describe('Reconciliación de Estado (reconcile.ts)', () => {
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Helper para construir mock de Supabase con respuestas custom
  function createMockSupabase(config: {
    captures?: { data: any; error: any };
    incidences?: { data: any; error: any };
    updateCapture?: { data: any; error: any };
    updateIncidence?: { data: any; error: any };
  }) {
    const updateCaptureSpy = vi.fn().mockImplementation(() => {
      const chain = {
        eq: vi.fn().mockImplementation(() => {
          return {
            then: (resolve: any) => resolve(config.updateCapture || { data: null, error: null }),
          };
        }),
      };
      return chain;
    });

    const updateIncidenceSpy = vi.fn().mockImplementation(() => {
      const chain = {
        eq: vi.fn().mockImplementation(() => {
          return {
            then: (resolve: any) => resolve(config.updateIncidence || { data: null, error: null }),
          };
        }),
      };
      return chain;
    });

    const fromSpy = vi.fn((table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        update: table === 'bbm_ubiqo_captures' ? updateCaptureSpy : updateIncidenceSpy,
        then: (resolve: any) => {
          if (table === 'bbm_ubiqo_captures') {
            resolve(config.captures || { data: [], error: null });
          } else if (table === 'bbm_incidences') {
            resolve(config.incidences || { data: [], error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return chain;
    });

    return {
      supabase: { from: fromSpy } as any,
      updateCaptureSpy,
      updateIncidenceSpy,
    };
  }

  it('debe completar el ciclo sin hacer nada si no hay filas atascadas', async () => {
    const { supabase } = createMockSupabase({
      captures: { data: [], error: null },
      incidences: { data: [], error: null },
    });

    const mockUbiqoQueue = { getJob: vi.fn() } as any;
    const mockPlanogramQueue = { getJob: vi.fn() } as any;

    const result = await reconcileProcessingJobs({
      supabase,
      ubiqoQueue: mockUbiqoQueue,
      planogramQueue: mockPlanogramQueue,
    });

    expect(result.ubiqoRequeued).toBe(0);
    expect(result.planogramRequeued).toBe(0);
    expect(mockUbiqoQueue.getJob).not.toHaveBeenCalled();
    expect(mockPlanogramQueue.getJob).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RECONCILE_REQUEUED=0'));
  });

  it('debe mantener la captura en "processing" si el job en BullMQ sigue activo', async () => {
    // Fila stuck en la base de datos
    const stuckCaptures = [
      { id: 'cap-1', retry_count: 0, bullmq_job_id: 'job-ubiqo-1' },
    ];

    const { supabase, updateCaptureSpy } = createMockSupabase({
      captures: { data: stuckCaptures, error: null },
      incidences: { data: [], error: null },
    });

    // Mock de BullMQ para un trabajo activo ('active')
    const mockJob = {
      getState: vi.fn().mockResolvedValue('active'),
    };
    const mockUbiqoQueue = {
      getJob: vi.fn().mockResolvedValue(mockJob),
    } as any;
    const mockPlanogramQueue = { getJob: vi.fn() } as any;

    const result = await reconcileProcessingJobs({
      supabase,
      ubiqoQueue: mockUbiqoQueue,
      planogramQueue: mockPlanogramQueue,
    });

    expect(result.ubiqoRequeued).toBe(0);
    expect(mockUbiqoQueue.getJob).toHaveBeenCalledWith('job-ubiqo-1');
    expect(updateCaptureSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RECONCILE_REQUEUED=0'));
  });

  it('debe regresar la captura a "pending" si el job no está vivo y retry_count < 2', async () => {
    const stuckCaptures = [
      { id: 'cap-2', retry_count: 1, bullmq_job_id: 'job-ubiqo-2' },
    ];

    const { supabase, updateCaptureSpy } = createMockSupabase({
      captures: { data: stuckCaptures, error: null },
      incidences: { data: [], error: null },
    });

    // Mock de BullMQ para un trabajo completado
    const mockJob = {
      getState: vi.fn().mockResolvedValue('completed'),
    };
    const mockUbiqoQueue = {
      getJob: vi.fn().mockResolvedValue(mockJob),
    } as any;
    const mockPlanogramQueue = { getJob: vi.fn() } as any;

    const result = await reconcileProcessingJobs({
      supabase,
      ubiqoQueue: mockUbiqoQueue,
      planogramQueue: mockPlanogramQueue,
    });

    expect(result.ubiqoRequeued).toBe(1);
    expect(updateCaptureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
      })
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RECONCILE_REQUEUED=1'));
  });

  it('debe marcar la captura como "failed" permanentemente si el job no está vivo y retry_count >= 2', async () => {
    const stuckCaptures = [
      { id: 'cap-3', retry_count: 2, bullmq_job_id: 'job-ubiqo-3' },
    ];

    const { supabase, updateCaptureSpy } = createMockSupabase({
      captures: { data: stuckCaptures, error: null },
      incidences: { data: [], error: null },
    });

    // Mock de BullMQ: el job ya no existe en Redis (devuelve null)
    const mockUbiqoQueue = {
      getJob: vi.fn().mockResolvedValue(null),
    } as any;
    const mockPlanogramQueue = { getJob: vi.fn() } as any;

    const result = await reconcileProcessingJobs({
      supabase,
      ubiqoQueue: mockUbiqoQueue,
      planogramQueue: mockPlanogramQueue,
    });

    expect(result.ubiqoRequeued).toBe(0); // No se re-encoló
    expect(updateCaptureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_kind: 'permanent',
        error_log: expect.stringContaining('superó el límite de reintentos'),
      })
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RECONCILE_REQUEUED=0'));
  });

  it('debe reconciliar incidencias de planogramas a "pending" o "failed" de forma aislada', async () => {
    const stuckIncidences = [
      // Fila 1: debe volver a 'pending' (retry_count 0 < 2)
      { id: 'inc-1', retry_count: 0, bullmq_job_id: 'job-pl-1' },
      // Fila 2: debe ir a 'failed' (retry_count 2 >= 2)
      { id: 'inc-2', retry_count: 2, bullmq_job_id: 'job-pl-2' },
    ];

    const { supabase, updateIncidenceSpy } = createMockSupabase({
      captures: { data: [], error: null },
      incidences: { data: stuckIncidences, error: null },
    });

    // Job 1 devuelto como 'failed' (no activo), Job 2 no existe
    const mockJob1 = { getState: vi.fn().mockResolvedValue('failed') };
    
    const mockPlanogramQueue = {
      getJob: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'job-pl-1') return mockJob1;
        return null;
      }),
    } as any;
    const mockUbiqoQueue = { getJob: vi.fn() } as any;

    const result = await reconcileProcessingJobs({
      supabase,
      ubiqoQueue: mockUbiqoQueue,
      planogramQueue: mockPlanogramQueue,
    });

    expect(result.planogramRequeued).toBe(1); // inc-1 devuelta a pending
    
    // Verificar actualización para inc-1
    expect(updateIncidenceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
      })
    );
    
    // Verificar actualización para inc-2
    expect(updateIncidenceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_kind: 'permanent',
      })
    );

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RECONCILE_REQUEUED=1'));
  });

  it('debe manejar errores de consulta Supabase de forma resiliente', async () => {
    const { supabase } = createMockSupabase({
      captures: { data: null, error: new Error('Fallo crítico de base de datos') },
      incidences: { data: [], error: null },
    });

    const mockUbiqoQueue = { getJob: vi.fn() } as any;
    const mockPlanogramQueue = { getJob: vi.fn() } as any;

    await expect(
      reconcileProcessingJobs({
        supabase,
        ubiqoQueue: mockUbiqoQueue,
        planogramQueue: mockPlanogramQueue,
      })
    ).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error consultando capturas stuck de Ubiqo'),
      'Fallo crítico de base de datos'
    );
  });
});
