/**
 * Engine v3 — Escalation unit tests
 *
 * Tests the evaluateEscalation pure function against minimal EngineV3Result fixtures.
 */

import { describe, it, expect } from 'vitest';
import { evaluateEscalation } from '@/lib/engine/escalation';
import type {
  EngineV3Result,
  AreaResult,
  CriterionResult,
  EscalationRule,
} from '@/types/engine';

// ─── Fixtures ───

function makeCriterionResult(overrides: Partial<CriterionResult> = {}): CriterionResult {
  return {
    criterionId: 'c1',
    criterionName: 'Test Criterion',
    type: 'binary',
    rawValue: true,
    normalizedScore: 100,
    critical: false,
    failed: false,
    ...overrides,
  };
}

function makeAreaResult(
  criteria: CriterionResult[],
  overrides: Partial<AreaResult> = {},
): AreaResult {
  return {
    areaId: 'area1',
    areaName: 'Test Area',
    score: 100,
    weight: 1,
    passed: true,
    criteria,
    ...overrides,
  };
}

function makeResult(
  areas: AreaResult[],
  globalScore = 80,
): EngineV3Result {
  return {
    areas,
    globalScore,
    passed: true,
    globalScoringMethod: 'weighted',
    escalations: [],
    summary: 'ok',
    configId: 'test',
    configVersion: 1,
    engine: 'engine-v3',
  };
}

function makeRule(
  trigger: EscalationRule['trigger'],
  overrides: Partial<EscalationRule> = {},
): EscalationRule {
  return {
    id: 'rule1',
    trigger,
    severity: 'high',
    action: 'flag',
    description: 'Test rule',
    ...overrides,
  };
}

// ─── Tests ───

describe('evaluateEscalation', () => {
  // ── global_score_below ──

  describe('global_score_below', () => {
    it('fires when globalScore < threshold', () => {
      const result = makeResult([], 50);
      const rules = [makeRule({ type: 'global_score_below', threshold: 60 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
      expect(events[0].ruleId).toBe('rule1');
    });

    it('does not fire when globalScore >= threshold', () => {
      const result = makeResult([], 60);
      const rules = [makeRule({ type: 'global_score_below', threshold: 60 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });
  });

  // ── area_score_below ──

  describe('area_score_below', () => {
    it('fires when area score < threshold', () => {
      const area = makeAreaResult([], { areaId: 'zone-a', score: 30 });
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'area_score_below', areaId: 'zone-a', threshold: 50 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });

    it('returns no events when areaId does not exist (silent skip)', () => {
      const area = makeAreaResult([], { areaId: 'zone-a', score: 20 });
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'area_score_below', areaId: 'zone-nonexistent', threshold: 50 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });
  });

  // ── critical_criterion_failed ──

  describe('critical_criterion_failed', () => {
    it('fires when specified criterionId is critical and failed', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-key', critical: true, failed: true });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'critical_criterion_failed', criterionId: 'c-key' })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });

    it('does not fire when specified criterion is not failed', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-key', critical: true, failed: false });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'critical_criterion_failed', criterionId: 'c-key' })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });

    it('fires when ANY critical criterion fails (no criterionId specified)', () => {
      const passing = makeCriterionResult({ criterionId: 'c1', critical: false, failed: false });
      const failing = makeCriterionResult({ criterionId: 'c2', critical: true, failed: true, criterionName: 'Critical One' });
      const area = makeAreaResult([passing, failing]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'critical_criterion_failed' })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });
  });

  // ── any_criterion_failed_in_area ──

  describe('any_criterion_failed_in_area', () => {
    it('fires when any criterion in the area has failed=true', () => {
      const criterion = makeCriterionResult({ criterionId: 'c1', failed: true });
      const area = makeAreaResult([criterion], { areaId: 'zone-b' });
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'any_criterion_failed_in_area', areaId: 'zone-b' })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });

    it('does not fire when no criterion in the area has failed', () => {
      const criterion = makeCriterionResult({ criterionId: 'c1', failed: false });
      const area = makeAreaResult([criterion], { areaId: 'zone-b' });
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'any_criterion_failed_in_area', areaId: 'zone-b' })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });
  });

  // ── count_below ──

  describe('count_below', () => {
    it('fires when count rawValue < threshold', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-count', type: 'count', rawValue: 2 });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'count_below', criterionId: 'c-count', threshold: 5 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });

    it('does not fire when count rawValue >= threshold', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-count', type: 'count', rawValue: 5 });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'count_below', criterionId: 'c-count', threshold: 5 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });
  });

  // ── count_above ──

  describe('count_above', () => {
    it('fires when count rawValue > threshold', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-count', type: 'count', rawValue: 10 });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'count_above', criterionId: 'c-count', threshold: 7 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(1);
    });

    it('does not fire when count rawValue <= threshold', () => {
      const criterion = makeCriterionResult({ criterionId: 'c-count', type: 'count', rawValue: 7 });
      const area = makeAreaResult([criterion]);
      const result = makeResult([area]);
      const rules = [makeRule({ type: 'count_above', criterionId: 'c-count', threshold: 7 })];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(0);
    });
  });

  // ── Sorting ──

  describe('severity sorting', () => {
    it('results are sorted by severity (critical first)', () => {
      const result = makeResult([], 10);
      const rules: EscalationRule[] = [
        makeRule({ type: 'global_score_below', threshold: 50 }, { id: 'low-rule', severity: 'low' }),
        makeRule({ type: 'global_score_below', threshold: 50 }, { id: 'critical-rule', severity: 'critical' }),
        makeRule({ type: 'global_score_below', threshold: 50 }, { id: 'medium-rule', severity: 'medium' }),
      ];
      const events = evaluateEscalation(result, rules);
      expect(events).toHaveLength(3);
      expect(events[0].severity).toBe('critical');
      expect(events[1].severity).toBe('medium');
      expect(events[2].severity).toBe('low');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('no rules → empty array', () => {
      const result = makeResult([], 10);
      const events = evaluateEscalation(result, []);
      expect(events).toHaveLength(0);
    });
  });
});
