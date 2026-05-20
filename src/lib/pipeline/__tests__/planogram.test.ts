import { describe, it, expect, vi } from 'vitest';
import { processIncidence } from '@/lib/pipeline/planogram';

function makeDeps(over = {}) {
  const maybeSingleMock = vi.fn(async () => ({
    data: { id: 'p1', storage_path: 'x', file_type: 'image/png', section: 'textil', reference_items: [] },
    error: null,
  }));
  const eqMock2 = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqMock1 = vi.fn(() => ({ eq: eqMock2 }));
  const selectMock = vi.fn(() => ({ eq: eqMock1 }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  const updateEqMock = vi.fn(async () => ({ error: null }));
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'bbm_planograms') {
        return { select: selectMock };
      }
      if (table === 'bbm_incidences') {
        return { update: updateMock };
      }
      return {} as any;
    }),
  } as any;

  return {
    downloadPlanogram: vi.fn(async () => ({ data: new Blob([Buffer.from('p')]) })),
    downloadPhoto: vi.fn(async () => ({ buffer: Buffer.from('f'), contentType: 'image/jpeg' })),
    buildIncidencePrompt: vi.fn(() => 'PROMPT'),
    analyzeWithReferences: vi.fn(async () => ({ data: {}, model: 'm', tokens: { total: 1 } })),
    parseIncidenceResponse: vi.fn(() => ({
      summary: 's',
      incidences: [],
      photoQuality: 'good',
      coverage: 'full',
      incidenceCount: 0,
      severityCritical: 0,
      severityHigh: 0,
      severityMedium: 0,
      severityLow: 0,
    })),
    decryptFirma: vi.fn((f) => f),
    analyzePhoto: vi.fn(),
    supabase: supabaseMock,
    ...over,
  };
}

describe('processIncidence', () => {
  it('compara y marca completed con conteo de severidades', async () => {
    const deps = makeDeps();
    const row = { id: 'i1', planogram_id: 'p1', field_photo_paths: ['f1.jpg'] };
    const r = await processIncidence(row as any, deps as any);
    expect(deps.analyzeWithReferences).toHaveBeenCalledOnce();
    expect(deps.parseIncidenceResponse).toHaveBeenCalledOnce();
    expect(r.status).toBe('completed');
  });

  it('propaga error de planograma no encontrado', async () => {
    const customSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    };
    const deps = makeDeps({ supabase: customSupabase });
    const row = { id: 'i1', planogram_id: 'p1', field_photo_paths: ['f1.jpg'] };
    await expect(processIncidence(row as any, deps as any)).rejects.toThrow('No active planogram found');
  });
});
