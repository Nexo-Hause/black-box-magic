/**
 * Engine v3 — Types
 *
 * Multi-industry configurable analysis engine.
 * These types define both the input (ClientConfig) and output (EngineV3Result).
 */

// ─── Industries ───

export const INDUSTRIES = [
  'qsr',
  'retail_btl',
  'construccion',
  'farmaceutica',
  'servicios',
  'operaciones',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// ─── Client Configuration (input to the engine) ───

export interface ClientConfig {
  clientId: string;
  clientName: string;
  industry: Industry;

  evaluationAreas: EvaluationArea[];

  globalScoringMethod: 'weighted' | 'equal' | 'pass_fail';
  passingScore?: number; // 0-100 threshold for "passed"

  escalationRules: EscalationRule[];

  industryContext: string;
  customInstructions: string;

  referenceImages?: ReferenceImage[];

  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationArea {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1, all weights should sum to ~1.0
  criteria: EvaluationCriterion[];
  applicableTo?: string[]; // photo types where this area applies
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  type: 'binary' | 'scale' | 'count' | 'presence';
  description: string;
  weight: number;
  critical: boolean; // if failed, entire area fails
  scaleRange?: [number, number]; // for type 'scale' (e.g., [1, 5])
}

export interface ReferenceImage {
  url: string;
  label: 'correct' | 'incorrect';
  area: string; // which EvaluationArea this references
  description: string;
}

// ─── Escalation ───

export interface EscalationRule {
  id: string;
  trigger: EscalationTrigger;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'escalate' | 'block';
  notifyTo?: string;
  description: string; // human-readable, included in prompt as context
}

export type EscalationTrigger =
  | { type: 'global_score_below'; threshold: number }
  | { type: 'area_score_below'; areaId: string; threshold: number }
  | { type: 'critical_criterion_failed'; criterionId?: string }
  | { type: 'any_criterion_failed_in_area'; areaId: string }
  | { type: 'count_below'; criterionId: string; threshold: number }
  | { type: 'count_above'; criterionId: string; threshold: number };

// ─── Analysis Result (output from the engine) ───

export interface EngineV3Result {
  areas: AreaResult[];

  // Global scoring (calculated server-side, NOT by the LLM)
  globalScore: number;
  passed: boolean;
  globalScoringMethod: 'weighted' | 'equal' | 'pass_fail';

  escalations: EscalationEvent[];

  summary: string;
  photoType?: string;

  // Metadata
  configId: string;
  configVersion: number;
  engine: 'engine-v3';
}

export interface AreaResult {
  areaId: string;
  areaName: string;
  score: number; // 0-100, calculated server-side
  weight: number;
  passed: boolean;
  criteria: CriterionResult[];
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  type: 'binary' | 'scale' | 'count' | 'presence';
  rawValue: boolean | number;
  normalizedScore: number; // 0-100, calculated server-side
  critical: boolean;
  failed: boolean;
  observation?: string;
}

export interface EscalationEvent {
  ruleId: string;
  trigger: string; // human-readable description of what triggered
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'escalate' | 'block';
  reason: string;
}

// ─── Raw LLM Response (what the LLM returns before server-side scoring) ───

export interface RawLLMAreaResult {
  areaId: string;
  criteria: RawLLMCriterionResult[];
}

export interface RawLLMCriterionResult {
  criterionId: string;
  rawValue: boolean | number;
  observation?: string;
}

export interface RawLLMResponse {
  photoType?: string;
  summary: string;
  areas: RawLLMAreaResult[];
}
