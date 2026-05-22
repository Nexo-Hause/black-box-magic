-- Migration: 011_make_planogram_id_nullable.sql
-- Purpose: 
--  1. Remove NOT NULL constraint on bbm_incidences.planogram_id to support Modo A (Direct Audit - No Contrast).
--  2. Replace the placeholder RLS policy with strict user JWT tenant isolation.
-- Scope: Additive schema change, compatible backwards.

-- 1. Make planogram_id nullable
ALTER TABLE bbm_incidences ALTER COLUMN planogram_id DROP NOT NULL;
COMMENT ON COLUMN bbm_incidences.planogram_id IS 'Associated planogram ID (nullable for Modo A / Direct Audits)';

-- 2. Refactor RLS Policy to enforce strict multi-tenant isolation
DROP POLICY IF EXISTS bbm_incidences_tenant_isolation ON bbm_incidences;
CREATE POLICY bbm_incidences_tenant_isolation ON bbm_incidences
  FOR ALL
  USING (
    client_id = (
      SELECT client_id 
      FROM bbm_users 
      WHERE email = LOWER(auth.jwt() ->> 'email')
    )
  );

COMMENT ON POLICY bbm_incidences_tenant_isolation ON bbm_incidences IS 'Enforces strict tenant isolation by matching user jwt email client_id';

