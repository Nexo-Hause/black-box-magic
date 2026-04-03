/**
 * Legacy 2-pass analysis — unit tests
 *
 * Tests analyzePhoto orchestration logic.
 * Gemini is fully mocked — no real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing the module under test
vi.mock('@/lib/gemini', () => ({
  analyzeImage: vi.fn(),
}));

vi.mock('@/lib/prompts', () => ({
  buildSinglePassPrompt: vi.fn(() => 'mock-single-pass-prompt'),
  buildConditionEscalationPrompt: vi.fn(() => 'mock-escalation-prompt'),
  shouldEscalate: vi.fn(),
}));

import { analyzePhoto } from '@/lib/analyze';
import { analyzeImage } from '@/lib/gemini';
import { shouldEscalate } from '@/lib/prompts';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PASS1_RESULT = {
  data: {
    photo_type: 'retail_shelf',
    severity: 'LOW',
    inventory: [{ name: 'Coca-Cola', quantity: 12 }],
  },
  model: 'gemini-2.0-flash-lite',
  tokens: { input: 100, output: 50, total: 150 },
  processing_time_ms: 1200,
};

const PASS2_RESULT = {
  data: {
    cleanliness: 'CLEAN',
    structural_damage: 'NONE',
    actions: [],
  },
  model: 'gemini-2.0-flash-lite',
  tokens: { input: 80, output: 40, total: 120 },
  processing_time_ms: 800,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('analyzePhoto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GOOGLE_AI_API_KEY = 'test-gemini-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('runs pass 1 only when escalation is not needed', async () => {
    vi.mocked(analyzeImage).mockResolvedValue(PASS1_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(false);

    const result = await analyzePhoto('base64data', 'image/jpeg');

    expect(analyzeImage).toHaveBeenCalledTimes(1);
    expect(result.meta.escalated).toBe(false);
    expect(result.conditionDetail).toBeUndefined();
    expect(result.analysis).toEqual(PASS1_RESULT.data);
    expect(result.meta.model).toBe('gemini-2.0-flash-lite');
  });

  it('runs pass 2 when shouldEscalate returns true', async () => {
    vi.mocked(analyzeImage)
      .mockResolvedValueOnce(PASS1_RESULT)
      .mockResolvedValueOnce(PASS2_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(true);

    const result = await analyzePhoto('base64data', 'image/jpeg');

    expect(analyzeImage).toHaveBeenCalledTimes(2);
    expect(result.meta.escalated).toBe(true);
    expect(result.conditionDetail).toEqual(PASS2_RESULT.data);
  });

  it('aggregates tokens across both passes', async () => {
    vi.mocked(analyzeImage)
      .mockResolvedValueOnce(PASS1_RESULT)
      .mockResolvedValueOnce(PASS2_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(true);

    const result = await analyzePhoto('base64data', 'image/jpeg');

    expect(result.meta.tokens).toEqual({
      input: 100 + 80,   // 180
      output: 50 + 40,   // 90
      total: 150 + 120,  // 270
    });
  });

  it('sums processing_time_ms from both passes', async () => {
    vi.mocked(analyzeImage)
      .mockResolvedValueOnce(PASS1_RESULT)
      .mockResolvedValueOnce(PASS2_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(true);

    const result = await analyzePhoto('base64data', 'image/jpeg');

    expect(result.meta.processing_time_ms).toBe(1200 + 800); // 2000
  });

  it('uses only pass 1 tokens/time when no escalation', async () => {
    vi.mocked(analyzeImage).mockResolvedValue(PASS1_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(false);

    const result = await analyzePhoto('base64data', 'image/jpeg');

    expect(result.meta.tokens).toEqual({ input: 100, output: 50, total: 150 });
    expect(result.meta.processing_time_ms).toBe(1200);
  });

  it('throws when GOOGLE_AI_API_KEY is not set', async () => {
    delete process.env.GOOGLE_AI_API_KEY;

    await expect(
      analyzePhoto('base64data', 'image/jpeg')
    ).rejects.toThrow('GOOGLE_AI_API_KEY not configured');
  });

  it('passes customRules to buildSinglePassPrompt', async () => {
    const { buildSinglePassPrompt } = await import('@/lib/prompts');
    vi.mocked(analyzeImage).mockResolvedValue(PASS1_RESULT);
    vi.mocked(shouldEscalate).mockReturnValue(false);

    await analyzePhoto('base64data', 'image/jpeg', 'Check planogram compliance');

    expect(buildSinglePassPrompt).toHaveBeenCalledWith('Check planogram compliance');
  });
});
