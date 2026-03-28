/**
 * Engine v3 — QSR Default ClientConfig
 *
 * Replicates the behavior of the legacy hybrid prompt engine v2 (src/lib/prompts.ts)
 * as a structured ClientConfig. This is the first config used for testing engine v3.
 *
 * Legacy facet mapping:
 *   inventory     → area 'inventory'
 *   shelf_share   → area 'shelf-share'
 *   pricing       → area 'pricing'
 *   compliance    → area 'compliance'   (weight 0.20)
 *   condition     → area 'condition'    (weight 0.25)
 *   context       → area 'context'      (weight 0.05)
 *   insights      → area 'insights'     (weight 0.05)
 *
 * Legacy escalation (shouldEscalate) fires when:
 *   - severity === 'CRITICAL' or 'MODERATE'
 *   - cleanliness === 'DIRTY'
 *   - displays === 'DAMAGED'
 *   - safety_issues.length > 0
 */

import { type ClientConfig } from '@/types/engine';

export const QSR_DEFAULT_CONFIG: ClientConfig = {
  clientId: 'qsr-default',
  clientName: 'QSR Default (Legacy)',
  industry: 'qsr',

  // ─── Evaluation Areas ───
  // Weights: condition 0.25, compliance 0.20, inventory 0.20,
  //          shelf-share 0.10, pricing 0.10, context 0.05, insights 0.10
  // Sum: 1.00
  evaluationAreas: [
    // ── 1. Inventory ─────────────────────────────────────────────────────────
    {
      id: 'inventory',
      name: 'Inventario',
      description:
        'Productos, marcas y cantidades visibles en la foto. Detectar todos los SKUs presentes sin truncar.',
      weight: 0.20,
      criteria: [
        {
          id: 'inv-items-present',
          name: 'Productos visibles detectados',
          type: 'binary',
          description: 'Se detectó al menos un producto visible en la imagen.',
          weight: 0.3,
          critical: false,
        },
        {
          id: 'inv-sku-count',
          name: 'Cantidad de SKUs detectados',
          type: 'count',
          description:
            'Número total de SKUs únicos identificados. Todos los productos visibles deben listarse; no truncar.',
          weight: 0.4,
          critical: false,
        },
        {
          id: 'inv-brands-identified',
          name: 'Marcas identificadas',
          type: 'presence',
          description: 'Se identificó al menos una marca en los productos visibles.',
          weight: 0.3,
          critical: false,
        },
      ],
    },

    // ── 2. Shelf Share ────────────────────────────────────────────────────────
    {
      id: 'shelf-share',
      name: 'Share de Góndola',
      description:
        'Distribución del espacio por marca y marca dominante. Estimar porcentajes de participación.',
      weight: 0.10,
      criteria: [
        {
          id: 'ss-brands-measured',
          name: 'Marcas con share medido',
          type: 'presence',
          description: 'Se estimó la distribución de espacio por al menos una marca.',
          weight: 0.4,
          critical: false,
        },
        {
          id: 'ss-dominant-identified',
          name: 'Marca dominante identificada',
          type: 'binary',
          description: 'Se determinó qué marca ocupa el mayor espacio en góndola.',
          weight: 0.35,
          critical: false,
        },
        {
          id: 'ss-share-coverage',
          name: 'Cobertura de estimación (%)',
          type: 'scale',
          description:
            'Porcentaje del espacio visible cubierto por la estimación de share (suma de pcts asignados, 0-100).',
          weight: 0.25,
          critical: false,
          scaleRange: [0, 100],
        },
      ],
    },

    // ── 3. Pricing ────────────────────────────────────────────────────────────
    {
      id: 'pricing',
      name: 'Precios',
      description:
        'Precios visibles, moneda, tipo (regular/promo/bundle) y estrategias de precio detectadas.',
      weight: 0.10,
      criteria: [
        {
          id: 'price-count',
          name: 'Precios detectados',
          type: 'count',
          description: 'Número de precios legibles identificados en la imagen.',
          weight: 0.5,
          critical: false,
        },
        {
          id: 'price-strategy-detected',
          name: 'Estrategia de precio detectada',
          type: 'binary',
          description:
            'Se identificó al menos una estrategia de precio (precio psicológico, bundle, promoción, etc.).',
          weight: 0.5,
          critical: false,
        },
      ],
    },

    // ── 4. Compliance ─────────────────────────────────────────────────────────
    {
      id: 'compliance',
      name: 'Cumplimiento',
      description:
        'Calidad de ejecución del punto de venta: score HIGH/MEDIUM/LOW, materiales POP, facing de producto y señalética.',
      weight: 0.20,
      criteria: [
        {
          id: 'comp-score',
          name: 'Score de cumplimiento',
          type: 'scale',
          description:
            'Nivel general de cumplimiento: 1 = LOW, 2 = MEDIUM, 3 = HIGH.',
          weight: 0.35,
          critical: false,
          scaleRange: [1, 3],
        },
        {
          id: 'comp-pop-present',
          name: 'Materiales POP presentes',
          type: 'binary',
          description: 'Hay materiales POP (carteles, cenefas, wobblers, displays) visibles.',
          weight: 0.20,
          critical: false,
        },
        {
          id: 'comp-pop-installed',
          name: 'POP correctamente instalado',
          type: 'binary',
          description: 'Los materiales POP están correctamente instalados y en buen estado.',
          weight: 0.20,
          critical: false,
        },
        {
          id: 'comp-facing',
          name: 'Facing de producto correcto',
          type: 'binary',
          description:
            'Los productos muestran el frente hacia el cliente (facing CORRECT o PARTIAL cuenta como cumplimiento parcial).',
          weight: 0.15,
          critical: false,
        },
        {
          id: 'comp-signage',
          name: 'Señalética visible',
          type: 'binary',
          description: 'La señalética de precio y/o marca es visible (VISIBLE o PARTIAL).',
          weight: 0.10,
          critical: false,
        },
      ],
    },

    // ── 5. Condition ──────────────────────────────────────────────────────────
    {
      id: 'condition',
      name: 'Condición',
      description:
        'Estado físico del local: limpieza CLEAN/ACCEPTABLE/DIRTY, displays GOOD/WORN/DAMAGED, iluminación y seguridad.',
      weight: 0.25,
      criteria: [
        {
          id: 'crit-floor-clean',
          name: 'Limpieza del área',
          type: 'scale',
          description:
            'Estado de limpieza visible: 1 = DIRTY (requiere escalación), 2 = ACCEPTABLE, 3 = CLEAN.',
          weight: 0.35,
          critical: true,
          scaleRange: [1, 3],
        },
        {
          id: 'crit-displays',
          name: 'Estado de displays',
          type: 'scale',
          description:
            'Condición de muebles y exhibidores: 1 = DAMAGED (requiere escalación), 2 = WORN, 3 = GOOD.',
          weight: 0.30,
          critical: true,
          scaleRange: [1, 3],
        },
        {
          id: 'crit-lighting',
          name: 'Iluminación',
          type: 'scale',
          description: 'Calidad de iluminación visible: 1 = POOR, 2 = ADEQUATE, 3 = GOOD.',
          weight: 0.15,
          critical: false,
          scaleRange: [1, 3],
        },
        {
          id: 'crit-safety',
          name: 'Sin problemas de seguridad',
          type: 'binary',
          description:
            'No se detectaron riesgos de seguridad (derrames, cables expuestos, objetos caídos, etc.). true = sin problemas.',
          weight: 0.20,
          critical: true,
        },
      ],
    },

    // ── 6. Context ────────────────────────────────────────────────────────────
    {
      id: 'context',
      name: 'Contexto',
      description:
        'Tipo de establecimiento, ubicación inferida, entorno (URBAN/SUBURBAN/RURAL) y tráfico de clientes.',
      weight: 0.05,
      criteria: [
        {
          id: 'ctx-establishment-typed',
          name: 'Tipo de establecimiento identificado',
          type: 'binary',
          description: 'Se pudo determinar el tipo de establecimiento (QSR, kiosko, supermercado, etc.).',
          weight: 0.5,
          critical: false,
        },
        {
          id: 'ctx-location-inferred',
          name: 'Ubicación inferida',
          type: 'binary',
          description: 'Se pudo inferir al menos región o país con confianza MEDIUM o HIGH.',
          weight: 0.5,
          critical: false,
        },
      ],
    },

    // ── 7. Insights ───────────────────────────────────────────────────────────
    {
      id: 'insights',
      name: 'Insights',
      description:
        'Fortalezas, oportunidades, amenazas y recomendaciones accionables derivadas del análisis.',
      weight: 0.10,
      criteria: [
        {
          id: 'ins-strengths',
          name: 'Fortalezas identificadas',
          type: 'presence',
          description: 'Se listó al menos una fortaleza observable.',
          weight: 0.20,
          critical: false,
        },
        {
          id: 'ins-opportunities',
          name: 'Oportunidades identificadas',
          type: 'presence',
          description: 'Se listó al menos una oportunidad de mejora.',
          weight: 0.20,
          critical: false,
        },
        {
          id: 'ins-recommendations',
          name: 'Recomendaciones accionables',
          type: 'count',
          description: 'Número de recomendaciones concretas y accionables incluidas.',
          weight: 0.60,
          critical: false,
        },
      ],
    },
  ],

  // ─── Scoring ───
  globalScoringMethod: 'weighted',
  passingScore: 70,

  // ─── Escalation Rules ───────────────────────────────────────────────────────
  // Replicates shouldEscalate() from src/lib/prompts.ts:
  //   severity === 'CRITICAL' or 'MODERATE'  → area_score_below on condition
  //   cleanliness === 'DIRTY'                → critical_criterion_failed on crit-floor-clean
  //   displays === 'DAMAGED'                 → critical_criterion_failed on crit-displays
  //   safety_issues.length > 0              → critical_criterion_failed on crit-safety
  escalationRules: [
    {
      id: 'esc-condition-critical',
      trigger: {
        type: 'area_score_below',
        areaId: 'condition',
        threshold: 40,
      },
      severity: 'critical',
      action: 'escalate',
      description:
        'Score de condición menor a 40 — equivalente a severidad CRITICAL en el motor legado. ' +
        'Dispara segunda pasada de inspección detallada.',
    },
    {
      id: 'esc-condition-moderate',
      trigger: {
        type: 'area_score_below',
        areaId: 'condition',
        threshold: 65,
      },
      severity: 'high',
      action: 'escalate',
      description:
        'Score de condición menor a 65 — equivalente a severidad MODERATE en el motor legado. ' +
        'Dispara segunda pasada de inspección detallada.',
    },
    {
      id: 'esc-dirty',
      trigger: {
        type: 'critical_criterion_failed',
        criterionId: 'crit-floor-clean',
      },
      severity: 'high',
      action: 'escalate',
      description:
        'Criterio de limpieza fallido (crit-floor-clean = DIRTY, score 1). ' +
        'Replica la condición cleanliness === DIRTY de shouldEscalate().',
    },
    {
      id: 'esc-damaged-displays',
      trigger: {
        type: 'critical_criterion_failed',
        criterionId: 'crit-displays',
      },
      severity: 'high',
      action: 'escalate',
      description:
        'Criterio de displays fallido (crit-displays = DAMAGED, score 1). ' +
        'Replica la condición displays === DAMAGED de shouldEscalate().',
    },
    {
      id: 'esc-safety',
      trigger: {
        type: 'critical_criterion_failed',
        criterionId: 'crit-safety',
      },
      severity: 'critical',
      action: 'escalate',
      description:
        'Problemas de seguridad detectados (crit-safety = false). ' +
        'Replica la condición safety_issues.length > 0 de shouldEscalate().',
    },
  ],

  // ─── Context & Instructions ───
  industryContext:
    'Inspección de campo en puntos de venta QSR (Quick Service Restaurants) y retail de conveniencia. ' +
    'El objetivo es evaluar la ejecución en góndola, el estado del local y el cumplimiento de estándares de marca. ' +
    'Las fotos pueden mostrar heladeras, góndolas, mostradores, vitrinas o el exterior del local.',
  customInstructions: '',

  // ─── Version ───
  version: 1,
  createdAt: '2026-03-28T00:00:00.000Z',
  updatedAt: '2026-03-28T00:00:00.000Z',
};
