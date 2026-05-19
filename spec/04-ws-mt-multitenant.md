# Spec 04 — WS-MT: Fundación multi-tenant

## Objetivo

Introducir las entidades canónicas de tenencia (`bbm_accounts`, `bbm_clients`,
`bbm_users`), estampar `account_id`/`client_id` en los datos, resolver rol+scope en
el verify de la sesión, y centralizar TODA lectura del dashboard en un helper de
scoping con tests de aislamiento.

## Contexto

El diseño está cerrado en `docs/tenancy-model.md` (leerlo primero — es la fuente de
verdad de la jerarquía, roles y qué es schema-ready vs implementado). Modelo B2B2B:
cuenta `reseller` Ubiqo → cliente FOTL; 3 roles (`bbm_admin`, `reseller_admin`,
`client_user`). Hoy NO hay nivel cuenta ni usuarios en DB: el auth usa
`DASHBOARD_ALLOWED_EMAILS` plano y `bbm_incidences`/`bbm_ubiqo_captures` no tienen
columnas de tenencia. La migración 008 es provisional (sin datos prod, DROP+recrear
OK) → ventana barata para hacerlo bien ahora, antes de tener datos.

## Alcance

**Incluye:**
- Migración SQL aditiva: 3 tablas canónicas + columnas de tenencia + seeds MVP +
  RLS defensa-en-profundidad.
- Helper centralizado `src/lib/tenant/scope.ts` (resolución de scope + filtrado).
- Extensión del verify de sesión para resolver rol+scope desde `bbm_users`.
- Reemplazo de `DASHBOARD_ALLOWED_EMAILS` por lookup en `bbm_users`.
- Estampado de `account_id`/`client_id` en el ingest (vía pipeline, spec 03).
- Suite de tests de aislamiento (criterio de cierre).

**No incluye:**
- No aplicar la migración a prod (es paso de operador; la spec crea el archivo).
- No reescribir `src/lib/cookie.ts` (HMAC timing-safe) — se **extiende**.
- No tocar `src/lib/onboarding/auth.ts` (JWT jose, auth separada de onboarding).
- No implementar onboarding de cuentas, billing, ni rotación de token por cuenta
  (schema-ready, lógica diferida — ver tenancy-model §6).
- **No scopear `bbm_client_configs`** — lo consume el flujo de onboarding (auth
  JWT separada, `src/lib/onboarding/auth.ts`, que NO se toca). Fuera de scope de
  WS-MT por diseño (tenancy-model §4); se aborda si onboarding se expone
  multi-tenant a futuro. No es olvido.
- No retirar las RPC `pick_pending_*` (se retiran en cierre de WS1; ver
  tenancy-model §8 — no son tenant-scoped y es aceptable hasta entonces).
- No construir el dashboard (WS2, spec 02-ws2).

## Archivos afectados

| Archivo | Acción |
|---|---|
| `supabase/migrations/009_create_bbm_tenancy.sql` | Crear |
| `src/lib/tenant/scope.ts` | Crear |
| `src/lib/tenant/types.ts` | Crear |
| `src/lib/tenant/__tests__/scope.test.ts` | Crear |
| `src/lib/auth/session.ts` | Crear (resolución de rol+scope) |
| `src/lib/auth/__tests__/session.test.ts` | Crear |
| `src/app/api/planogram/upload/route.ts` | Modificar (`:10` allowlist → session) |
| `src/app/api/planogram/list/route.ts` | Modificar (`:10`) |
| `src/app/api/planogram/status/route.ts` | Modificar (`:10`) |
| `src/app/api/demo/share/route.ts` | Modificar (`:6`) |
| `src/lib/pipeline/ubiqo.ts` | Modificar (estampar tenencia en upsert) |
| `src/lib/pipeline/planogram.ts` | Modificar (estampar tenencia en upsert) |
| `.env.example` | Modificar (marcar `DASHBOARD_ALLOWED_EMAILS` deprecado) |

## Tareas

### Tarea 1: Migración SQL canónica

**Archivo:** Crear `supabase/migrations/009_create_bbm_tenancy.sql`.

**Steps:**

- [ ] **Step 1:** Escribir la migración con este contenido (esquema exacto en
  `docs/tenancy-model.md §4`):

  - `CREATE TABLE bbm_accounts (id UUID PK DEFAULT gen_random_uuid(), type TEXT NOT
    NULL CHECK (type IN ('reseller','direct')), name TEXT NOT NULL,
    evidence_api_token TEXT, created_at TIMESTAMPTZ DEFAULT now())`.
  - `CREATE TABLE bbm_clients (id UUID PK DEFAULT gen_random_uuid(), account_id UUID
    NOT NULL REFERENCES bbm_accounts(id), client_key TEXT UNIQUE NOT NULL, name TEXT
    NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`.
  - `CREATE TABLE bbm_users (email TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role
    IN ('bbm_admin','reseller_admin','client_user')), account_id UUID REFERENCES
    bbm_accounts(id), client_id UUID REFERENCES bbm_clients(id), created_at
    TIMESTAMPTZ DEFAULT now())`.
  - `ALTER TABLE bbm_incidences ADD COLUMN account_id UUID REFERENCES
    bbm_accounts(id), ADD COLUMN client_id UUID REFERENCES bbm_clients(id);`
  - `ALTER TABLE bbm_ubiqo_captures ADD COLUMN account_id UUID REFERENCES
    bbm_accounts(id), ADD COLUMN client_id UUID REFERENCES bbm_clients(id);`
  - **`ALTER TABLE bbm_planograms ADD COLUMN client_id UUID REFERENCES
    bbm_clients(id);`** — corrección de aislamiento (sin esto el helper no puede
    filtrar planogramas → leak en `list/route.ts`). `client_key` se conserva como
    columna legacy/display; deja de ser la clave de tenencia.
  - Índices: `bbm_clients(account_id)`, `bbm_incidences(client_id)`,
    `bbm_ubiqo_captures(client_id)`, `bbm_planograms(client_id)`,
    `bbm_users(account_id)`.

- [ ] **Step 2: Seeds (parametrizados, NO inventar emails/keys).** La migración
  incluye un bloque de seed comentado con placeholders explícitos:

  ```sql
  -- SEED + BACKFILL MVP — reemplazar placeholders con valores reales antes de
  -- aplicar. APLICAR 009 + ESTE BLOQUE EN UNA SOLA TRANSACCIÓN: si la migración
  -- entra sin seed, todo usuario pierde acceso al instante (bbm_users vacío → 403).
  -- bbm_clients.client_key = slug canónico nuevo (ej. 'fotl'), NO uno de los
  -- bbm_planograms.client_key legacy. Emails reales confirmados por el operador;
  -- si no se conocen, BLOCKED (no inventar).
  -- BEGIN;
  -- INSERT INTO bbm_accounts (id, type, name) VALUES ('<acc-uuid>','reseller','Ubiqo');
  -- INSERT INTO bbm_clients (id, account_id, client_key, name)
  --   VALUES ('<cli-uuid>','<acc-uuid>','fotl','Fruit of the Loom');
  -- INSERT INTO bbm_users (email, role, account_id, client_id) VALUES
  --   ('<gonzalo>','bbm_admin',NULL,NULL),
  --   ('<enrique>','reseller_admin','<acc-uuid>',NULL),
  --   ('<carlos>','client_user','<acc-uuid>','<cli-uuid>');
  -- -- BACKFILL: mapear client_key legacy de bbm_planograms al client_id de FOTL.
  -- -- Los valores legacy ('fotl_caballeros','fotl_damas'...) se leen del dato
  -- -- real (SELECT DISTINCT client_key FROM bbm_planograms), NO se inventan.
  -- UPDATE bbm_planograms SET client_id='<cli-uuid>'
  --   WHERE client_key IN (<lista real de client_key de FOTL>);
  -- -- bbm_incidences / bbm_ubiqo_captures: 008 es provisional sin datos prod →
  -- -- normalmente sin filas que backfillear. Si las hay, derivar client_id por
  -- -- la cadena planogram_id→bbm_planograms.client_id (incidences) o
  -- -- form_id→assignment→planogram (captures). Confirmar conteo antes (SELECT
  -- -- COUNT(*)), no asumir vacío.
  -- COMMIT;
  ```
  El ejecutor **deja el bloque comentado**. Activarlo con valores reales = paso de
  operador. Si los emails/slug/lista de client_key reales no están disponibles,
  reportar `BLOCKED`, **no inventar**.

- [ ] **Step 3: RLS defensa en profundidad.** Habilitar RLS en `bbm_incidences` y
  `bbm_ubiqo_captures` con policy por `client_id`. Comentario en el SQL:
  `-- RLS NO es la barrera primaria: service-role la bypasea. El enforcement
  primario es el helper app-layer src/lib/tenant/scope.ts.`

- [ ] **Step 4: Verificación de sintaxis.** No aplicar a DB. Validar que el SQL
  parsea (lint SQL si el repo tiene; si no, revisión manual del archivo). Commit:
  ```bash
  git add supabase/migrations/009_create_bbm_tenancy.sql
  git commit -m "feat(tenancy): migración canónica bbm_accounts/clients/users"
  ```

### Tarea 2: Resolución de sesión (rol + scope) (TDD)

**Archivos:** Crear `src/lib/auth/session.ts`, `src/lib/auth/__tests__/session.test.ts`,
`src/lib/tenant/types.ts`.

- [ ] **Step 1: Tipos.** En `src/lib/tenant/types.ts`:

  ```typescript
  export type TenantRole = 'bbm_admin' | 'reseller_admin' | 'client_user';

  export interface TenantSession {
    email: string;
    role: TenantRole;
    accountId: string | null;   // null sólo para bbm_admin
    clientId: string | null;    // set sólo para client_user
  }
  ```

- [ ] **Step 2: Test que falle.** En `src/lib/auth/__tests__/session.test.ts`:

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { resolveSession } from '@/lib/auth/session';

  function supaWith(userRow: any) {
    return { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: userRow, error: null })) })) })) })) } as any;
  }

  describe('resolveSession', () => {
    it('email sin fila en bbm_users → null (403 upstream)', async () => {
      const s = await resolveSession('ghost@x.com', supaWith(null));
      expect(s).toBeNull();
    });
    it('client_user → scope a su client_id', async () => {
      const s = await resolveSession('carlos@fotl.com', supaWith({ email: 'carlos@fotl.com', role: 'client_user', account_id: 'a1', client_id: 'c1' }));
      expect(s).toEqual({ email: 'carlos@fotl.com', role: 'client_user', accountId: 'a1', clientId: 'c1' });
    });
    it('bbm_admin → sin scope (ve todo)', async () => {
      const s = await resolveSession('gonzalo@x.com', supaWith({ email: 'gonzalo@x.com', role: 'bbm_admin', account_id: null, client_id: null }));
      expect(s).toEqual({ email: 'gonzalo@x.com', role: 'bbm_admin', accountId: null, clientId: null });
    });
  });
  ```

- [ ] **Step 3: Verificar FAIL.** `npm test src/lib/auth/__tests__/session.test.ts`
- [ ] **Step 4: Implementar `resolveSession(email, supabase)`** en
  `src/lib/auth/session.ts`: query `bbm_users` por email (lowercased); sin fila →
  `null`; con fila → `TenantSession`. NO toca `cookie.ts`.
- [ ] **Step 5: Verificar PASS.** Reportar `3/3`.
- [ ] **Step 6: tsc + lint.** `npx tsc --noEmit && npm run lint`
- [ ] **Step 7: Commit local.**
  ```bash
  git add src/lib/auth/session.ts src/lib/auth/__tests__/session.test.ts src/lib/tenant/types.ts
  git commit -m "feat(tenancy): resolveSession (rol+scope desde bbm_users)"
  ```

### Tarea 3: Helper de scoping (TDD — superficie de leak, prioridad máxima)

**Archivos:** Crear `src/lib/tenant/scope.ts`, `src/lib/tenant/__tests__/scope.test.ts`.

- [ ] **Step 1: Test de aislamiento que falle.** En
  `src/lib/tenant/__tests__/scope.test.ts`:

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { scopedQuery } from '@/lib/tenant/scope';
  import type { TenantSession } from '@/lib/tenant/types';

  function fakeBuilder() {
    const calls: any[] = [];
    const b: any = {
      eq: vi.fn((c: string, v: any) => { calls.push(['eq', c, v]); return b; }),
      _calls: calls,
    };
    return b;
  }

  const admin: TenantSession = { email: 'a', role: 'bbm_admin', accountId: null, clientId: null };
  const reseller: TenantSession = { email: 'r', role: 'reseller_admin', accountId: 'acc1', clientId: null };
  const client: TenantSession = { email: 'c', role: 'client_user', accountId: 'acc1', clientId: 'cli1' };

  describe('scopedQuery — aislamiento', () => {
    it('client_user fuerza client_id propio (ignora clientId del request)', () => {
      const b = fakeBuilder();
      scopedQuery(b, client, { requestedClientId: 'OTRO' });
      expect(b._calls).toContainEqual(['eq', 'client_id', 'cli1']);
      expect(b._calls).not.toContainEqual(['eq', 'client_id', 'OTRO']);
    });
    it('reseller_admin filtra por account_id; clientId opcional dentro de su cuenta', () => {
      const b = fakeBuilder();
      scopedQuery(b, reseller, { requestedClientId: 'cliX' });
      expect(b._calls).toContainEqual(['eq', 'account_id', 'acc1']);
      expect(b._calls).toContainEqual(['eq', 'client_id', 'cliX']);
    });
    it('reseller_admin: account_id del token SIEMPRE presente aunque pida clientId de otra cuenta', () => {
      const b = fakeBuilder();
      scopedQuery(b, reseller, { requestedClientId: 'cli-de-OTRA-cuenta' });
      // el account_id del token gana siempre: account_id=acc1 + client_id ajeno
      // → la query devuelve 0 filas (no leak). Un refactor que quite este eq es bug.
      expect(b._calls).toContainEqual(['eq', 'account_id', 'acc1']);
    });
    it('bbm_admin sin filtro de tenencia', () => {
      const b = fakeBuilder();
      scopedQuery(b, admin, {});
      expect(b._calls).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Verificar FAIL.**
- [ ] **Step 3: Implementar `scopedQuery(builder, session, opts)`** en
  `src/lib/tenant/scope.ts`. Reglas exactas:
  - `client_user`: `builder.eq('client_id', session.clientId)` SIEMPRE. Ignora
    `opts.requestedClientId`.
  - `reseller_admin`: `builder.eq('account_id', session.accountId)`; si
    `opts.requestedClientId` está set, además `builder.eq('client_id',
    opts.requestedClientId)` (selector dentro de su cuenta).
  - `bbm_admin`: sin filtros (si `opts.requestedAccountId`/`requestedClientId`,
    aplicarlos como filtros opcionales, no como restricción de seguridad).
  - Devuelve el builder (encadenable).
- [ ] **Step 4: Verificar PASS.** Reportar `3/3`.
- [ ] **Step 5: tsc + lint.**
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/lib/tenant/scope.ts src/lib/tenant/__tests__/scope.test.ts
  git commit -m "feat(tenancy): helper scopedQuery + tests de aislamiento"
  ```

### Tarea 4: Reemplazar `DASHBOARD_ALLOWED_EMAILS` por sesión

> Superficie de riesgo (auth). Cambio mecánico pero **revisión Opus obligatoria**
> en `/accept` antes de aceptar.

- [ ] **Step 1:** En cada uno de
  `src/app/api/planogram/upload/route.ts` (`:10`),
  `src/app/api/planogram/list/route.ts` (`:10`),
  `src/app/api/planogram/status/route.ts` (`:10`),
  `src/app/api/demo/share/route.ts` (`:6`):
  - Después de `verifyCookie()` (que se mantiene igual), reemplazar el bloque
    `DASHBOARD_ALLOWED_EMAILS`/`isAllowedEmail()` por:
    `const session = await resolveSession(cookie.email, supabase); if (!session)
    return 403;`
  - Pasar `session` a las queries de datos vía `scopedQuery` (filtra por
    `client_id`). En `list/route.ts` la query de `bbm_planograms` (hoy
    `select('*').eq('active',true)` SIN filtro de tenant — el leak) DEBE pasar por
    `scopedQuery(builder, session, {})` antes de ejecutarse. `status/route.ts`
    igual para `bbm_incidences`. `share` solo necesita el 403 (no lee datos de
    tenant). `upload` valida que el `client_id` del planograma pertenece a la
    sesión antes de insertar.
- [ ] **Step 2:** `.env.example`: marcar `DASHBOARD_ALLOWED_EMAILS` como
  `# DEPRECATED (reemplazado por tabla bbm_users desde migración 009)`.
- [ ] **Step 3:** `npm test` (suite completa, no romper tests existentes) +
  `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/app/api/planogram/upload/route.ts src/app/api/planogram/list/route.ts src/app/api/planogram/status/route.ts src/app/api/demo/share/route.ts .env.example
  git commit -m "feat(tenancy): routes usan bbm_users + scopedQuery (reemplaza allowlist)"
  ```

### Tarea 5: Estampar tenencia en el ingest

> **Prerrequisito de orden:** esta tarea asume que `src/lib/pipeline/` ya existe
> (lo crea WS1, spec/03). El roadmap fija WS1 → WS-MT, así que el módulo existirá.
> **Fallback** si WS1 NO está hecho cuando se ejecuta esta tarea: estampar la
> tenencia directamente en los route reales `src/app/api/ubiqo/ingest/route.ts` y
> `src/app/api/planogram/ingest/route.ts` (donde hoy vive el upsert), no en
> `src/lib/pipeline/`. El ejecutor verifica si `src/lib/pipeline/ubiqo.ts` existe
> y elige el archivo correcto; si la ambigüedad de cuál tocar persiste, `BLOCKED`.

- [ ] **Step 1:** En `ingestUbiqoCaptures` / `ingestPlanogramCaptures` (o en los
  route reales — ver prerrequisito): antes del upsert, derivar
  `client_id`/`account_id` de la cadena `form_id → bbm_planogram_assignments
  (planogram_id) → bbm_planograms.client_id → bbm_clients.account_id`. Estampar
  ambas columnas en cada fila upserteada.
  - Si un `form_id` no resuelve a un cliente conocido (sin assignment, o
    planograma sin `client_id` backfilleado): NO upsertar esa fila; loggear
    `unmapped_form_id=<id>` (no inventar un cliente default).
- [ ] **Step 2: Test:** extender `src/lib/pipeline/__tests__/*.test.ts` con un caso
  que verifica que las filas upserteadas llevan `client_id`/`account_id` resueltos,
  y que un `form_id` sin mapeo NO se upsertea.
- [ ] **Step 3:** `npm test` + `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/lib/pipeline
  git commit -m "feat(tenancy): ingest estampa account_id/client_id"
  ```

## Criterios de aceptación

- [ ] Migración 009 creada (no aplicada). Seeds comentados con placeholders, sin
      emails/keys inventados.
- [ ] Tests de aislamiento verdes: `client_user` no ve otro cliente;
      `reseller_admin` ve los suyos y no los de otra cuenta; `bbm_admin` ve todo.
- [ ] `DASHBOARD_ALLOWED_EMAILS` ya no decide acceso (lookup en `bbm_users`).
- [ ] Ingest estampa `client_id`/`account_id`; `form_id` sin mapeo no entra.
- [ ] `npm test` verde `N/N`, `npx tsc --noEmit` exit 0, `npm run lint` exit 0.
- [ ] `src/lib/cookie.ts` y `src/lib/onboarding/auth.ts` sin cambios.

## Comandos de verificación (para /accept)

```bash
npm test
npx tsc --noEmit
npm run lint
git log --oneline main..HEAD
git diff main..HEAD -- supabase/migrations src/lib/tenant src/lib/auth src/app/api
# cookie.ts NO debe haber cambiado:
git diff --name-only main..HEAD | grep -x 'src/lib/cookie.ts' && echo "VIOLATION: cookie.ts tocado" || echo "OK cookie.ts intacto"
# allowlist ya no gobierna acceso:
grep -rn "DASHBOARD_ALLOWED_EMAILS" src/app/api && echo "REVISAR: aún se usa" || echo "OK removido de routes"
git diff --name-only main..HEAD | grep -E '\.env$|\.env\.local|secrets|credentials' && echo "VIOLATION" || echo "OK"
```

## Safety rails

- **NO** aplicar migraciones a la DB (crear el archivo SQL únicamente).
- **NO** reescribir `src/lib/cookie.ts` ni tocar `src/lib/onboarding/auth.ts`.
- **NO** inventar emails reales, `client_key`, ni UUIDs de seed → placeholders /
  `BLOCKED`.
- **NO** `git push`, **NO** `rm -rf`, **NO** `git reset --hard` ajeno.
- **NO** tocar `.env`/`.env.local`/secrets (solo `.env.example`).
- **NO** `WebFetch` ni Supabase real en tests (mock).

## Notas para el worker (ejecutor de la spec)

- Leé `docs/tenancy-model.md` antes de empezar — es el diseño cerrado.
- El aislamiento es la superficie de leak: si un test de aislamiento no pasa, es
  bug bloqueante, no lo marques DONE.
- Ambigüedad de seed (emails/keys reales) → `BLOCKED`, no inventes.
- Commit local por tarea. Self-review: `npm test` + `tsc` + `lint` verdes.

---

## Auditoría pre-implementación

**Fecha:** 2026-05-18
**Resultado global:** Aprobado con cambios — críticos de aislamiento resueltos.
**Criticidad:** máxima (superficie de leak de datos B2B2B).

### Hallazgos críticos (resueltos)

1. **`bbm_planograms` sin `client_id` → leak en `list/route.ts`.** Resuelto:
   Tarea 1 agrega `client_id UUID FK` + backfill desde `client_key` legacy;
   Tarea 4 obliga `scopedQuery` sobre la query de `bbm_planograms`. `client_key`
   pasa a legacy/display, NO es clave de tenencia.
2. **FOTL tiene 2 `client_key` vs `bbm_clients.client_key UNIQUE`.** Cerrado en
   `docs/tenancy-model.md §8`: FOTL = 1 cliente; `bbm_clients.client_key` = slug
   canónico nuevo (`'fotl'`), NO matchea los legacy; el mapeo es por backfill.
3. **`src/lib/pipeline/` no existe si WS1 no corrió.** Resuelto: prerrequisito de
   orden explícito en Tarea 5 + fallback a los route reales + `BLOCKED` si dudoso.
4. **Aplicar 009 sin seeds = todos pierden acceso.** Resuelto: bloque
   `BEGIN/COMMIT`, "009 + seeds en una sola transacción".
5. **`pick_pending_*` cross-tenant.** Documentado como riesgo residual aceptable
   (lecturas de usuario van por `scopedQuery`; RPC se retiran en cierre WS1).

### Observaciones (decisión)

- `bbm_client_configs` (onboarding) **fuera de scope** — documentado explícito en
  "No incluye", no es olvido.
- Test de aislamiento de `reseller_admin` cross-account → **4º caso agregado**
  (account_id del token gana siempre).
- Mock de `supabase` frágil si se agrega un 2º `.eq` → aceptado; los tests son
  ilustrativos del comportamiento, el oracle real es la suite de aislamiento.

### Tests requeridos

| Tipo | Qué verificar | Prioridad |
|------|--------------|-----------|
| Unit | `resolveSession`: sin fila→null, 3 roles | Alta |
| Unit | `scopedQuery`: client_user/reseller/admin + cross-account | **Máxima (leak)** |
| Integración | routes 403 sin `bbm_users`; `list` scopeado | Alta |
| Unit | ingest estampa `client_id`; `form_id` sin mapeo no entra | Alta |

### Criterios de aceptación

Los de la sección arriba + suite de aislamiento `N/N` verde (criterio de cierre
de WS-MT). `git diff src/lib/cookie.ts` vacío.

### Riesgos residuales

- **Backfill incompleto:** un `client_key` legacy no listado deja planogramas sin
  `client_id` → invisibles al dashboard (no leak, sí dato perdido). Mitigar:
  `SELECT DISTINCT client_key FROM bbm_planograms` antes del backfill, confirmar
  cobertura. Operador.
- **RLS no es barrera primaria** (service-role la bypasea). El helper único +
  tests de aislamiento son la defensa real; review debe rechazar queries de datos
  fuera del helper.
- Acceso denegado (email sin `bbm_users`) no se loggea → agregar log de
  diagnóstico en la implementación (observabilidad, no bloqueante).
