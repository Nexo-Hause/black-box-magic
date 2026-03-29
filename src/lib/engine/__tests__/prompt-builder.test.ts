import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt, buildEscalationPrompt } from '@/lib/engine/prompt-builder';
import { QSR_DEFAULT_CONFIG } from '@/lib/engine/qsr-default-config';
import type { AreaResult } from '@/types/engine';

// ─── buildAnalysisPrompt ─────────────────────────────────────────────────────

describe('buildAnalysisPrompt', () => {
  const prompt = buildAnalysisPrompt(QSR_DEFAULT_CONFIG);

  it('contains all evaluation area names', () => {
    for (const area of QSR_DEFAULT_CONFIG.evaluationAreas) {
      expect(prompt).toContain(area.name);
    }
  });

  it('contains all criterion names', () => {
    for (const area of QSR_DEFAULT_CONFIG.evaluationAreas) {
      for (const criterion of area.criteria) {
        expect(prompt).toContain(criterion.name);
      }
    }
  });

  it('contains weight values for evaluation areas', () => {
    for (const area of QSR_DEFAULT_CONFIG.evaluationAreas) {
      expect(prompt).toContain(String(area.weight));
    }
  });

  it('marks critical criteria with "[CRÍTICO]"', () => {
    const hasCritical = QSR_DEFAULT_CONFIG.evaluationAreas
      .flatMap((a) => a.criteria)
      .some((c) => c.critical);

    expect(hasCritical).toBe(true);
    expect(prompt).toContain('[CRÍTICO]');
  });

  it('contains scoring method instruction', () => {
    // QSR_DEFAULT_CONFIG uses "weighted" method
    expect(prompt).toContain('ponderado');
  });

  it('contains industry context wrapped in delimiters', () => {
    expect(prompt).toContain('=== CONTEXTO DEL CLIENTE');
    expect(prompt).toContain('=== FIN CONTEXTO ===');
    expect(prompt).toContain(QSR_DEFAULT_CONFIG.industryContext);
  });

  it('contains the anti-scoring instruction (NO calcules scores)', () => {
    expect(prompt).toContain('NO calcules scores');
  });

  it('contains dynamic JSON schema with area IDs', () => {
    for (const area of QSR_DEFAULT_CONFIG.evaluationAreas) {
      expect(prompt).toContain(`"areaId": "${area.id}"`);
    }
  });
});

// ─── buildEscalationPrompt ───────────────────────────────────────────────────

describe('buildEscalationPrompt', () => {
  const mockAreaResults: AreaResult[] = [
    {
      areaId: 'condition',
      areaName: 'Condición',
      score: 30,
      weight: 0.25,
      passed: false,
      criteria: [
        {
          criterionId: 'crit-floor-clean',
          criterionName: 'Limpieza del área',
          type: 'scale',
          rawValue: 1,
          normalizedScore: 0,
          critical: true,
          failed: true,
          observation: 'Piso con residuos visibles',
        },
        {
          criterionId: 'crit-safety',
          criterionName: 'Sin problemas de seguridad',
          type: 'binary',
          rawValue: false,
          normalizedScore: 0,
          critical: true,
          failed: true,
          observation: 'Cable expuesto en zona de tránsito',
        },
        {
          criterionId: 'crit-lighting',
          criterionName: 'Iluminación',
          type: 'scale',
          rawValue: 2,
          normalizedScore: 50,
          critical: false,
          failed: false,
        },
      ],
    },
  ];

  const prompt = buildEscalationPrompt(QSR_DEFAULT_CONFIG, mockAreaResults);

  it('includes failed criteria information', () => {
    // Both failed criterion names should appear in the escalation prompt
    expect(prompt).toContain('Limpieza del área');
    expect(prompt).toContain('Sin problemas de seguridad');
  });

  it('includes area name and score from area results', () => {
    expect(prompt).toContain('Condición');
    expect(prompt).toContain('30/100');
  });

  it('marks critical failed criteria with [CRÍTICO]', () => {
    expect(prompt).toContain('[CRÍTICO]');
  });

  it('includes failure observations', () => {
    expect(prompt).toContain('Piso con residuos visibles');
    expect(prompt).toContain('Cable expuesto en zona de tránsito');
  });

  it('includes escalation rules context', () => {
    // At least one escalation rule description should appear
    expect(prompt).toContain('REGLAS DE ESCALACIÓN');
  });

  it('includes industry context between delimiters', () => {
    expect(prompt).toContain('=== CONTEXTO DEL CLIENTE');
    expect(prompt).toContain('=== FIN CONTEXTO ===');
    expect(prompt).toContain(QSR_DEFAULT_CONFIG.industryContext);
  });
});
