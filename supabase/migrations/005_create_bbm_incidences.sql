-- Migration: Create bbm_incidences table
-- Purpose: Store comparison results with detected incidences

CREATE TABLE IF NOT EXISTS bbm_incidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planogram_id UUID NOT NULL REFERENCES bbm_planograms(id),
  ubiqo_capture_id TEXT,              -- Evidence folio (nullable for manual uploads)
  promoter_name TEXT,
  store_name TEXT,
  photo_captured_at TIMESTAMPTZ,
  field_photo_paths TEXT[] NOT NULL DEFAULT '{}',  -- Storage paths (NOT signed URLs)
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  incidences JSONB NOT NULL DEFAULT '[]',  -- Array of Incidence objects
  incidence_count INTEGER NOT NULL DEFAULT 0,
  severity_critical INTEGER NOT NULL DEFAULT 0,
  severity_high INTEGER NOT NULL DEFAULT 0,
  severity_medium INTEGER NOT NULL DEFAULT 0,
  severity_low INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  photo_quality TEXT,                 -- good | acceptable | poor
  coverage TEXT,                      -- full | partial
  processing_time_ms INTEGER,
  model TEXT,
  tokens_total INTEGER,
  raw_response JSONB,                 -- Full Gemini response for debugging
  error_message TEXT,                 -- Error details if status = 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_incidences_status ON bbm_incidences (status);
CREATE INDEX idx_incidences_planogram ON bbm_incidences (planogram_id);
CREATE INDEX idx_incidences_promoter ON bbm_incidences (promoter_name);
CREATE INDEX idx_incidences_store ON bbm_incidences (store_name);
CREATE INDEX idx_incidences_captured_at ON bbm_incidences (photo_captured_at);
-- Prevent reprocessing same Evidence capture
CREATE UNIQUE INDEX idx_incidences_ubiqo_unique ON bbm_incidences (ubiqo_capture_id) WHERE ubiqo_capture_id IS NOT NULL;

COMMENT ON TABLE bbm_incidences IS 'Planogram comparison results with detected incidences per photo/capture';
