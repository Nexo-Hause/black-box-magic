import { describe, it, expect, vi } from 'vitest';
import { processUbiqoCapture } from '@/lib/pipeline/ubiqo';
import type { PipelineDeps } from '@/lib/pipeline/types';

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
