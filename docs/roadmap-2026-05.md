# Plan — MVP Comercializable Black Box Magic × Ubiqo Evidence

> Roadmap de trabajo vivo. Finalizado 2026-05-18 (sesión de retoma + auditoría profunda +
> dimensionamiento de tenencia). Fuente de verdad del orden de trabajo; STATUS.md referencia
> el workstream activo.

## Context

Proyecto ~6 semanas sin feature dev (última feature PR #14, 2026-04-03; luego solo sync
config/CI hasta 2026-04-29). `STATUS.md` desactualizado.

**Objetivo (Gonzalo):** MVP **comercializable atado a Ubiqo Evidence**, robusto en
producción ("no reventar"), para comercializar/testear con clientes de Ubiqo. Camino:
estabilizar y ordenar primero, estricto secuencial.

**Modelo de negocio (definido):** B2B2B. Ubiqo = cliente **y** reseller (revende a FOTL y
~12 prospectos). BBM puede tener otras cuentas fuera de Ubiqo (a futuro). Jerarquía:
**Cuenta** (`reseller`|`direct`) → **Cliente final** (FOTL…). 3 roles: BBM (ve todo),
reseller-admin (Ubiqo/Enrique, ve sus clientes — **en el MVP**), client-user (Carlos@FOTL,
solo FOTL). Múltiples cuentas/clientes-directos = **schema-ready, lógica diferida**.

**Hallazgos verificados (código/git, no STATUS):**
- PR #14 mergeado. Spec 00 + Spec 02 Fase 1 en `main`. Spec 01 completo.
- Spec 02 (Planograma): Fase 0+1 en `main`; **Fase 2 dashboard y Fase 3 export NO existen**.
- Repo: PR #18 abierto (sync config). 15/17 branches → PRs mergeados; `demo/qsr-v2` y
  `fix/ux-mobile-and-cleanup` sin PR → revisión de contenido.
- **MVP NO necesita webhook**: cron PATH B (`spec/02:37-43`) no depende de Ubiqo → WS5 fuera del crítico.
- Esquema tenancy a medio camino: `bbm_client_configs.client_id`
  (`001:19-52`) y `bbm_planograms.client_key` (`004:6-19`) ya son nivel cliente; falta
  nivel cuenta + entidades canónicas + auth de 3 roles. `bbm_ubiqo_captures`/`bbm_incidences`
  no tienen `client_id`/`account_id`. La 008 dice *"Fase 0-1 schema provisional, DROP+recrear
  OK, no hay datos prod"* → **la ventana barata para tenancy es ahora**; post-datos es
  backfill + riesgo de leak.

**Principios:** por workstream (cierre antes de abrir el siguiente); estricto secuencial;
acciones destructivas/prod requieren OK explícito de Gonzalo; nunca merge/push a `main`;
diseño de specs/arquitectura = Opus (no delegable), ejecución mecánica = delegable; todo
PR → `/review`; **todo al repo**; **revisar código real (file:line), no quedarse en docs**;
no fabricar costos/umbrales.

---

## Definición del MVP

Evidence (cron PATH B) → descarga foto → compara vs planograma del cliente → incidencias
→ **dashboard tenant-scoped que ve el cliente correcto** → **export Excel**. Fundación
multi-tenant (jerarquía cuenta→cliente, 3 roles, aislamiento de datos) construida desde el
inicio. Latencia 5-10 min OK. Producción endurecida (WS-H) para no reventar desatendido.

---

## Camino crítico (estricto secuencial)

`WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4`  ·  WS5/WS6 = post-MVP/paralelo

### WS0 — Reconciliación, limpieza y documentación fiel
1. **Persistir este roadmap al repo PRIMERO** → `docs/roadmap-2026-05.md` ("todo al repo").
2. **`git fetch origin`** + reconciliar `main` ↔ `origin/main` (PRs #17/#19 post-HEAD local).
3. **Triage branches** por mapeo branch→PR mergeado (`gh pr list --state all`; three-dot
   falla con squash). ~15 → PRs #1–#17 (borrables tras sanity); `demo/qsr-v2`,
   `fix/ux-mobile-and-cleanup` sin PR → revisión de contenido por Opus.
4. **Informe de triage → OK explícito de Gonzalo antes de borrar.**
5. **PR #18**: diff resumido → Gonzalo decide. Sin OK no se toca.
6. **Reescribir `STATUS.md`** (PR #14 mergeado; estado specs; narrativa real; Próximos Pasos
   = estos workstreams).
7. **Corregir `CLAUDE.md`**: "Testing — no hay framework" es falso (Vitest ^4.1.2, ~165
   tests, `npm test`); tabla "Specs" no lista Spec 02.

**Cierre:** roadmap+STATUS+CLAUDE.md fieles/commiteados; `main` reconciliada; branches
limpias; PR #18 resuelto. Commit local.

### WS1 — Desbloqueo de producción + medición de latencia real
1. Generar secrets (sin tocar disco/chat): `BBM_FIRMA_ENCRYPTION_KEY` (64-hex, commit
   `3e2297d`), `CRON_SECRET`, `WEBHOOK_SECRET`. (Allowlist plano se reemplaza en WS-MT.)
2. Verificar `UBIQO_API_TOKEN/BASE` en Vercel; separar "fallo de código" vs "credencial".
3. Costo/prereq declarados (regla CLAUDE.md): cron-job.org (gratis vs pago + signup) y
   Vercel Pro (~$20/mes si latencia exige maxDuration>60). Sin fabricar; Gonzalo decide.
4. Smoke test E2E + **medir latencia real por foto** (decide H1/WS-H, maxDuration, Pro).

**Cierre:** filas en Supabase tras cron; latencia medida; decisión Hobby/Pro con datos.

### WS-D — Cierre de decisiones de spec + modelo de tenencia (Opus, NO delegable)
Cerrar y commitear en `spec/02` (o sub-specs):
- **C11** asignación planograma↔formulario · **O1** timezone · **O3/O4** contract de
  `GET /api/planogram/incidences` (params/sort/shape/paginación) + empty state ·
  **design system** badges/columnas.
- **Modelo de tenencia** (decidido — documentar formalmente): jerarquía 2 niveles +
  3 roles + qué es schema-ready vs implementado. Entrada de WS-MT.
- Specs bite-sized `spec/02-ws2-dashboard.md`/`spec/02-ws3-export.md` (imperativos +
  before/after + tests literales) → auditadas → delegables.

**Cierre:** specs commiteadas, sin ambigüedad, pasan auto-test de delegabilidad.

### WS-MT — Fundación multi-tenant (tablas canónicas) · Opus diseña, ejecución delegable
**Decidido: tablas canónicas** (no columnas pegadas). Diseñar-para multi-cuenta,
implementar solo lo del MVP.
- **Esquema (additive; 008 provisional → recreate limpio ahora):**
  - `bbm_accounts` (id, type `reseller|direct`, name, `evidence_api_token` cifrado con el
    patrón AES-256-GCM de `crypto.ts`, created_at). Seed: Ubiqo (reseller).
  - `bbm_clients` (id, `account_id` FK, `client_key` UNIQUE, name). Seed: FOTL bajo Ubiqo.
    Reconciliar `bbm_planograms.client_key` / `bbm_client_configs.client_id` contra esto.
  - `bbm_users` (email, role `bbm_admin|reseller_admin|client_user`, account_id, client_id)
    — **reemplaza `DASHBOARD_ALLOWED_EMAILS` plano**.
  - `account_id`+`client_id` en `bbm_incidences` y `bbm_ubiqo_captures`.
- **Auth de 3 roles:** resolver rol+scope desde `bbm_users` en el verify del cookie/JWT
  (`cookie.ts`/`auth.ts` ya tienen HMAC/jose timing-safe; extender, no reescribir).
- **Helper centralizado de tenant-scoping** usado por TODA lectura del dashboard. Enforcement
  primario = app-layer (la service-role key **bypasea RLS** — `rules/supabase.md`); RLS como
  defensa en profundidad encima.
- **Ingest estampa** `account_id`/`client_id` derivado de form_id→assignment→cliente→cuenta.
- **Reseller-admin en MVP:** ve todos los clientes de su cuenta.
- **Fuera del MVP (schema-ready, lógica diferida):** onboarding multi-cuenta, billing/cuota
  por cuenta, rotación de token por cuenta, fairness de la cola por tenant.
- Tests de aislamiento (client-user NO ve otro cliente; reseller-admin SÍ ve los suyos;
  bbm_admin ve todo) — **prioridad máxima, es la superficie de leak**.

**Cierre:** 3 roles simulados → aislamiento verificado por tests; esquema soporta cuentas
adicionales sin recreate. `/review`.

### WS-H — Endurecimiento de producción ("no reventar")
Prereq: WS-MT. LOCKED antes de WS2/WS3.
- **H1** Timeout interno (`AbortController`) que escriba `failed`/`pending` antes del kill
  de Vercel; ajustar `maxDuration` (Pro=300) según latencia medida en WS1.
- **H2** Guardrail de costo: tope configurable + kill-switch si `pending` > umbral.
- **H3** Observabilidad: `/status` reporta rows `stuck`, tasa de error, último éxito;
  persistir errores consultables.
- **H4** Distinguir transitorio/permanente/safety-block Gemini; fallo token/API Ubiqo
  surfaceado distinto + runbook.

**Cierre:** fallo Gemini/timeout/token simulado → sin stuck/gasto infinito, visible en
`/status`. `/review`.

### WS2 — Dashboard FOTL (Fase 2, ejecución delegable)
Prereq: WS-D + WS-MT + WS-H. Endpoints `incidences` + `incidences/[id]` (signed URLs
on-the-fly, **tenant-scoped vía helper WS-MT**), UI `/dashboard` + `/dashboard/planograms`
+ **selector de cliente por rol** + `useDashboard.ts` + CSS. Reuso: `useEmailGate.ts`,
`cookie.ts`, `demo/page.tsx` (NO Tailwind), `storage.ts`, endpoints existentes. Tests Alta
+ scoping por rol. **Cierre:** Carlos ve solo FOTL; Enrique ve sus clientes; tests `N/N`;
navegador; **PR → `/review`**.

### WS3 — Export Excel (Fase 3, ejecución delegable)
Prereq: WS2. `api/planogram/export` Excel 4 hojas tenant-scoped (patrón `excel.ts`), botón
en dashboard, actualizar `CLAUDE.md`+`.env.example`. **Cierre:** Excel 4 hojas sin fuga
cross-cliente; **PR → `/review`**.

### WS4 — Validación E2E con fotos reales FOTL (bloqueado por terceros)
Gonzalo pide fotos vía Enrique/Ubiqo; E2E → incidencias vs ground truth; tuning
`incidence-prompt.ts` si precisión baja. No bloquea WS2/WS3.

---

## Post-MVP / paralelo
- **WS5 — Webhook Ubiqo:** post-MVP (MVP va por cron PATH B). Implementar mapeo cuando
  Ubiqo entregue formato.
- **WS6 — Negocio:** Modo Demo vs Completo; propuesta comercial con Enrique. Decisión = Gonzalo.

## Backlog (diferido con razón — schema-ready)
- **Lógica multi-cuenta**: onboarding de cuentas, clientes directos / otros resellers,
  billing/cuota por cuenta, rotación de token por cuenta. Schema lo soporta (WS-MT).
- **Fairness de cola por tenant** (pick RPC global FIFO, `008:74-129`).
- **Retención** de filas (spec/02 O2). **Auth real** (OAuth/SSO Evidence).

## NO se hace sin autorización de Gonzalo
Borrar branches · merge/cierre PR #18 · tocar Vercel/cron/DB prod · merge o push a `main`.

---

## Auditoría pre-implementación (2026-05-18)

**Resultado:** Aprobado con cambios — críticos resueltos.

**Críticos resueltos:** C1 triage por mapeo a PR (no three-dot/`--is-ancestor`); C2 WS-D
cierra diseño antes de delegar; C3 roadmap al repo primero; C4 costo cron/Pro declarado sin
fabricar; C5 smoke test separa código vs credencial; C6 WS-H (H1 maxDuration=60 vs latencia
real; H2 retry sí topado a 3+dead-letter en `ubiqo/process/route.ts:137-159`, gap real =
sin tope de costo por período; H3/H4); C7 MVP por cron PATH B (webhook post-MVP); **C8
aislamiento de datos entre clientes → WS-MT** fundación multi-tenant canónica, modelo
B2B2B, reseller-admin en MVP, multi-cuenta schema-ready, ventana barata = ahora.

**Anti-fabricación:** rechazadas cifras inventadas de auditores ("$6K-12K/imagen",
"$0.0003/foto", "Hobby=10s"). Cifra de planificación = repo (~$0.004-0.008/imagen).

**Riesgos residuales:** branches sin PR requieren juicio + OK antes de borrar; WS4 puede
demorarse (fotos externas); latencia Gemini define Vercel Pro; RLS no es defensa primaria
(service-role) → enforcement app-layer en helper único + tests de aislamiento prioridad máxima.
