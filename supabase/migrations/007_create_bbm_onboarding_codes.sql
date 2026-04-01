-- Migration: 007_create_bbm_onboarding_codes
--
-- Stores onboarding codes (7-day TTL).
-- Admin generates a code, sends URL to client, client exchanges code for JWT.
-- Codes are single-use and deleted on exchange.

CREATE TABLE bbm_onboarding_codes (
  code UUID PRIMARY KEY,
  payload JSONB NOT NULL,         -- { clientId, clientName, email }
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup: index for efficient expiry queries
CREATE INDEX idx_onboarding_codes_expires ON bbm_onboarding_codes(expires_at);

-- Rollback:
-- DROP TABLE IF EXISTS bbm_onboarding_codes;
