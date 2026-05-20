# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-19 (Sesión 15 — Cierre de PR #21 y ejecución completa de WS1, 100% de tests en verde, AI review resuelto y verificado). Roadmap TP: `docs/roadmap-2026-05.md`.

---

## Foco Actual

**Objetivo:** MVP **comercializable atado a Ubiqo Evidence**, robusto en producción ("no reventar"), para comercializar/testear con clientes de Ubiqo (B2B2B: Ubiqo reseller + FOTL).
**Roadmap TP (fuente de verdad del orden):** `docs/roadmap-2026-05.md`
**Secuencia estricta:** `WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4`
**WS0:** ✅ completo. 
**WS-D:** ✅ completo (`docs/tenancy-model.md` + decisiones spec/02 cerradas).
**WS1 (Worker BullMQ):** ✅ completo (módulo de pipeline puros `src/lib/pipeline/*`, repeatable jobs del scheduler, control de presupuesto de Gemini, panel de monitoreo Express Bull Board, PM2 y suite de tests 173/173 en verde).
**Siguiente:** WS-MT (fundación multi-tenant) y WS-H (hardening).

---

## Handoff — próxima sesión (leer esto primero)

**Dónde estamos:** WS0, WS-D y WS1 cerrados. Branch de sesión: `session/roadmap-tp-execution` con los cambios listos y validados. PR del review automático corregido tras dos rondas completas (Gemini budget robustness, PM2 compiled relative path y tokens column verification).

**Specs y Estado de Código:**
- `docs/tenancy-model.md` — modelo de tenencia formal (timezone §O1 agregado).
- `spec/02-reference-comparison.md` § WS-D — C11/O1/O3/O4/design-system cerrados.
- `spec/03-ws1-pipeline-bullmq.md` — WS1 completamente ejecutado en el código.
- `spec/04-ws-mt-multitenant.md` — tablas canónicas + auth 3 roles + scoping helper.
- `spec/05-ws-h-hardening.md` — taxonomía error Gemini + token Ubiqo + reconcile.
- `spec/02-ws2-dashboard.md` — dashboard tenant-scoped.
- `spec/02-ws3-export.md` — export Excel tenant-scoped.

**Siguiente acción concreta:** Ejecutar por dependencias WS-MT → WS-H → WS2 → WS3. WS-MT (auth/aislamiento) y WS-H (error policy) = superficie de riesgo, requieren revisión Opus en `/accept`.

**Contexto que NO está en el código (no perder):**
- Objetivo = MVP comercializable, no solo ordenar. Modelo B2B2B (Ubiqo reseller + FOTL).
- Procesamiento por **BullMQ en VPS** (módulo de pipeline puramente desacoplado, listo para deploy por el operador; Express Bull Board con Basic Auth listo).
- Tenencia: **tablas canónicas** `bbm_accounts/clients/users`; reseller-admin en el MVP; multi-cuenta = schema-ready. Aislamiento por helper app-layer.

**Acciones de Gonzalo pendientes:** PR #18 cerrado en GitHub, PR #20 mergeado, PR #21 resuelto mediante Option A (rama `session/roadmap-tp-execution`).

**Branches conservadas:** `main`, `demo/qsr-guillermo` (hold estratégico), `session/roadmap-tp-execution` (rama activa de entrega de WS1).

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — Fase 0+1 en `main` (PR #14 mergeado 2026-04-03). Webhook = esqueleto (post-MVP) |
| 01 | Engine v3 — onboarding conversacional | **Implementado** (Fases 0-4), PRs #5-#6 mergeados |
| 02 | Comparación contra Planograma | **En implementación** — Demo + Fase 0 + Fase 1 en `main`; Fase 2 (dashboard) y Fase 3 (export) NO existen. Re-scope: + WS-MT (multi-tenant) + WS-H (hardening) antes de Fase 2 |
| 03 | Worker BullMQ en VPS | **Implementado** — Código funcional en `infra/vps/worker` y `src/lib/pipeline` (WS1 completo y verificado) |

---

## Roadmap TP — Workstreams (detalle en `docs/roadmap-2026-05.md`)

| WS | Qué | Estado |
|----|-----|--------|
| WS0 | Reconciliación, limpieza, docs fiel | **Completo** |
| WS1 | Worker BullMQ en VPS (reemplaza cron-job.org) | **Completo** (código puro, scheduler de autodescubrimiento, control de costos, Express Bull Board, PM2 config y manual de operador) |
| WS-D | Cierre de specs + modelo de tenencia (Opus) | **Completo** (`docs/tenancy-model.md` + `spec/02` § WS-D, auditado) |
| WS-MT | Fundación multi-tenant (tablas canónicas, 3 roles, helper de scoping) | Spec `spec/04` **escrita + auditada** — lista para ejecución |
| WS-H | Endurecimiento prod (timeout, tope costo, observabilidad, token) | Spec `spec/05` **escrita + auditada** — lista para ejecución |
| WS2 | Dashboard FOTL Fase 2 (tenant-scoped) | Spec `spec/02-ws2` **escrita + auditada** — lista |
| WS3 | Export Excel Fase 3 (tenant-scoped) | Spec `spec/02-ws3` **escrita + auditada** — lista |
| WS4 | Validación E2E con fotos reales FOTL | Pendiente (bloqueado por terceros) |
| WS5 | Webhook Ubiqo | **Post-MVP** (MVP procesa por BullMQ/VPS) |
| WS6 | Negocio: modo + propuesta comercial | Paralelo |

---

## WS0 — Registro de reconciliación (2026-05-18)

- **`main` reconciliada**: estaba 3 commits atrás de `origin/main`; fast-forward a `caea6b3`
  (PR #19, ci review v4). Divergencia 0/0.
- **15 branches locales borradas** (verificadas: cabeza de PR mergeado o contenido superado
  en `main`): chore/sync-claude-config-202604, claude/tender-williamson, feat/admin-page,
  feat/exports-precision-fix, feat/reference-comparison, feat/remotion-video,
  session/2026-03-30-reunion-retail, session/cierre-10, session/engine-v3-fase0-1,
  session/engine-v3-fase4-voice, session/rescue-unmerged-code, session/ubiqo-api-validation,
  spec/engine-v3, demo/qsr-v2, fix/ux-mobile-and-cleanup.
- **Conservadas**: `main`, `demo/qsr-guillermo` (hold estratégico — demo QSR para Guillermo,
  contacto Ubiqo / 2º cliente del plan; revisar antes de borrar), `chore/sync-delegation-audit`
  (PR #18), `session/2026-05-18-ws0-reorder` (branch de sesión).
- **PR #18 — decisión: CERRAR sin merge.** Razón: la rama precede a la V4 del workflow de
  review (PR #19) y mergearla revertiría `.github/workflows/pr-review.yml`. El cierre queda
  **pendiente de acción manual de Gonzalo** (la cuenta `gonzalodev-ops` es read-only en la
  org Nexo-Hause; cerrar requiere UI de GitHub o `NEXO_GITHUB_PAT`). Los deltas valiosos de
  `.claude/` (accept.md, rules/delegation.md) se re-sincronizan limpios desde claude-config
  sobre rama fresca de `main` (no arrastrar el workflow viejo).

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 60 | Funcional + engine v3 routing |
| API comparación (`/api/compare`) | — | Funcional — multi-imagen Gemini + retry/backoff |
| Planogram API (`/api/planogram/*`) | — | Funcional — upload, list, status, ingest, process, webhook (esqueleto) |
| Ubiqo pipeline (`/api/ubiqo/*`) | 58 | ingest, process, results, status |
| Onboarding (`/onboarding`) | 40 | chat + síntesis + test + deploy + voz |
| Engine v3 (`src/lib/engine/`) | 60 | config, prompt-builder, analyzer, escalation |
| Ubiqo lib (`src/lib/ubiqo/`) | 58 | client, types, ssrf, crypto |
| Analyze lib (`src/lib/analyze.ts`) | 12 | función reutilizable 2-pasadas |
| **Total** | ver `npm test` | Runner: **Vitest ^4.1.2**. Suites: engine, ubiqo, onboarding, analyze/auth (~15 archivos `*.test.ts`). Conteo exacto = correr `npm test` (no fijar número sin verificar) |

---

## Migraciones Supabase

001 `bbm_client_configs` · 002 `bbm_comparison_log` · 003 `bbm_share_tokens` · 004
`bbm_planograms` · 005 `bbm_incidences` · 006 `bbm_planogram_assignments` · 007
`bbm_onboarding_codes` · 008 `bbm_ubiqo_captures` + RPCs — **todas aplicadas**. La 008 es
provisional (DROP+recrear OK, sin datos prod) → ventana barata para WS-MT (tenancy).

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
|---------|-----------|--------|
| Cerrar PR #18 | Gonzalo (perm GitHub Nexo-Hause) | Higiene repo (no bloquea MVP) |
| Webhook payload format de Evidence | Ubiqo (Guillermo/Alberto) | WS5 (post-MVP — el MVP va por cron PATH B, NO bloqueado) |
| Fotos reales FOTL para E2E | Ubiqo/FOTL vía Enrique | WS4 (no bloquea WS2/WS3) |
| Despliegue del worker en VPS real | Operador (Gonzalo en VPS con PM2/Redis) | Monitoreo en vivo de producción de BullMQ |

---

## Decisiones Clave (sesión 2026-05-19 — nuevas)

| Decisión | Contexto |
|----------|----------|
| Validación robusta del presupuesto de Gemini | Se añadió validación a `GEMINI_DAILY_BUDGET_LIMIT` para filtrar nulos, negativos o NaN, regresando un fallback seguro de $50 USD. |
| Path físico en ecosystem PM2 validado | Verificamos que debido a `rootDir: "../../../"`, `tsc` genera la salida en `dist/infra/vps/worker/src/worker.js`, lo que valida el config original. |
| Huso Horario canónico (§O1) | Establecemos en `docs/tenancy-model.md` que la UI/Dashboard renderiza fechas en `America/Mexico_City` y la BD almacena en UTC (`TIMESTAMPTZ`). |
| Objetivo = MVP comercializable, no solo ordenar | Reencuadre de Gonzalo |
| Modelo de negocio B2B2B | Ubiqo = cliente + reseller; FOTL et al. = clientes finales; otras cuentas a futuro |
| Tenencia: jerarquía Cuenta→Cliente, 3 roles | bbm_admin / reseller-admin (Ubiqo, **en MVP**) / client-user (FOTL) |
| Tablas canónicas para multi-tenant | `bbm_accounts/clients/users` (no columnas pegadas). Multi-cuenta = schema-ready, lógica diferida |
| WS-MT antes de WS2 | Aislamiento de datos se construye sobre base limpia, no se retrofitea (008 provisional = ventana barata) |
| Enforcement de tenant = app-layer | service-role bypasea RLS; helper centralizado de scoping + RLS defensa en profundidad |
| WS-H completo antes de exponer a cliente | "No reventar": timeout interno, tope de costo, observabilidad, manejo de token |
| Procesamiento por BullMQ en VPS | Reemplaza cron-job.org + cola emulada en Supabase; elimina techo 60s Vercel; retries/observabilidad/fairness nativos. WS-H se reduce |
| Webhook post-MVP | MVP procesa por BullMQ/VPS; webhook no bloquea |
| Triage de branches por mapeo a PR mergeado | `git diff main...branch` (three-dot) y `--is-ancestor` fallan con squash |

> Decisiones históricas (sesiones Pre-init–12) preservadas en git history / `docs/roadmap-2026-05.md` y specs.

---

## Documentación

- `docs/roadmap-2026-05.md` — **Roadmap TP (fuente de verdad del orden de trabajo)**
- `docs/ubiqo/reunion-2026-03-30-retail.md`, `resumen-...`, `analisis-implicaciones-retail-2026-03-30.md`,
  `api-validation-2026-03-31.md`, `analisis-clientes-evidence.md`

---

## Próximos Pasos

1. **Fusión del PR de la sesión a `main`:** La rama de sesión `session/roadmap-tp-execution` ya ha sido revisada automáticamente con AI review de Kimi, todos los findings corregidos, y empujada limpia al origen remoto. El PR está libre de conflictos y listo para merge.
2. **Ejecutar WS-MT (Fundación Multi-tenant):** Iniciar la ejecución de la especificación `spec/04-ws-mt-multitenant.md` para crear la jerarquía de tablas canónicas (`bbm_accounts/clients/users`), inyectar scoping app-layer, y portar los endpoints a multi-tenencia estricta.
3. **Ejecutar WS-H (Hardening):** Iniciar robustez ante errores asíncronos y consumos, asegurando estabilidad ante fallos de Gemini y SSRF.
4. **Despliegue Físico del Worker en VPS:** Cuando el operador tenga acceso a su terminal del VPS, levantar la base de Redis, crear el `.env` correspondiente siguiendo el Runbook del `README.md`, compilar con `npm run build` e iniciar el worker en PM2.
