/**
 * Reference Comparison — Types
 *
 * Comparison between a reference document (planogram, brand manual, etc.)
 * and a field photo. Separate from EngineV3Result which evaluates single images.
 */

// What kind of reference is being compared
export type ReferenceType = 'planogram' | 'brand_manual' | 'checklist' | 'blueprint';

// Structured data extracted from a reference document
export interface ReferenceData {
  type: ReferenceType;
  section?: string; // e.g., "caballeros", "produce", "facade"
  items: ReferenceItem[];
  metadata?: Record<string, unknown>;
}

export interface ReferenceItem {
  id: string;
  name: string;
  category?: string;
  expectedPosition?: string; // e.g., "shelf 2, position 3"
  expectedPrice?: number;
  expectedQuantity?: number;
  attributes?: Record<string, string>; // e.g., { size: "M", color: "negro" }
}

// What the comparison found
export interface ComparisonResult {
  // Overall compliance
  complianceScore: number; // 0-100

  // Breakdown metrics
  metrics: ComparisonMetrics;

  // Item-level details
  matches: MatchedItem[];
  missing: MissingItem[];
  unexpected: UnexpectedItem[];
  priceDiscrepancies: PriceDiscrepancy[];
  gapDetails: GapDetail[];

  // Summary
  summary: string;

  // Metadata
  referenceType: ReferenceType;
  referenceSection?: string;
  coverage: 'full' | 'partial';
  photoQuality: 'good' | 'acceptable' | 'poor';

  processingTimeMs: number;
  model: string;
  tokens: { input: number; output: number; total: number };
}

export interface ComparisonMetrics {
  assortment: number;      // % of reference items found in photo
  positioning: number;     // % of found items in correct position
  pricing: number;         // % of visible prices matching reference
  gaps: number;            // count of empty positions that should have product
  totalExpected: number;   // total items in reference
  totalFound: number;      // total items detected in photo
  totalCorrectPosition: number;
  totalPriceMatch: number;
  totalPriceVisible: number;
}

export interface GapDetail {
  location: string;
  expectedProduct?: string;
}

export interface MatchedItem {
  referenceItemId: string;
  name: string;
  category?: string;
  correctPosition: boolean;
  observedPosition?: string;
  observedPrice?: number;
  observation?: string;
}

export interface MissingItem {
  referenceItemId: string;
  name: string;
  expectedPosition?: string;
  reason?: string; // "not visible", "out of frame", "empty shelf"
}

export interface UnexpectedItem {
  name: string;
  observedPosition?: string;
  observedPrice?: number;
  observation?: string;
}

export interface PriceDiscrepancy {
  referenceItemId: string;
  name: string;
  expectedPrice: number;
  observedPrice: number;
  difference: number;
}

// Raw LLM response before server-side processing
export interface RawComparisonResponse {
  summary: string;
  photoQuality: 'good' | 'acceptable' | 'poor';
  coverage: 'full' | 'partial';
  items: Array<{
    referenceItemId?: string;
    name: string;
    category?: string;
    found: boolean;
    correctPosition: boolean;
    observedPosition?: string;
    observedPrice?: number;
  }>;
  unexpectedItems?: Array<{
    name: string;
    observedPosition?: string;
    observedPrice?: number;
  }>;
  gaps: Array<{
    location: string;
    expectedProduct?: string;
  }>;
}
