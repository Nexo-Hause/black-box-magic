-- Migration: 001_create_bbm_client_configs
--
-- Creates the bbm_client_configs table for Engine v3.
-- Stores per-client analysis configurations generated via conversational onboarding.
-- Each client can have multiple configs in different lifecycle states
-- (draft → testing → active → archived). Only one config per client may be
-- active at a time, enforced by the partial unique index idx_one_active_per_client.
-- The version column auto-increments on each deploy; historical analysis rows
-- (bbm_analysis_log, bbm_ubiqo_captures) reference config_id + config_version
-- so trend comparisons stay within the same config version.
--
-- Ref: spec/01-engine-v3.md — Data Model + Auditoría C11
-- Policy: additive migrations only — do not drop columns or tables without explicit confirmation.

CREATE TABLE bbm_client_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client identity
  client_id TEXT NOT NULL,          -- No UNIQUE constraint; multiple configs per client allowed (C11)
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,           -- 'qsr' | 'retail_btl' | 'construccion' | 'farmaceutica' | 'servicios' | 'operaciones'

  -- Structured analysis config (ClientConfig JSON, validated by Zod on app layer)
  config JSONB,                     -- NULL while draft/onboarding in progress; set on synthesize

  -- Onboarding working state (updated incrementally during the chat session)
  transcript JSONB,                 -- Array of ChatMessage objects accumulated during onboarding chat
  partial_config JSONB,             -- PartialOnboardingConfig — incremental tool-call results

  -- Onboarding completion metadata (written when onboarding is finalised)
  onboarding_transcript TEXT,       -- Plain-text transcript of the completed onboarding conversation
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_iterations INTEGER DEFAULT 0,

  -- Lifecycle state machine: draft → testing → active → archived
  status TEXT NOT NULL DEFAULT 'draft',

  -- Versioning (C11): incremented on each deploy; 1-based
  version INTEGER NOT NULL DEFAULT 1,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT                   -- Email of the user who ran the onboarding
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

-- Partial unique index: at most one active config per client (C11)
-- Application layer must archive the previous active config before activating a new one.
CREATE UNIQUE INDEX idx_one_active_per_client
  ON bbm_client_configs(client_id) WHERE status = 'active';

-- General-purpose filters
CREATE INDEX idx_client_configs_status
  ON bbm_client_configs(status);

CREATE INDEX idx_client_configs_industry
  ON bbm_client_configs(industry);

-- Composite index for the most common query pattern: fetch active config by client
-- (used by getActiveConfig in src/lib/engine/config.ts)
CREATE INDEX idx_client_configs_client_status
  ON bbm_client_configs(client_id, status) WHERE status = 'active';


-- ─── Rollback ──────────────────────────────────────────────────────────────────
-- To undo this migration, run the following (uncomment before executing):
--
-- DROP TABLE IF EXISTS bbm_client_configs;
