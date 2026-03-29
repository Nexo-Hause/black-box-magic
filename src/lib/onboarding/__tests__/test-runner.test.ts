import { describe, it, expect, vi } from 'vitest';
import { runTestPhoto } from '../test-runner';
import type { ClientConfig, EngineV3Result } from '@/types/engine';

// ─── Mock analyzer ────────────────────────────────────────────────────────────

vi.mock('@/lib/engine/analyzer', () => ({
  analyzeWithConfig: vi.fn(),
}));

import { analyzeWithConfig } from '@/lib/engine/analyzer';
const mockAnalyzeWithConfig = vi.mocked(analyzeWithConfig);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const minimalConfig: ClientConfig = {
  clientId: 'test-client',
  clientName: 'Test Client',
  industry: 'qsr',
  evaluationAreas: [
    {
      id: 'area-1',
      name: 'Test Area',
      description: 'Test area',
      weight: 1.0,
      criteria: [
        {
          id: 'c1',
          name: 'Criterion One',
          type: 'binary',
          description: 'Test criterion',
          weight: 1.0,
          critical: false,
        },
      ],
    },
  ],
  globalScoringMethod: 'weighted',
  passingScore: 70,
  escalationRules: [],
  industryContext: 'QSR context',
  customInstructions: 'Custom instructions',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockEngineResult: EngineV3Result = {
  areas: [
    {
      areaId: 'area-1',
      areaName: 'Test Area',
      score: 100,
      weight: 1.0,
      passed: true,
      criteria: [
        {
          criterionId: 'c1',
          criterionName: 'Criterion One',
          type: 'binary',
          rawValue: true,
          normalizedScore: 100,
          critical: false,
          failed: false,
        },
      ],
    },
  ],
  globalScore: 100,
  passed: true,
  globalScoringMethod: 'weighted',
  escalations: [],
  summary: 'All good',
  configId: 'test-client',
  configVersion: 1,
  engine: 'engine-v3',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runTestPhoto', () => {
  it('returns the expected shape from analyzeWithConfig', async () => {
    mockAnalyzeWithConfig.mockResolvedValueOnce({
      result: mockEngineResult,
      model: 'gemini-flash',
      tokens: { input: 100, output: 50, total: 150 },
      processing_time_ms: 1234,
    });

    const result = await runTestPhoto(
      'base64imagedata',
      'image/jpeg',
      minimalConfig,
      'test-api-key',
    );

    expect(result.result).toEqual(mockEngineResult);
    expect(result.model).toBe('gemini-flash');
    expect(result.tokens).toEqual({ input: 100, output: 50, total: 150 });
    expect(result.processing_time_ms).toBe(1234);
  });

  it('passes arguments through to analyzeWithConfig', async () => {
    mockAnalyzeWithConfig.mockResolvedValueOnce({
      result: mockEngineResult,
      model: 'gemini-flash',
      tokens: { input: 10, output: 5, total: 15 },
      processing_time_ms: 500,
    });

    await runTestPhoto('mybase64', 'image/png', minimalConfig, 'my-api-key');

    expect(mockAnalyzeWithConfig).toHaveBeenCalledWith(
      'mybase64',
      'image/png',
      minimalConfig,
      'my-api-key',
    );
  });

  it('propagates errors from analyzeWithConfig', async () => {
    mockAnalyzeWithConfig.mockRejectedValueOnce(new Error('Gemini analysis timeout'));

    await expect(
      runTestPhoto('base64imagedata', 'image/jpeg', minimalConfig, 'test-api-key'),
    ).rejects.toThrow('Gemini analysis timeout');
  });
});
