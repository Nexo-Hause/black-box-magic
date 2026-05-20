import { describe, it, expect, vi } from 'vitest';
import { processUbiqoCapture, ingestUbiqoCaptures } from '@/lib/pipeline/ubiqo';
import type { PipelineDeps, UbiqoIngestDeps } from '@/lib/pipeline/types';

function makeDeps(over: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    downloadPhoto: vi.fn(async () => ({ buffer: Buffer.from('img'), contentType: 'image/jpeg' })),
    analyzePhoto: vi.fn(async () => ({
      analysis: { ok: true } as any,
      meta: { model: 'm', tokens: { total: 1 }, processing_time_ms: 1, escalated: false },
    })),
    decryptFirma: vi.fn(() => 'firma'),
    supabase: {
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    } as any,
    ...over,
  };
}

describe('processUbiqoCapture', () => {
  it('descarga, analiza y marca completed', async () => {
    const deps = makeDeps();
    const capture = {
      id: 'c1',
      url_base: 'https://cdn.test',
      photo_path: 'a/b.jpg',
      firma: 'enc',
      custom_rules: null,
      status: 'processing',
    };
    const r = await processUbiqoCapture(capture as any, deps);
    expect(deps.downloadPhoto).toHaveBeenCalledOnce();
    expect(deps.analyzePhoto).toHaveBeenCalledOnce();
    expect(r.status).toBe('completed');
    expect(r.captureId).toBe('c1');
  });

  it('propaga error de download sin marcar completed', async () => {
    const deps = makeDeps({ downloadPhoto: vi.fn(async () => { throw new Error('net'); }) });
    const capture = {
      id: 'c1',
      url_base: 'https://cdn.test',
      photo_path: 'a/b.jpg',
      firma: 'enc',
      custom_rules: null,
      status: 'processing',
    };
    await expect(processUbiqoCapture(capture as any, deps)).rejects.toThrow('net');
    expect(deps.analyzePhoto).not.toHaveBeenCalled();
  });
});

describe('ingestUbiqoCaptures', () => {
  it('filtra capturas completas, extrae fotos y realiza upsert en supabase', async () => {
    const fetchCaptures = vi.fn(async () => [
      { grupo: 'g1', folioEvidence: 'f1', alias: 'a1', username: 'u1', estatus: 'Completa', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f1' },
      { grupo: 'g2', folioEvidence: 'f2', alias: 'a2', username: 'u2', estatus: 'Incompleta', fecha: '2026-05-19', urlBase: 'https://cdn', firma: 'f2' }
    ]);
    const extractPhotos = vi.fn(() => [
      { url: 'photo1.jpg', latitud: '1.2', longitud: '3.4', descripcion: 'desc1' }
    ]);
    const encryptFirma = vi.fn((f) => `enc_${f}`);

    let callCount = 0;
    const createMockChain = (countVal: number) => {
      const result = { count: countVal, error: null };
      const chain: any = {
        eq: vi.fn(() => chain),
        then: (resolve: any) => resolve(result)
      };
      return chain;
    };

    const selectMock = vi.fn(() => {
      callCount++;
      if (callCount === 1) return createMockChain(5); // countBefore
      if (callCount === 2) return createMockChain(6); // countAfter
      return createMockChain(0); // pendingCount
    });

    const upsertMock = vi.fn(async () => ({ error: null }));

    const supabase = {
      from: vi.fn((table) => {
        if (table === 'bbm_ubiqo_captures') {
          return {
            select: selectMock,
            upsert: upsertMock
          };
        }
        return {} as any;
      })
    } as any;

    const deps: UbiqoIngestDeps = {
      fetchCaptures,
      extractPhotos,
      encryptFirma,
      supabase
    };

    const r = await ingestUbiqoCaptures({ form_id: 123, from: '2026-05-19', to: '2026-05-20', tz: 'UTC' }, deps);

    expect(fetchCaptures).toHaveBeenCalledWith(123, '2026-05-19', '2026-05-20', 'UTC');
    expect(extractPhotos).toHaveBeenCalledOnce();
    expect(encryptFirma).toHaveBeenCalledWith('f1');
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(r.discovered).toBe(1);
    expect(r.alreadyProcessed).toBe(0);
    expect(r.pending).toBe(0);
  });
});

