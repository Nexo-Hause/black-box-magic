/**
 * Engine v3 — ClientConfig validation and Supabase persistence
 */

import { z } from 'zod/v4';
import { supabase } from '@/lib/supabase';
import { INDUSTRIES, type ClientConfig } from '@/types/engine';

// ─── Anti-injection ───

const INJECTION_PATTERN =
  /ignore previous|override|forget|new role|system:|assistant:|user:/i;

function noInjection(val: string): boolean {
  return !INJECTION_PATTERN.test(val);
}

// ─── Leaf schemas ───

const escalationTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('global_score_below'), threshold: z.number().min(0).max(100) }),
  z.object({ type: z.literal('area_score_below'), areaId: z.string().min(1), threshold: z.number().min(0).max(100) }),
  z.object({ type: z.literal('critical_criterion_failed'), criterionId: z.string().optional() }),
  z.object({ type: z.literal('any_criterion_failed_in_area'), areaId: z.string().min(1) }),
  z.object({ type: z.literal('count_below'), criterionId: z.string().min(1), threshold: z.number() }),
  z.object({ type: z.literal('count_above'), criterionId: z.string().min(1), threshold: z.number() }),
]);

const evaluationCriterionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['binary', 'scale', 'count', 'presence']),
    description: z.string().min(1),
    weight: z.number().min(0).max(1),
    critical: z.boolean(),
    scaleRange: z.tuple([z.number(), z.number()]).optional(),
  })
  .refine(
    (c) => c.type !== 'scale' || (c.scaleRange !== undefined && c.scaleRange[0] < c.scaleRange[1]),
    { message: 'scaleRange[0] must be less than scaleRange[1] when type is "scale"' }
  );

const evaluationAreaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().min(0).max(1),
  criteria: z.array(evaluationCriterionSchema).min(1).max(15),
  applicableTo: z.array(z.string()).optional(),
});

const escalationRuleSchema = z.object({
  id: z.string().min(1),
  trigger: escalationTriggerSchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.enum(['flag', 'escalate', 'block']),
  notifyTo: z.string().optional(),
  description: z.string().min(1),
});

const referenceImageSchema = z.object({
  url: z.string().url(),
  label: z.enum(['correct', 'incorrect']),
  area: z.string().min(1),
  description: z.string().min(1),
});

// ─── Root schema ───

export const clientConfigSchema = z
  .object({
    clientId: z.string().min(1),
    clientName: z.string().min(1),
    industry: z.enum(INDUSTRIES),
    evaluationAreas: z.array(evaluationAreaSchema).min(1).max(10),
    globalScoringMethod: z.enum(['weighted', 'equal', 'pass_fail']),
    passingScore: z.number().min(0).max(100).optional(),
    escalationRules: z.array(escalationRuleSchema).max(20),
    industryContext: z
      .string()
      .max(1000)
      .refine(noInjection, { message: 'industryContext contains disallowed patterns' }),
    customInstructions: z
      .string()
      .max(500)
      .refine(noInjection, { message: 'customInstructions contains disallowed patterns' }),
    referenceImages: z.array(referenceImageSchema).optional(),
    version: z.number().int().positive(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .refine(
    (cfg) => {
      const sum = cfg.evaluationAreas.reduce((acc, a) => acc + a.weight, 0);
      return Math.abs(sum - 1.0) <= 0.05;
    },
    { message: 'evaluationAreas weights must sum to ~1.0 (±0.05)' }
  );

// ─── Supabase operations ───

export async function getActiveConfig(clientId: string): Promise<ClientConfig | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('bbm_client_configs')
    .select('config')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error('getActiveConfig error:', error.message);
    }
    return null;
  }

  return data.config as ClientConfig;
}

export async function saveConfig(config: ClientConfig): Promise<ClientConfig> {
  const validated = clientConfigSchema.parse(config) as ClientConfig;

  if (!supabase) {
    console.warn('saveConfig: Supabase not configured — skipping persistence');
    return validated;
  }

  const { error } = await supabase.from('bbm_client_configs').insert({
    client_id: validated.clientId,
    client_name: validated.clientName,
    industry: validated.industry,
    status: 'draft',
    config: validated,
    updated_at: validated.updatedAt,
  });

  if (error) {
    console.error('saveConfig error:', error.message);
  }

  return validated;
}
