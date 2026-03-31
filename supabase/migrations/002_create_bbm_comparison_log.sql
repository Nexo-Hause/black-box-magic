-- Migration: Create bbm_comparison_log table
-- Purpose: Log all reference comparison analyses for diagnostics and billing

CREATE TABLE IF NOT EXISTS bbm_comparison_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_email TEXT,                    -- email from gate cookie or share token
  share_token TEXT,                   -- if accessed via share link

  -- What was compared
  reference_type TEXT NOT NULL,       -- 'planogram', 'brand_manual', 'checklist', 'blueprint'
  reference_section TEXT,             -- e.g., 'caballeros', 'produce'
  reference_items_count INT,          -- how many items in reference
  field_image_filename TEXT,
  field_image_size_bytes INT,

  -- Results
  compliance_score NUMERIC(5,2),      -- 0-100
  metrics JSONB,                      -- ComparisonMetrics object
  matches_count INT,
  missing_count INT,
  unexpected_count INT,
  price_discrepancies_count INT,
  photo_quality TEXT,                 -- 'good', 'acceptable', 'poor'
  coverage TEXT,                      -- 'full', 'partial'

  -- Processing
  model TEXT NOT NULL,
  tokens_input INT,
  tokens_output INT,
  tokens_total INT,
  processing_time_ms INT NOT NULL,

  -- Full result (for debugging)
  result_json JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX idx_comparison_log_user_email ON bbm_comparison_log (user_email);

-- Index for querying by date
CREATE INDEX idx_comparison_log_created_at ON bbm_comparison_log (created_at);

-- Index for querying by reference type
CREATE INDEX idx_comparison_log_ref_type ON bbm_comparison_log (reference_type);

COMMENT ON TABLE bbm_comparison_log IS 'Logs every reference comparison analysis for diagnostics, billing, and quality monitoring';
