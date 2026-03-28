/**
 * Engine v3 — Analyzer unit tests
 *
 * Tests the deterministic scoring functions exported from analyzer.ts.
 * No Gemini calls, no config files — minimal fixtures only.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRawValue,
  isCriterionFailed,
  scoreArea,
  calculateGlobalScore,
} from '@/lib/engine/analyzer';
import type {
  EvaluationArea,
  EvaluationCriterion,
  AreaResult,
  ClientConfig,
} from '@/types/engine';

// ─── Fixtures ───

function makeCriterion(overrides: Partial<EvaluationCriterion> = {}): EvaluationCriterion {
  return {
    id: 'c1',
    name: 'Test Criterion',
    type: 'binary',
    description: '',
    weight: 1,
    critical: false,
    ...overrides,
  };
}

function makeArea(
  criteria: EvaluationCriterion[],
  overrides: Partial<EvaluationArea> = {},
): EvaluationArea {
  return {
    id: 'area1',
    name: 'Test Area',
    description: '',
    weight: 1,
    criteria,
    ...overrides,
  };
}

function makeAreaResult(overrides: Partial<AreaResult> = {}): AreaResult {
  return {
    areaId: 'area1',
    areaName: 'Test Area',
    score: 100,
    weight: 1,
    passed: true,
    criteria: [],
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<ClientConfig> = {},
): ClientConfig {
  return {
    clientId: 'test',
    clientName: 'Test Client',
    industry: 'qsr',
    evaluationAreas: [],
    globalScoringMethod: 'weighted',
    passingScore: 70,
    escalationRules: [],
    industryContext: '',
    customInstructions: '',
    version: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

// ─── normalizeRawValue ───

describe('normalizeRawValue', () => {
  it('binary true → 100', () => {
    expect(normalizeRawValue(true, 'binary')).toBe(100);
  });

  it('binary false → 0', () => {
    expect(normalizeRawValue(false, 'binary')).toBe(0);
  });

  it('presence true → 100', () => {
    expect(normalizeRawValue(true, 'presence')).toBe(100);
  });

  it('presence false → 0', () => {
    expect(normalizeRawValue(false, 'presence')).toBe(0);
  });

  it('scale 3 in range [1, 5] → 50', () => {
    expect(normalizeRawValue(3, 'scale', [1, 5])).toBe(50);
  });

  it('scale 5 in range [1, 5] → 100', () => {
    expect(normalizeRawValue(5, 'scale', [1, 5])).toBe(100);
  });

  it('scale 1 in range [1, 5] → 0', () => {
    expect(normalizeRawValue(1, 'scale', [1, 5])).toBe(0);
  });

  it('count 0 → 0', () => {
    expect(normalizeRawValue(0, 'count')).toBe(0);
  });

  it('count 5 → 100', () => {
    expect(normalizeRawValue(5, 'count')).toBe(100);
  });
});

// ─── isCriterionFailed ───

describe('isCriterionFailed', () => {
  it('non-critical criterion → always false regardless of value', () => {
    expect(isCriterionFailed(false, 'binary', false)).toBe(false);
    expect(isCriterionFailed(0, 'count', false)).toBe(false);
    expect(isCriterionFailed(1, 'scale', false, [1, 5])).toBe(false);
  });

  it('critical binary false → true (failed)', () => {
    expect(isCriterionFailed(false, 'binary', true)).toBe(true);
  });

  it('critical binary true → false (not failed)', () => {
    expect(isCriterionFailed(true, 'binary', true)).toBe(false);
  });

  it('critical scale at minimum → true (failed)', () => {
    expect(isCriterionFailed(1, 'scale', true, [1, 5])).toBe(true);
  });

  it('critical scale above minimum → false (not failed)', () => {
    expect(isCriterionFailed(2, 'scale', true, [1, 5])).toBe(false);
  });
});

// ─── scoreArea ───

describe('scoreArea', () => {
  it('area with all criteria passing → score > 0, hasCriticalFailure false', () => {
    const area = makeArea([
      makeCriterion({ id: 'c1', type: 'binary', critical: true, weight: 1 }),
      makeCriterion({ id: 'c2', type: 'binary', critical: false, weight: 1 }),
    ]);

    const rawCriteria = [
      { criterionId: 'c1', rawValue: true as boolean | number },
      { criterionId: 'c2', rawValue: true as boolean | number },
    ];

    const { areaResult, hasCriticalFailure } = scoreArea(area, rawCriteria);

    expect(areaResult.score).toBeGreaterThan(0);
    expect(hasCriticalFailure).toBe(false);
  });

  it('area with critical failure → hasCriticalFailure true', () => {
    const area = makeArea([
      makeCriterion({ id: 'c1', type: 'binary', critical: true, weight: 1 }),
    ]);

    const rawCriteria = [
      { criterionId: 'c1', rawValue: false as boolean | number },
    ];

    const { hasCriticalFailure } = scoreArea(area, rawCriteria);

    expect(hasCriticalFailure).toBe(true);
  });
});

// ─── calculateGlobalScore ───

describe('calculateGlobalScore', () => {
  it('weighted method: scores weighted by area weight', () => {
    const areaResults: AreaResult[] = [
      makeAreaResult({ areaId: 'a1', score: 80, weight: 0.25, criteria: [] }),
      makeAreaResult({ areaId: 'a2', score: 40, weight: 0.75, criteria: [] }),
    ];
    const config = makeConfig({ globalScoringMethod: 'weighted', passingScore: 70 });

    const { globalScore, passed } = calculateGlobalScore(areaResults, config);

    // (80 * 0.25 + 40 * 0.75) / (0.25 + 0.75) = (20 + 30) / 1 = 50
    expect(globalScore).toBe(50);
    expect(passed).toBe(false);
  });

  it('equal method: simple average of area scores', () => {
    const areaResults: AreaResult[] = [
      makeAreaResult({ areaId: 'a1', score: 90, weight: 0.8, criteria: [] }),
      makeAreaResult({ areaId: 'a2', score: 70, weight: 0.2, criteria: [] }),
    ];
    const config = makeConfig({ globalScoringMethod: 'equal', passingScore: 70 });

    const { globalScore, passed } = calculateGlobalScore(areaResults, config);

    // (90 + 70) / 2 = 80
    expect(globalScore).toBe(80);
    expect(passed).toBe(true);
  });

  it('pass_fail method: passed only if all criticals pass', () => {
    const passingCriteria = [
      { criterionId: 'c1', criterionName: 'C1', type: 'binary' as const, rawValue: true as boolean | number, normalizedScore: 100, critical: true, failed: false },
    ];
    const failingCriteria = [
      { criterionId: 'c2', criterionName: 'C2', type: 'binary' as const, rawValue: false as boolean | number, normalizedScore: 0, critical: true, failed: true },
    ];

    const allPassingAreas: AreaResult[] = [
      makeAreaResult({ areaId: 'a1', score: 100, criteria: passingCriteria }),
    ];
    const someFailingAreas: AreaResult[] = [
      makeAreaResult({ areaId: 'a1', score: 100, criteria: passingCriteria }),
      makeAreaResult({ areaId: 'a2', score: 0, criteria: failingCriteria }),
    ];

    const config = makeConfig({ globalScoringMethod: 'pass_fail' });

    expect(calculateGlobalScore(allPassingAreas, config).passed).toBe(true);
    expect(calculateGlobalScore(someFailingAreas, config).passed).toBe(false);
  });
});
