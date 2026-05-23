-- ============================================================================
-- 009_create_bbm_tenancy.sql
-- Fundación multi-tenant: tablas canónicas + columnas de tenencia + RLS
-- Diseño: docs/tenancy-model.md | Spec: spec/04-ws-mt-multitenant.md
-- ============================================================================

-- ── Tabla de cuentas (nivel superior de la jerarquía) ───────────────────────
CREATE TABLE IF NOT EXISTS bbm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('reseller', 'direct')),
  name TEXT NOT NULL,
  evidence_api_token TEXT,  -- Cifrado con patrón AES-256-GCM de src/lib/ubiqo/crypto.ts. Nullable (cuentas direct sin Evidence).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla de clientes finales (cuelgan de una cuenta) ───────────────────────
CREATE TABLE IF NOT EXISTS bbm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bbm_accounts(id),
  client_key TEXT UNIQUE NOT NULL,  -- slug canónico del cliente (ej. 'fotl'). NO matchea bbm_planograms.client_key legacy 1:1.
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bbm_clients_account_id ON bbm_clients(account_id);

-- ── Tabla de usuarios (reemplaza DASHBOARD_ALLOWED_EMAILS) ──────────────────
CREATE TABLE IF NOT EXISTS bbm_users (
  email TEXT PRIMARY KEY,  -- normalizado lowercase
  role TEXT NOT NULL CHECK (role IN ('bbm_admin', 'reseller_admin', 'client_user')),
  account_id UUID REFERENCES bbm_accounts(id),  -- NULL solo para bbm_admin (ve todo)
  client_id UUID REFERENCES bbm_clients(id),    -- set solo para client_user
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si la tabla ya existía (ej. legacy demo bbm_users), nos aseguramos de agregar las columnas necesarias
ALTER TABLE bbm_users 
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client_user' CHECK (role IN ('bbm_admin', 'reseller_admin', 'client_user')),
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES bbm_accounts(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES bbm_clients(id);

CREATE INDEX IF NOT EXISTS idx_bbm_users_account_id ON bbm_users(account_id);

-- ── Columnas de tenencia en tablas de datos existentes ──────────────────────

-- bbm_incidences: agregar account_id y client_id
ALTER TABLE bbm_incidences
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES bbm_accounts(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES bbm_clients(id);

CREATE INDEX IF NOT EXISTS idx_bbm_incidences_client_id ON bbm_incidences(client_id);

-- bbm_ubiqo_captures: agregar account_id y client_id
ALTER TABLE bbm_ubiqo_captures
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES bbm_accounts(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES bbm_clients(id);

CREATE INDEX IF NOT EXISTS idx_bbm_ubiqo_captures_client_id ON bbm_ubiqo_captures(client_id);

-- bbm_planograms: agregar client_id (corrección de aislamiento — sin esto,
-- list/route.ts no puede filtrar planogramas por tenant → leak).
-- client_key se conserva como columna legacy/display; deja de ser clave de tenencia.
ALTER TABLE bbm_planograms
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES bbm_clients(id);

CREATE INDEX IF NOT EXISTS idx_bbm_planograms_client_id ON bbm_planograms(client_id);

-- ── RLS — defensa en profundidad ────────────────────────────────────────────
-- NOTA: RLS NO es la barrera primaria. service-role la bypasea (ver .claude/rules/supabase.md).
-- El enforcement primario es el helper app-layer src/lib/tenant/scope.ts.
-- Estas policies son una red de seguridad adicional.

ALTER TABLE bbm_incidences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbm_incidences_tenant_isolation ON bbm_incidences;
CREATE POLICY bbm_incidences_tenant_isolation ON bbm_incidences
  FOR ALL
  USING (
    -- service-role bypasea esto; esta policy protege contra queries con anon/authenticated key
    client_id IS NOT NULL
  );

ALTER TABLE bbm_ubiqo_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbm_ubiqo_captures_tenant_isolation ON bbm_ubiqo_captures;
CREATE POLICY bbm_ubiqo_captures_tenant_isolation ON bbm_ubiqo_captures
  FOR ALL
  USING (
    client_id IS NOT NULL
  );

-- ============================================================================
-- SEED + BACKFILL MVP
-- ============================================================================
-- INSTRUCCIONES PARA EL OPERADOR:
-- 1. Reemplazar TODOS los placeholders (<...>) con valores reales antes de aplicar.
-- 2. Aplicar 009 + ESTE BLOQUE EN UNA SOLA TRANSACCIÓN: si la migración
--    entra sin seed, todo usuario pierde acceso al instante (bbm_users vacío → 403).
-- 3. bbm_clients.client_key = slug canónico nuevo (ej. 'fotl'), NO uno de los
--    bbm_planograms.client_key legacy ('fotl_caballeros', 'fotl_damas').
-- 4. Emails reales confirmados por el operador; si no se conocen, NO aplicar.
--
-- BEGIN;
--
-- -- Cuenta Ubiqo (reseller)
-- INSERT INTO bbm_accounts (id, type, name)
--   VALUES ('<acc-uuid>', 'reseller', 'Ubiqo');
--
-- -- Cliente FOTL bajo Ubiqo
-- INSERT INTO bbm_clients (id, account_id, client_key, name)
--   VALUES ('<cli-uuid>', '<acc-uuid>', 'fotl', 'Fruit of the Loom');
--
-- -- Usuarios MVP (emails reales del operador)
-- INSERT INTO bbm_users (email, role, account_id, client_id) VALUES
--   ('<gonzalo-email>', 'bbm_admin', NULL, NULL),
--   ('<enrique-email>', 'reseller_admin', '<acc-uuid>', NULL),
--   ('<carlos-email>', 'client_user', '<acc-uuid>', '<cli-uuid>');
--
-- -- BACKFILL: mapear client_key legacy de bbm_planograms al client_id de FOTL.
-- -- Los valores legacy se leen del dato real:
-- --   SELECT DISTINCT client_key FROM bbm_planograms;
-- -- NO se inventan. Ajustar la lista IN (...) con los valores reales.
-- UPDATE bbm_planograms SET client_id = '<cli-uuid>'
--   WHERE client_key IN ('<lista-real-de-client_key-de-FOTL>');
--
-- -- bbm_incidences / bbm_ubiqo_captures: 008 es provisional sin datos prod →
-- -- normalmente sin filas que backfillear. Si las hay, derivar client_id por
-- -- la cadena planogram_id → bbm_planograms.client_id (incidences) o
-- -- form_id → assignment → planogram (captures). Confirmar conteo antes:
-- --   SELECT COUNT(*) FROM bbm_incidences;
-- --   SELECT COUNT(*) FROM bbm_ubiqo_captures;
--
-- COMMIT;
-- ============================================================================
