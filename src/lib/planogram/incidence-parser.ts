/**
 * Parse raw Gemini incidence response into typed Incidence[] objects.
 * Assigns UUIDs, validates categories/severities, counts by severity.
 */

import type { Incidence, IncidenceCategory, IncidenceSeverity, RawIncidenceResponse } from '@/types/incidence';

const VALID_CATEGORIES: IncidenceCategory[] = [
  'missing_product', 'wrong_position', 'wrong_price', 'empty_shelf',
  'unauthorized_product', 'damaged_product', 'wrong_facing', 'other',
];

const VALID_SEVERITIES: IncidenceSeverity[] = ['critical', 'high', 'medium', 'low'];

export interface ParsedIncidenceResult {
  incidences: Incidence[];
  incidenceCount: number;
  severityCritical: number;
  severityHigh: number;
  severityMedium: number;
  severityLow: number;
  summary: string;
  photoQuality: string;
  coverage: string;
  shelfOverview?: {
    totalExpectedProducts: number;
    totalDetectedProducts: number;
    totalGaps: number;
  };
}

export function parseIncidenceResponse(raw: RawIncidenceResponse): ParsedIncidenceResult {
  const incidences: Incidence[] = (raw.incidences || []).map((item, index) => ({
    id: crypto.randomUUID(),
    category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
    severity: VALID_SEVERITIES.includes(item.severity) ? item.severity : 'medium',
    product: item.product || undefined,
    description: item.description || `Incidencia #${index + 1}`,
    location: item.location || undefined,
    expectedState: item.expectedState || undefined,
    observedState: item.observedState || undefined,
    priceDifference: item.priceDifference || undefined,
  }));

  return {
    incidences,
    incidenceCount: incidences.length,
    severityCritical: incidences.filter(i => i.severity === 'critical').length,
    severityHigh: incidences.filter(i => i.severity === 'high').length,
    severityMedium: incidences.filter(i => i.severity === 'medium').length,
    severityLow: incidences.filter(i => i.severity === 'low').length,
    summary: raw.summary || '',
    photoQuality: raw.photoQuality || 'acceptable',
    coverage: raw.coverage || 'partial',
    shelfOverview: raw.shelfOverview,
  };
}
