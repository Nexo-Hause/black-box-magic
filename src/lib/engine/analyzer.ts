/**
 * Engine v3 — Analyzer
 *
 * Orchestrates image analysis with a ClientConfig:
 * 1. Build prompt from config (prompt-builder)
 * 2. Call Gemini via existing analyzeImage() (gemini.ts — unchanged)
 * 3. Parse raw LLM response into criterion-level values
 * 4. Calculate scores server-side (deterministic)
 * 5. Evaluate escalation triggers (escalation.ts)
 * 6. Return EngineV3Result
 */

import { analyzeImage } from '@/lib/gemini';
import { buildAnalysisPrompt } from '@/lib/engine/prompt-builder';
import { evaluateEscalation } from '@/lib/engine/escalation';
import type {
  ClientConfig,
  EngineV3Result,
  AreaResult,
  CriterionResult,
  EvaluationArea,
  EvaluationCriterion,
  RawLLMResponse,
  RawLLMCriterionResult,
} from '@/types/engine';

// ─── Scoring ───

function normalizeRawValue(
  rawValue: boolean | number,
  type: EvaluationCriterion['type'],
  scaleRange?: [number, number],
): number {
  switch (type) {
    case 'binary':
    case 'presence':
      return rawValue === true ? 100 : 0;

    case 'scale': {
      const value = rawValue as number;
      if (!scaleRange) return 0;
      const [min, max] = scaleRange;
      if (max === min) return 100;
      const clamped = Math.max(min, Math.min(max, value));
      return ((clamped - min) / (max - min)) * 100;
    }

    case 'count': {
      // Count criteria: any count > 0 scores 100, 0 scores 0
      // More nuanced scoring can be added later via threshold-based normalization
      const count = rawValue as number;
      return count > 0 ? 100 : 0;
    }
  }
}

function isCriterionFailed(
  rawValue: boolean | number,
  type: EvaluationCriterion['type'],
  critical: boolean,
  scaleRange?: [number, number],
): boolean {
  if (!critical) return false;

  switch (type) {
    case 'binary':
    case 'presence':
      return rawValue === false;

    case 'scale': {
      // Critical scale criterion fails if value is at the minimum of the range
      if (!scaleRange) return false;
      return (rawValue as number) <= scaleRange[0];
    }

    case 'count':
      return (rawValue as number) === 0;
  }
}

function scoreArea(
  area: EvaluationArea,
  rawCriteria: RawLLMCriterionResult[],
): { areaResult: AreaResult; hasCriticalFailure: boolean } {
  const criterionResults: CriterionResult[] = [];
  let hasCriticalFailure = false;

  for (const criterion of area.criteria) {
    const rawMatch = rawCriteria.find((r) => r.criterionId === criterion.id);
    const rawValue = rawMatch?.rawValue ?? (criterion.type === 'binary' || criterion.type === 'presence' ? false : 0);
    const normalizedScore = normalizeRawValue(rawValue, criterion.type, criterion.scaleRange);
    const failed = isCriterionFailed(rawValue, criterion.type, criterion.critical, criterion.scaleRange);

    if (failed) hasCriticalFailure = true;

    criterionResults.push({
      criterionId: criterion.id,
      criterionName: criterion.name,
      type: criterion.type,
      rawValue,
      normalizedScore,
      critical: criterion.critical,
      failed,
      observation: rawMatch?.observation,
    });
  }

  // Area score = weighted sum of criterion scores
  const totalWeight = area.criteria.reduce((sum, c) => sum + c.weight, 0);
  const areaScore = totalWeight > 0
    ? criterionResults.reduce((sum, cr) => {
        const criterion = area.criteria.find((c) => c.id === cr.criterionId)!;
        return sum + cr.normalizedScore * (criterion.weight / totalWeight);
      }, 0)
    : 0;

  return {
    areaResult: {
      areaId: area.id,
      areaName: area.name,
      score: Math.round(areaScore * 100) / 100,
      weight: area.weight,
      passed: !hasCriticalFailure && areaScore >= 50,
      criteria: criterionResults,
    },
    hasCriticalFailure,
  };
}

function calculateGlobalScore(
  areaResults: AreaResult[],
  config: ClientConfig,
): { globalScore: number; passed: boolean } {
  switch (config.globalScoringMethod) {
    case 'weighted': {
      const totalWeight = areaResults.reduce((sum, a) => sum + a.weight, 0);
      const globalScore = totalWeight > 0
        ? areaResults.reduce((sum, a) => sum + a.score * (a.weight / totalWeight), 0)
        : 0;
      return {
        globalScore: Math.round(globalScore * 100) / 100,
        passed: globalScore >= (config.passingScore ?? 70),
      };
    }

    case 'equal': {
      const numAreas = areaResults.length;
      const globalScore = numAreas > 0
        ? areaResults.reduce((sum, a) => sum + a.score, 0) / numAreas
        : 0;
      return {
        globalScore: Math.round(globalScore * 100) / 100,
        passed: globalScore >= (config.passingScore ?? 70),
      };
    }

    case 'pass_fail': {
      const allCriticalsPassed = areaResults.every((area) =>
        area.criteria.filter((c) => c.critical).every((c) => !c.failed),
      );
      // Score is average of area scores for reporting purposes
      const globalScore = areaResults.length > 0
        ? areaResults.reduce((sum, a) => sum + a.score, 0) / areaResults.length
        : 0;
      return {
        globalScore: Math.round(globalScore * 100) / 100,
        passed: allCriticalsPassed,
      };
    }
  }
}

// ─── LLM Response Parsing ───

function parseRawLLMResponse(
  data: Record<string, unknown>,
  config: ClientConfig,
): RawLLMResponse {
  const areas = (data.areas as Array<Record<string, unknown>>) ?? [];

  return {
    photoType: (data.photoType as string) ?? undefined,
    summary: (data.summary as string) ?? '',
    areas: areas.map((rawArea) => {
      const areaId = rawArea.areaId as string;
      const rawCriteria = (rawArea.criteria as Array<Record<string, unknown>>) ?? [];

      return {
        areaId,
        criteria: rawCriteria.map((rc) => ({
          criterionId: rc.criterionId as string,
          rawValue: rc.rawValue as boolean | number,
          observation: (rc.observation as string) ?? undefined,
        })),
      };
    }),
  };
}

// ─── Public API ───

export interface AnalyzeWithConfigResult {
  result: EngineV3Result;
  model: string;
  tokens: { input: number; output: number; total: number };
  processing_time_ms: number;
}

export async function analyzeWithConfig(
  imageBase64: string,
  mimeType: string,
  config: ClientConfig,
  apiKey: string,
): Promise<AnalyzeWithConfigResult> {
  const prompt = buildAnalysisPrompt(config);
  const geminiResult = await analyzeImage(imageBase64, mimeType, prompt, apiKey);

  const rawResponse = parseRawLLMResponse(geminiResult.data, config);

  // Score each area server-side
  const areaResults: AreaResult[] = config.evaluationAreas.map((area) => {
    const rawArea = rawResponse.areas.find((a) => a.areaId === area.id);
    const rawCriteria = rawArea?.criteria ?? [];
    const { areaResult } = scoreArea(area, rawCriteria);
    return areaResult;
  });

  // Calculate global score
  const { globalScore, passed } = calculateGlobalScore(areaResults, config);

  // Build partial result for escalation evaluation
  const engineResult: EngineV3Result = {
    areas: areaResults,
    globalScore,
    passed,
    globalScoringMethod: config.globalScoringMethod,
    escalations: [],
    summary: rawResponse.summary,
    photoType: rawResponse.photoType,
    configId: config.clientId,
    configVersion: config.version,
    engine: 'engine-v3',
  };

  // Evaluate escalation triggers
  engineResult.escalations = evaluateEscalation(engineResult, config.escalationRules);

  return {
    result: engineResult,
    model: geminiResult.model,
    tokens: geminiResult.tokens,
    processing_time_ms: geminiResult.processing_time_ms,
  };
}

// Export scoring functions for testing
export { normalizeRawValue, isCriterionFailed, scoreArea, calculateGlobalScore };
