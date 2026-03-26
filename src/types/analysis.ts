export interface InventoryItem {
  name: string;
  brand?: string;
  category?: string;
  quantity: string | number;
  location?: string;
}

export interface ShelfBrand {
  name: string;
  estimated_share_pct: number;
  position?: string;
}

export interface PriceEntry {
  item: string;
  price: number;
  currency?: string;
  type?: string;
}

export interface PopMaterials {
  present: boolean;
  properly_installed: boolean;
  condition: string;
}

export interface InferredLocation {
  city_or_region?: string;
  country?: string;
  confidence: string;
  clues?: string[];
}

export interface ConditionDetail {
  severity?: string;
  severity_justification?: string;
  issues?: Array<{
    description: string;
    location?: string;
    severity?: string;
    root_cause?: string;
    immediate_action?: string;
  }>;
  safety_hazards?: Array<{
    hazard: string;
    risk_level?: string;
    mitigation?: string;
  }>;
  remediation_plan?: {
    immediate?: string[];
    short_term?: string[];
    preventive?: string[];
  };
  overall_assessment?: string;
}

export interface AnalysisData {
  photo_type?: string;
  priority_facets?: string[];
  summary: string;
  severity?: string;
  inventory?: {
    items: InventoryItem[];
    total_skus_detected: number;
  };
  shelf_share?: {
    brands: ShelfBrand[];
    dominant_brand: string;
    notes?: string;
  };
  pricing?: {
    prices_found: PriceEntry[];
    strategies_detected: string[];
  };
  compliance?: {
    score: string;
    pop_materials?: PopMaterials;
    product_facing: string;
    signage: string;
    issues: string[];
  };
  condition?: {
    cleanliness: string;
    displays: string;
    lighting: string;
    products: string;
    safety_issues: string[];
    notes?: string;
  };
  context?: {
    establishment_type: string;
    inferred_location?: InferredLocation;
    setting: string;
    time_of_day?: string;
    foot_traffic: string;
  };
  insights?: {
    strengths: string[];
    opportunities: string[];
    threats: string[];
    recommendations: string[];
  };
  execution_score?: number;
  additional_observations?: string;
  metadata?: {
    analysis_version: string;
    model: string;
    confidence?: string;
    processing_time_ms: number;
  };
}

export interface AnalysisResponse {
  success: boolean;
  client?: string;
  analysis: AnalysisData;
  condition_detail?: ConditionDetail;
  meta: {
    model: string;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    processing_time_ms: number;
    engine?: string;
    escalated?: boolean;
    truncated?: boolean;
  };
  log_id?: string;
}
