import type {
  EngineV3Result,
  EscalationRule,
  EscalationEvent,
  CriterionResult,
} from '@/types/engine';

// ─── Severity ordering for sorting ───

const SEVERITY_ORDER: Record<EscalationEvent['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Helpers ───

function findCriterionById(
  result: EngineV3Result,
  criterionId: string
): CriterionResult | undefined {
  for (const area of result.areas) {
    const found = area.criteria.find((c) => c.criterionId === criterionId);
    if (found) return found;
  }
  return undefined;
}

function findCriterionByIdInArea(
  result: EngineV3Result,
  areaId: string,
  criterionId: string
): CriterionResult | undefined {
  const area = result.areas.find((a) => a.areaId === areaId);
  return area?.criteria.find((c) => c.criterionId === criterionId);
}

// ─── Main ───

/**
 * Evaluates structured escalation rules against a scored EngineV3Result.
 * Called after server-side scoring — no side effects, pure function.
 *
 * @returns EscalationEvent[] sorted by severity (critical → high → medium → low)
 */
export function evaluateEscalation(
  result: EngineV3Result,
  rules: EscalationRule[]
): EscalationEvent[] {
  const events: EscalationEvent[] = [];

  for (const rule of rules) {
    const { trigger } = rule;

    switch (trigger.type) {
      case 'global_score_below': {
        if (result.globalScore < trigger.threshold) {
          events.push({
            ruleId: rule.id,
            trigger: `Score global (${result.globalScore}) por debajo del umbral (${trigger.threshold})`,
            severity: rule.severity,
            action: rule.action,
            reason: rule.description,
          });
        }
        break;
      }

      case 'area_score_below': {
        const area = result.areas.find((a) => a.areaId === trigger.areaId);
        if (area && area.score < trigger.threshold) {
          events.push({
            ruleId: rule.id,
            trigger: `Score del área "${area.areaName}" (${area.score}) por debajo del umbral (${trigger.threshold})`,
            severity: rule.severity,
            action: rule.action,
            reason: rule.description,
          });
        }
        break;
      }

      case 'critical_criterion_failed': {
        if (trigger.criterionId !== undefined) {
          // Check only the specified criterion
          const criterion = findCriterionById(result, trigger.criterionId);
          if (criterion && criterion.critical && criterion.failed) {
            events.push({
              ruleId: rule.id,
              trigger: `Criterio crítico "${criterion.criterionName}" (${trigger.criterionId}) falló`,
              severity: rule.severity,
              action: rule.action,
              reason: rule.description,
            });
          }
        } else {
          // Check any critical criterion across all areas
          for (const area of result.areas) {
            const failedCritical = area.criteria.find(
              (c) => c.critical && c.failed
            );
            if (failedCritical) {
              events.push({
                ruleId: rule.id,
                trigger: `Criterio crítico "${failedCritical.criterionName}" en área "${area.areaName}" falló`,
                severity: rule.severity,
                action: rule.action,
                reason: rule.description,
              });
              break; // one event per rule
            }
          }
        }
        break;
      }

      case 'any_criterion_failed_in_area': {
        const area = result.areas.find((a) => a.areaId === trigger.areaId);
        if (area) {
          const failedCriterion = area.criteria.find((c) => c.failed);
          if (failedCriterion) {
            events.push({
              ruleId: rule.id,
              trigger: `Criterio "${failedCriterion.criterionName}" falló en área "${area.areaName}"`,
              severity: rule.severity,
              action: rule.action,
              reason: rule.description,
            });
          }
        }
        break;
      }

      case 'count_below': {
        const criterion = findCriterionById(result, trigger.criterionId);
        if (criterion && criterion.type === 'count') {
          const value = criterion.rawValue as number;
          if (value < trigger.threshold) {
            events.push({
              ruleId: rule.id,
              trigger: `Conteo de "${criterion.criterionName}" (${value}) por debajo del mínimo (${trigger.threshold})`,
              severity: rule.severity,
              action: rule.action,
              reason: rule.description,
            });
          }
        }
        break;
      }

      case 'count_above': {
        const criterion = findCriterionById(result, trigger.criterionId);
        if (criterion && criterion.type === 'count') {
          const value = criterion.rawValue as number;
          if (value > trigger.threshold) {
            events.push({
              ruleId: rule.id,
              trigger: `Conteo de "${criterion.criterionName}" (${value}) por encima del máximo (${trigger.threshold})`,
              severity: rule.severity,
              action: rule.action,
              reason: rule.description,
            });
          }
        }
        break;
      }
    }
  }

  return events.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}
