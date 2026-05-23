-- Migration: 012_add_history_query_indexes.sql
-- Optimiza las consultas históricas de calibración y reanudación rápida por correo

CREATE INDEX IF NOT EXISTS idx_bbm_client_configs_history_lookup 
ON bbm_client_configs (client_id, created_by, version DESC);

CREATE INDEX IF NOT EXISTS idx_bbm_client_configs_created_by_updated 
ON bbm_client_configs (created_by, updated_at DESC) 
WHERE status = 'draft';
