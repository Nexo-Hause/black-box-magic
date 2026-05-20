import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mockear las colas para evitar intentos de conexión a Redis real en tests unitarios
vi.mock('../queues', () => ({
  connection: {},
  ubiqoProcessQueue: { name: 'ubiqoProcessQueue' },
  planogramProcessQueue: { name: 'planogramProcessQueue' },
  reconcileQueue: { name: 'reconcileQueue' },
}));

// Mockear 'bullmq' para evitar que se levanten workers reales e intenten conectar a Redis
vi.mock('bullmq', () => {
  class MockWorker {
    close = vi.fn().mockResolvedValue(undefined);
  }
  return {
    Worker: MockWorker,
    Queue: vi.fn(),
    Job: vi.fn(),
    UnrecoverableError: class extends Error {},
  };
});

// Mockear el cliente de Supabase de manera limpia para vitest
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase';
import { checkGeminiDailyBudgetLimit } from '../worker';

describe('Control de Presupuesto Diario de Gemini (checkGeminiDailyBudgetLimit)', () => {
  let originalEnv: typeof process.env;
  let logSpy: any;
  let errorSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalEnv = { ...process.env };
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('debe retornar exceeded: false y costo real si está por debajo del límite presupuestario', async () => {
    process.env.GEMINI_DAILY_BUDGET_LIMIT = '100.0';

    const ubiqoData = [{ tokens_total: 5000000 }, { tokens_total: 3000000 }];
    const incidenceData = [{ tokens_total: 2000000 }];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      let isCountQuery = false;
      const chain: any = {
        select: vi.fn((columns, options) => {
          if (options && options.count) {
            isCountQuery = true;
          }
          return chain;
        }),
        gte: vi.fn(() => chain),
        not: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        then: (resolve: any) => {
          if (table === 'bbm_ubiqo_captures') {
            if (isCountQuery) {
              resolve({ count: 1, error: null }); // 1 job in-flight
            } else {
              resolve({ data: ubiqoData, error: null });
            }
          } else if (table === 'bbm_incidences') {
            if (isCountQuery) {
              resolve({ count: 0, error: null }); // 0 jobs in-flight
            } else {
              resolve({ data: incidenceData, error: null });
            }
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return chain;
    });

    const result = await checkGeminiDailyBudgetLimit();

    // GEMINI_COST_PER_TOKEN = 0.000007 ($7 por millón de tokens)
    // total tokens = 5M + 3M + 2M = 10,000,000 tokens
    // actual cost = 10M * 0.000007 = $70
    // total in-flight = 1 capture + 0 incidence = 1 job
    // projected tokens in-flight = 1 * 60,000 = 60,000 tokens
    // projected cost = $70 + 60,000 * 0.000007 = $70.42
    // limit = $100
    // exceeded = false (70.42 < 100)

    expect(result.exceeded).toBe(false);
    expect(result.cost).toBeCloseTo(70.0);
    expect(result.limit).toBe(100.0);
  });

  it('debe retornar exceeded: true si el costo proyectado supera el límite de presupuesto', async () => {
    process.env.GEMINI_DAILY_BUDGET_LIMIT = '50.0';

    const ubiqoData = [{ tokens_total: 4000000 }]; // 4M * 0.000007 = $28
    const incidenceData = [{ tokens_total: 2000000 }]; // 2M * 0.000007 = $14
    // actual cost = $42

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      let isCountQuery = false;
      const chain: any = {
        select: vi.fn((columns, options) => {
          if (options && options.count) {
            isCountQuery = true;
          }
          return chain;
        }),
        gte: vi.fn(() => chain),
        not: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        then: (resolve: any) => {
          if (table === 'bbm_ubiqo_captures') {
            if (isCountQuery) {
              resolve({ count: 20, error: null }); // 20 in-flight jobs!
            } else {
              resolve({ data: ubiqoData, error: null });
            }
          } else if (table === 'bbm_incidences') {
            if (isCountQuery) {
              resolve({ count: 0, error: null });
            } else {
              resolve({ data: incidenceData, error: null });
            }
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return chain;
    });

    const result = await checkGeminiDailyBudgetLimit();

    // actual cost = $42
    // 20 in-flight * 60,000 = 1,200,000 tokens
    // projected cost of in-flight = 1.2M * 0.000007 = $8.40
    // total projected cost = $42 + $8.40 = $50.40
    // limit = $50.0
    // exceeded = true (50.40 >= 50.0)

    expect(result.exceeded).toBe(true);
    expect(result.cost).toBeCloseTo(42.0);
    expect(result.limit).toBe(50.0);
  });
});
