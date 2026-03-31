-- Migration: Create bbm_planograms table
-- Purpose: Store planogram references for comparison

CREATE TABLE IF NOT EXISTS bbm_planograms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key TEXT NOT NULL,           -- 'fotl_caballeros', 'fotl_damas'
  name TEXT NOT NULL,                 -- Human-readable name
  storage_path TEXT NOT NULL,         -- Path in Supabase Storage bucket
  storage_bucket TEXT NOT NULL DEFAULT 'planograms',
  mime_type TEXT NOT NULL,
  reference_items JSONB NOT NULL DEFAULT '[]',  -- Optional structured items
  reference_type TEXT NOT NULL DEFAULT 'planogram',
  section TEXT,                       -- 'caballeros', 'damas'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active planogram per client_key
CREATE UNIQUE INDEX idx_planograms_active_client ON bbm_planograms (client_key) WHERE active = true;

CREATE INDEX idx_planograms_client_key ON bbm_planograms (client_key);

COMMENT ON TABLE bbm_planograms IS 'Planogram reference images for shelf comparison';
