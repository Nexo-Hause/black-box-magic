import { describe, it, expect, vi } from 'vitest';
import { processIncidence, ingestPlanogramCaptures } from '@/lib/pipeline/planogram';
import type { PlanogramIngestDeps } from '@/lib/pipeline/types';

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

describe('ingestPlanogramCaptures', () => {
  it('retorna skipped si no hay asignacion de planograma', async () => {
    const fetchCaptures = vi.fn(async () => [
      { grupo: 'g1', folioEvidence: 'f1', alias: 'a1', username: 'u1', estatus: 'Completa', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f1' }
    ]);
    const extractPhotos = vi.fn(() => [{ url: 'photo1.jpg' }]);
    const buildPhotoUrl = vi.fn(() => 'https://cdn/photo1.jpg');

    const supabase = {
      from: vi.fn((table) => {
        if (table === 'bbm_planogram_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null }))
              }))
            }))
          };
        }
        return {} as any;
      })
    } as any;

    const deps: any = { fetchCaptures, extractPhotos, buildPhotoUrl, supabase };
    const r = await ingestPlanogramCaptures({ form_id: 123, from: '2026-05-19', to: '2026-05-20', tz: 'UTC' }, deps);

    expect(r.success).toBe(true);
    expect(r.skipped).toBe('no planogram assignment');
    expect(r.captures_found).toBe(1);
  });

  it('retorna skipped si el planograma esta inactivo o borrado', async () => {
    const fetchCaptures = vi.fn(async () => [
      { grupo: 'g1', folioEvidence: 'f1', alias: 'a1', username: 'u1', estatus: 'Completa', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f1' }
    ]);
    const extractPhotos = vi.fn(() => [{ url: 'photo1.jpg' }]);
    const buildPhotoUrl = vi.fn(() => 'https://cdn/photo1.jpg');

    const supabase = {
      from: vi.fn((table) => {
        if (table === 'bbm_planogram_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { planogram_id: 'p1' }, error: null }))
              }))
            }))
          };
        }
        if (table === 'bbm_planograms') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null }))
                }))
              }))
            }))
          };
        }
        return {} as any;
      })
    } as any;

    const deps: any = { fetchCaptures, extractPhotos, buildPhotoUrl, supabase };
    const r = await ingestPlanogramCaptures({ form_id: 123, from: '2026-05-19', to: '2026-05-20', tz: 'UTC' }, deps);

    expect(r.success).toBe(true);
    expect(r.skipped).toBe('planogram inactive or deleted');
    expect(r.planogram_id).toBe('p1');
  });

  it('inserta incidencias si el planograma esta activo', async () => {
    const fetchCaptures = vi.fn(async () => [
      { grupo: 'g1', folioEvidence: 'f1', alias: 'a1', username: 'u1', estatus: 'Completa', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f1' }
    ]);
    const extractPhotos = vi.fn(() => [{ url: 'photo1.jpg' }]);
    const buildPhotoUrl = vi.fn(() => 'https://cdn/photo1.jpg');
    const upsertMock = vi.fn(async () => ({ error: null }));

    const supabase = {
      from: vi.fn((table) => {
        if (table === 'bbm_planogram_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { planogram_id: 'p1' }, error: null }))
              }))
            }))
          };
        }
        if (table === 'bbm_planograms') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: 'p1' }, error: null }))
                }))
              }))
            }))
          };
        }
        if (table === 'bbm_incidences') {
          return {
            upsert: upsertMock
          };
        }
        return {} as any;
      })
    } as any;

    const deps: any = { fetchCaptures, extractPhotos, buildPhotoUrl, supabase };
    const r = await ingestPlanogramCaptures({ form_id: 123, from: '2026-05-19', to: '2026-05-20', tz: 'UTC' }, deps);

    expect(r.success).toBe(true);
    expect(r.discovered).toBe(1);
    expect(r.pending).toBe(1);
    expect(upsertMock).toHaveBeenCalledOnce();
  });

  it('estampa account_id y client_id en incidencias cuando tenantInfo está disponible', async () => {
    const fetchCaptures = vi.fn(async () => [
      { grupo: 'g1', folioEvidence: 'f1', alias: 'a1', username: 'u1', estatus: 'Completa', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f1' }
    ]);
    const extractPhotos = vi.fn(() => [{ url: 'photo1.jpg' }]);
    const buildPhotoUrl = vi.fn(() => 'https://cdn/photo1.jpg');
    const resolveTenantFromFormId = vi.fn(async () => ({ accountId: 'acc-1', clientId: 'cli-1' }));
    const upsertMock = vi.fn(async () => ({ error: null }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'bbm_planogram_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { planogram_id: 'p1' }, error: null }))
              }))
            }))
          };
        }
        if (table === 'bbm_planograms') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: 'p1' }, error: null }))
                }))
              }))
            }))
          };
        }
        if (table === 'bbm_incidences') {
          return { upsert: upsertMock };
        }
        return {} as any;
      })
    } as any;

    const deps: any = { fetchCaptures, extractPhotos, buildPhotoUrl, supabase, resolveTenantFromFormId };
    const r = await ingestPlanogramCaptures({ form_id: 123, from: '2026-05-19', to: '2026-05-20', tz: 'UTC' }, deps);

    expect(r.success).toBe(true);
    expect(upsertMock).toHaveBeenCalledOnce();
    const upsertArg = upsertMock.mock.calls[0][0];
    expect(upsertArg.account_id).toBe('acc-1');
    expect(upsertArg.client_id).toBe('cli-1');
  });
});

