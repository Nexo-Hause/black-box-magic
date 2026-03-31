/**
 * Planogram Incidence Detection — Types
 *
 * Incidences are problems detected when comparing a field photo against a planogram.
 * Each incidence is an actionable finding for the promoter coordinator.
 */

export type IncidenceSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IncidenceCategory =
  | 'missing_product'
  | 'wrong_position'
  | 'wrong_price'
  | 'empty_shelf'
  | 'unauthorized_product'
  | 'damaged_product'
  | 'wrong_facing'
  | 'other';

export interface Incidence {
  id: string;
  category: IncidenceCategory;
  severity: IncidenceSeverity;
  product?: string;
  description: string;
  location?: string;
  expectedState?: string;
  observedState?: string;
  priceDifference?: number;
}

// Supabase row shape
export interface PlanogramRecord {
  id: string;
  client_key: string;
  name: string;
  storage_path: string;
  mime_type: string;
  reference_items: import('@/types/comparison').ReferenceItem[];
  reference_type: string;
  section: string | null;
  active: boolean;
  created_at: string;
}

export interface IncidenceRecord {
  id: string;
  planogram_id: string;
  ubiqo_capture_id: string | null;
  promoter_name: string | null;
  store_name: string | null;
  photo_captured_at: string | null;
  field_photo_paths: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  incidences: Incidence[];
  incidence_count: number;
  severity_critical: number;
  severity_high: number;
  severity_medium: number;
  severity_low: number;
  summary: string | null;
  photo_quality: string | null;
  coverage: string | null;
  processing_time_ms: number | null;
  model: string | null;
  tokens_total: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface PlanogramAssignment {
  id: string;
  planogram_id: string;
  form_id: string;
  created_at: string;
}

// Dashboard filters
export interface IncidenceFilters {
  dateFrom?: string;
  dateTo?: string;
  promoter?: string;
  store?: string;
  minSeverity?: IncidenceSeverity;
  status?: string;
  limit?: number;
  offset?: number;
}

// Raw LLM response for incidence detection
export interface RawIncidenceResponse {
  summary: string;
  photoQuality: 'good' | 'acceptable' | 'poor';
  coverage: 'full' | 'partial';
  incidences: Array<{
    category: IncidenceCategory;
    severity: IncidenceSeverity;
    product?: string;
    description: string;
    location?: string;
    expectedState?: string;
    observedState?: string;
    priceDifference?: number;
  }>;
  shelfOverview?: {
    totalExpectedProducts: number;
    totalDetectedProducts: number;
    totalGaps: number;
  };
}
