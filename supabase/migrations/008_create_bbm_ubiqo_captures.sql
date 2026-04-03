-- Migration: 008_create_bbm_ubiqo_captures
--
-- Stores Ubiqo Evidence photos queued for BBM analysis (Spec 00 pipeline).
-- Each row = one photo extracted from an Evidence capture.
-- Dedup by (ubiqo_grupo, photo_path) — grupo is the capture UUID, photo_path is stable.
--
-- Ref: spec/00-ubiqo-integration.md — Data Model
-- Ref: docs/ubiqo/api-validation-2026-03-31.md — Phase 0 corrections
-- Policy: Fase 0-1 schema provisional (DROP+recrear OK, no hay datos prod).

CREATE TABLE bbm_ubiqo_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers Ubiqo
  ubiqo_grupo UUID NOT NULL,
  ubiqo_folio TEXT,
  ubiqo_form_id TEXT NOT NULL,

  -- Metadata
  ubiqo_alias TEXT,
  ubiqo_username TEXT,
  ubiqo_estatus TEXT,

  -- Foto
  photo_path TEXT NOT NULL,                -- Relative path (stable for dedup, e.g. "Capsulas/6376-57325-1774042254169.jpg")
  photo_url TEXT,                          -- Full URL (temporary — contains signed params, do NOT log)
  photo_lat DOUBLE PRECISION,             -- Parsed from string at insert time
  photo_lon DOUBLE PRECISION,             -- Parsed from string at insert time
  photo_description TEXT,
  photo_captured_at TIMESTAMPTZ,

  -- URL reconstruction (firma expires ~24h, re-fetch from API if stale)
  url_base TEXT,                          -- CloudFront CDN base URL
  firma TEXT,                             -- CloudFront signed URL query params

  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,

  -- BBM analysis result (null until completed)
  analysis_result JSONB,
  execution_score INTEGER,               -- 0-100, nullable if not evaluable
  photo_type TEXT,
  severity TEXT,
  escalated BOOLEAN DEFAULT FALSE,

  -- BBM metadata
  model TEXT,
  tokens_total INTEGER,
  processing_time_ms INTEGER,

  -- Timestamps
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(ubiqo_grupo, photo_path)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_ubiqo_captures_status ON bbm_ubiqo_captures(status);
CREATE INDEX idx_ubiqo_captures_form ON bbm_ubiqo_captures(ubiqo_form_id);
CREATE INDEX idx_ubiqo_captures_alias ON bbm_ubiqo_captures(ubiqo_alias);
CREATE INDEX idx_ubiqo_captures_date ON bbm_ubiqo_captures(photo_captured_at);
CREATE INDEX idx_ubiqo_captures_score ON bbm_ubiqo_captures(execution_score);

-- ─── Stored procedures ────────────────────────────────────────────────────────

-- Atomic pick: claim one pending capture for processing.
-- Uses FOR UPDATE SKIP LOCKED to avoid contention between concurrent workers.
-- Also recovers orphaned rows stuck in 'processing' for >5 minutes.
CREATE OR REPLACE FUNCTION pick_pending_ubiqo_capture()
RETURNS SETOF bbm_ubiqo_captures
LANGUAGE plpgsql
AS $$
DECLARE
  picked_id UUID;
BEGIN
  SELECT id INTO picked_id
  FROM bbm_ubiqo_captures
  WHERE status = 'pending'
     OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF picked_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE bbm_ubiqo_captures
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = picked_id
  RETURNING *;
END;
$$;

-- Atomic pick for incidences table (same pattern as ubiqo captures).
-- Claims one pending incidence for planogram comparison processing.
CREATE OR REPLACE FUNCTION pick_pending_incidence()
RETURNS SETOF bbm_incidences
LANGUAGE plpgsql
AS $$
DECLARE
  picked_id UUID;
BEGIN
  SELECT id INTO picked_id
  FROM bbm_incidences
  WHERE status = 'pending'
     OR (status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF picked_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE bbm_incidences
  SET status = 'processing'
  WHERE id = picked_id
  RETURNING *;
END;
$$;

-- ─── Rollback ─────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS pick_pending_incidence();
-- DROP FUNCTION IF EXISTS pick_pending_ubiqo_capture();
-- DROP TABLE IF EXISTS bbm_ubiqo_captures;
