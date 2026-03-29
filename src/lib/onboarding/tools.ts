/**
 * BBM Onboarding — Tool Declarations & Processor
 *
 * Defines Gemini function calling tools for the onboarding chat session,
 * plus a processor that applies tool calls to a mutable partial config.
 */

import { z } from 'zod/v4';
import type { GeminiTool, FunctionDeclaration } from '@/lib/gemini-chat';

// ─── Anti-injection ───────────────────────────────────────────────────────────

const INJECTION_PATTERN =
  /ignore previous|override|forget|new role|system:|assistant:|user:|disregard all|you are now|from now on/i;

function noInjection(val: string): boolean {
  return !INJECTION_PATTERN.test(val);
}

const safeString = z.string().refine(noInjection, {
  message: 'El valor contiene patrones no permitidos',
});

// ─── Partial Config ───────────────────────────────────────────────────────────

export interface PartialCriterion {
  id: string;
  name: string;
  type: 'binary' | 'scale' | 'count' | 'presence';
  description: string;
  critical: boolean;
  scaleMin?: number;
  scaleMax?: number;
}

export interface PartialArea {
  id: string;
  name: string;
  description: string;
  weight: number;
  criteria: PartialCriterion[];
}

export interface PartialEscalationRule {
  description: string;
  severity: string;
  action: string;
}

export interface PartialOnboardingConfig {
  industry?: string;
  industryDescription?: string;
  areas: PartialArea[];
  scoringMethod?: 'weighted' | 'equal' | 'pass_fail';
  passingScore?: number;
  escalationRules: PartialEscalationRule[];
  isComplete: boolean;
}

export function createEmptyPartialConfig(): PartialOnboardingConfig {
  return {
    areas: [],
    escalationRules: [],
    isComplete: false,
  };
}

// ─── Tool Declarations ────────────────────────────────────────────────────────

const setIndustryDeclaration: FunctionDeclaration = {
  name: 'setIndustry',
  description:
    'Registra el sector/industria del cliente y una descripción breve de su operación. Llamar cuando se identifique el sector (retail, QSR, farma, construcción, etc.).',
  parameters: {
    type: 'object',
    properties: {
      industry: {
        type: 'string',
        description:
          'Identificador del sector (ej: "qsr", "retail_btl", "construccion", "farmaceutica", "servicios", "operaciones").',
      },
      description: {
        type: 'string',
        description:
          'Descripción breve de la operación del cliente en su propio contexto.',
      },
    },
    required: ['industry', 'description'],
  },
};

const addAreaDeclaration: FunctionDeclaration = {
  name: 'addArea',
  description:
    'Agrega un área de evaluación (tipo de espacio o punto que fotografían). Llamar una vez por cada área identificada.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Identificador único del área (ej: "anaquel", "fachada", "cocina").',
      },
      name: {
        type: 'string',
        description: 'Nombre legible del área.',
      },
      description: {
        type: 'string',
        description: 'Descripción de qué cubre esta área de evaluación.',
      },
      weight: {
        type: 'number',
        description:
          'Peso relativo del área en el score global (0 a 1). La suma de todos los pesos debe ser ~1.0.',
      },
    },
    required: ['id', 'name', 'description', 'weight'],
  },
};

const addCriterionDeclaration: FunctionDeclaration = {
  name: 'addCriterion',
  description:
    'Agrega un criterio de evaluación a un área existente. Llamar una vez por cada criterio identificado en la sesión.',
  parameters: {
    type: 'object',
    properties: {
      areaId: {
        type: 'string',
        description: 'ID del área a la que pertenece este criterio.',
      },
      id: {
        type: 'string',
        description: 'Identificador único del criterio dentro del área.',
      },
      name: {
        type: 'string',
        description: 'Nombre legible del criterio.',
      },
      type: {
        type: 'string',
        enum: ['binary', 'scale', 'count', 'presence'],
        description:
          '"binary" = sí/no, "scale" = escala numérica, "count" = conteo de elementos, "presence" = detección de presencia.',
      },
      description: {
        type: 'string',
        description: 'Descripción de qué evalúa este criterio y cómo interpretarlo.',
      },
      critical: {
        type: 'boolean',
        description:
          'Si es true, reprobar este criterio reprueba el área completa.',
      },
      scaleMin: {
        type: 'number',
        description: 'Valor mínimo de la escala (solo para type "scale").',
      },
      scaleMax: {
        type: 'number',
        description: 'Valor máximo de la escala (solo para type "scale").',
      },
    },
    required: ['areaId', 'id', 'name', 'type', 'description', 'critical'],
  },
};

const setScoringDeclaration: FunctionDeclaration = {
  name: 'setScoring',
  description:
    'Define el método de scoring global para la configuración del cliente.',
  parameters: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['weighted', 'equal', 'pass_fail'],
        description:
          '"weighted" = ponderado por peso de áreas, "equal" = todas las áreas con igual peso, "pass_fail" = solo aprobado/reprobado.',
      },
      passingScore: {
        type: 'number',
        description:
          'Umbral mínimo para aprobar (0–100). Solo aplica para métodos "weighted" y "equal".',
      },
    },
    required: ['method'],
  },
};

const addEscalationRuleDeclaration: FunctionDeclaration = {
  name: 'addEscalationRule',
  description:
    'Agrega una regla de escalación: cuándo alertar, con qué severidad y qué acción tomar. El trigger se construirá a partir de la descripción en la síntesis final.',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'Descripción legible de la condición que dispara la regla (ej: "Anaquel con menos de 3 facings del producto principal").',
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Nivel de severidad de la alerta.',
      },
      action: {
        type: 'string',
        enum: ['flag', 'escalate', 'block'],
        description:
          '"flag" = marcar para revisión, "escalate" = notificar a supervisor, "block" = bloquear aprobación.',
      },
    },
    required: ['description', 'severity', 'action'],
  },
};

const markCompleteDeclaration: FunctionDeclaration = {
  name: 'markComplete',
  description:
    'Indica que se recopiló suficiente información de las fases 1–4 para configurar BBM. Llamar al final de la Fase 5 (antes de solicitar las fotos de prueba).',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export function getOnboardingToolDeclarations(): GeminiTool {
  return {
    functionDeclarations: [
      setIndustryDeclaration,
      addAreaDeclaration,
      addCriterionDeclaration,
      setScoringDeclaration,
      addEscalationRuleDeclaration,
      markCompleteDeclaration,
    ],
  };
}

// ─── Zod Schemas (per tool) ───────────────────────────────────────────────────

const setIndustryArgs = z.object({
  industry: safeString,
  description: safeString,
});

const addAreaArgs = z.object({
  id: safeString,
  name: safeString,
  description: safeString,
  weight: z.number().min(0).max(1),
});

const addCriterionArgs = z.object({
  areaId: safeString,
  id: safeString,
  name: safeString,
  type: z.enum(['binary', 'scale', 'count', 'presence']),
  description: safeString,
  critical: z.boolean(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
});

const setScoringArgs = z.object({
  method: z.enum(['weighted', 'equal', 'pass_fail']),
  passingScore: z.number().min(0).max(100).optional(),
});

const addEscalationRuleArgs = z.object({
  description: safeString,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.enum(['flag', 'escalate', 'block']),
});

const markCompleteArgs = z.object({});

// ─── Processor ────────────────────────────────────────────────────────────────

export function processToolCall(
  name: string,
  args: Record<string, unknown>,
  config: PartialOnboardingConfig
): PartialOnboardingConfig {
  switch (name) {
    case 'setIndustry': {
      const parsed = setIndustryArgs.parse(args);
      return {
        ...config,
        industry: parsed.industry,
        industryDescription: parsed.description,
      };
    }

    case 'addArea': {
      const parsed = addAreaArgs.parse(args);
      const area: PartialArea = {
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        weight: parsed.weight,
        criteria: [],
      };
      return {
        ...config,
        areas: [...config.areas, area],
      };
    }

    case 'addCriterion': {
      const parsed = addCriterionArgs.parse(args);
      const areaIndex = config.areas.findIndex((a) => a.id === parsed.areaId);
      if (areaIndex === -1) {
        throw new Error(
          `addCriterion: no existe el área con id "${parsed.areaId}"`
        );
      }
      const criterion: PartialCriterion = {
        id: parsed.id,
        name: parsed.name,
        type: parsed.type,
        description: parsed.description,
        critical: parsed.critical,
        ...(parsed.scaleMin !== undefined && { scaleMin: parsed.scaleMin }),
        ...(parsed.scaleMax !== undefined && { scaleMax: parsed.scaleMax }),
      };
      const updatedAreas = config.areas.map((area, i) =>
        i === areaIndex
          ? { ...area, criteria: [...area.criteria, criterion] }
          : area
      );
      return { ...config, areas: updatedAreas };
    }

    case 'setScoring': {
      const parsed = setScoringArgs.parse(args);
      return {
        ...config,
        scoringMethod: parsed.method,
        ...(parsed.passingScore !== undefined && {
          passingScore: parsed.passingScore,
        }),
      };
    }

    case 'addEscalationRule': {
      const parsed = addEscalationRuleArgs.parse(args);
      const rule: PartialEscalationRule = {
        description: parsed.description,
        severity: parsed.severity,
        action: parsed.action,
      };
      return {
        ...config,
        escalationRules: [...config.escalationRules, rule],
      };
    }

    case 'markComplete': {
      markCompleteArgs.parse(args);
      return { ...config, isComplete: true };
    }

    default:
      throw new Error(`processToolCall: herramienta desconocida "${name}"`);
  }
}

export function processAllToolCalls(
  calls: Array<{ name: string; args: Record<string, unknown> }>,
  config: PartialOnboardingConfig
): PartialOnboardingConfig {
  return calls.reduce(
    (acc, call) => processToolCall(call.name, call.args, acc),
    config
  );
}
