-- Migration: Create bbm_planogram_assignments table
-- Purpose: Map planograms to Evidence form IDs

CREATE TABLE IF NOT EXISTS bbm_planogram_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planogram_id UUID NOT NULL REFERENCES bbm_planograms(id),
  form_id TEXT NOT NULL,              -- Evidence form ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_assignments_form ON bbm_planogram_assignments (form_id);
CREATE INDEX idx_assignments_planogram ON bbm_planogram_assignments (planogram_id);

COMMENT ON TABLE bbm_planogram_assignments IS 'Maps Evidence form IDs to planograms for automatic comparison';
