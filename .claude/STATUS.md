# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-18 (Sesión 13 — cierre: retoma + auditoría profunda +
> reencuadre a MVP multi-tenant + WS0 completo + pivote BullMQ). Roadmap: `docs/roadmap-2026-05.md`.

---

## Foco Actual

**Objetivo:** MVP **comercializable atado a Ubiqo Evidence**, robusto en producción ("no
reventar"), para comercializar/testear con clientes de Ubiqo (B2B2B: Ubiqo reseller + FOTL).
**Roadmap (fuente de verdad del orden):** `docs/roadmap-2026-05.md`
**Secuencia estricta:** `WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4`
**WS0:** ✅ completo. **Siguiente:** WS-D (cierre de specs + modelo de tenencia formal — diseño).

---

## Handoff — próxima sesión (leer esto primero)

**Dónde estamos:** WS0 cerrado. Branch `session/2026-05-18-ws0-reorder`, commits
`cbafbb4` (WS0) + `3b2023e` (pivote BullMQ) + el cierre de Sesión 13. PR de esta sesión:
ver sección PR abajo.

**Siguiente acción concreta:** arrancar **WS-D** (Opus, no delegable): cerrar en `spec/02`
C11 (asignación planograma↔form), O1 (timezone), O3/O4 (contract `GET /api/planogram/
incidences` + paginación), design system; y **formalizar el modelo de tenencia** (jerarquía
Cuenta→Cliente, 3 roles, qué es schema-ready vs implementado). Salida: specs bite-sized
`spec/02-ws2-dashboard.md` + `spec/02-ws3-export.md` auditadas. Alternativa si se prefiere
desbloquear ejecución: detallar el refactor de extracción a `src/lib/pipeline/` (habilita WS1).

**Contexto que NO está en el código (no perder):**
- Objetivo = MVP comercializable, no solo ordenar. Modelo B2B2B (Ubiqo reseller + FOTL).
- Pivote decidido: procesamiento por **BullMQ en VPS** (reemplaza cron-job.org + cola
  emulada en Supabase; elimina techo 60s Vercel). WS-H quedó reducido.
- Tenencia: **tablas canónicas** `bbm_accounts/clients/users`; reseller-admin en el MVP;
  multi-cuenta = schema-ready. Aislamiento por helper app-layer (service-role bypasea RLS).
- 008 es schema provisional (sin datos prod) → ventana barata para WS-MT = ahora.

**Acciones de Gonzalo pendientes (no bloquean WS-D):**
- Cerrar PR #18 en GitHub (decisión: cerrar sin merge — revierte workflow CI).
- Mergear el PR de esta sesión (Sesión 13) cuando el review esté limpio.

**Branches conservadas:** `main`, `demo/qsr-guillermo` (hold estratégico — revisar antes
de borrar), `chore/sync-delegation-audit` (= PR #18 a cerrar).

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — Fase 0+1 en `main` (PR #14 mergeado 2026-04-03). Webhook = esqueleto (post-MVP) |
| 01 | Engine v3 — onboarding conversacional | **Implementado** (Fases 0-4), PRs #5-#6 mergeados |
| 02 | Comparación contra Planograma | **En implementación** — Demo + Fase 0 + Fase 1 en `main`; Fase 2 (dashboard) y Fase 3 (export) NO existen. Re-scope: + WS-MT (multi-tenant) + WS-H (hardening) antes de Fase 2 |

---

## Roadmap MVP — Workstreams (detalle en `docs/roadmap-2026-05.md`)

| WS | Qué | Estado |
|----|-----|--------|
| WS0 | Reconciliación, limpieza, docs fiel | **En curso** |
| WS1 | Worker BullMQ en VPS (reemplaza cron-job.org) | Pendiente |
| WS-D | Cierre de specs + modelo de tenencia (Opus) | Pendiente |
| WS-MT | Fundación multi-tenant (tablas canónicas, 3 roles, helper de scoping) | Pendiente |
| WS-H | Endurecimiento prod (timeout, tope costo, observabilidad, token) | Pendiente |
| WS2 | Dashboard FOTL Fase 2 (tenant-scoped) | Pendiente |
| WS3 | Export Excel Fase 3 (tenant-scoped) | Pendiente |
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
| **Total** | **~165** | Runner: **Vitest ^4.1.2** (`npm test`). CLAUDE.md aún dice "no hay framework" → corregir en WS0.7 |

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
| Worker BullMQ no desplegado | WS1 | Pipeline no corre hasta montar worker+Redis en VPS |

---

## Decisiones Clave (sesión 2026-05-18 — nuevas)

| Decisión | Contexto |
|----------|----------|
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

- `docs/roadmap-2026-05.md` — **roadmap MVP (fuente de verdad del orden de trabajo)**
- `docs/ubiqo/reunion-2026-03-30-retail.md`, `resumen-...`, `analisis-implicaciones-retail-2026-03-30.md`,
  `api-validation-2026-03-31.md`, `analisis-clientes-evidence.md`

---

## Próximos Pasos

1. **WS0.7** — corregir CLAUDE.md (Testing: Vitest real; Specs: agregar Spec 02).
2. **WS0.8** — commit local de cierre WS0.
3. **Gonzalo**: cerrar PR #18 desde GitHub (decisión ya tomada arriba).
4. **WS1** — extraer lógica de proceso a `src/lib/pipeline/`; worker BullMQ + repeatable
   ingest en VPS; secrets al VPS; smoke test E2E por la cola.
5. Seguir secuencia: WS-D → WS-MT → WS-H → WS2 → WS3 → WS4.
