-- Migration: Create bbm_share_tokens table
-- Purpose: Almacenar share tokens para links compartibles del demo (48h TTL, máx 10 usos)

CREATE TABLE IF NOT EXISTS bbm_share_tokens (
  token UUID PRIMARY KEY,
  email TEXT NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_tokens_email ON bbm_share_tokens (email);
CREATE INDEX idx_share_tokens_expires ON bbm_share_tokens (expires_at);

COMMENT ON TABLE bbm_share_tokens IS 'Tokens de corta duración para links compartibles del demo (48h TTL, máximo 10 usos por token)';
