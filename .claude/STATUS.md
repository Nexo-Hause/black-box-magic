# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-23 (Sesión 22 — Implementación al 100% de la Fase 4: Onboarding Persistente, Multi-Tenant y sin Fricción, inicio de sesión cero fricción con Email/Empresa, reanudación y autoguardado de sandbox con fotos base64 y dictámenes de IA directamente en Supabase, y timeline interactivo para cargar versiones previas de configuraciones; verificado con 275/275 tests de Vitest en verde). Roadmap TP: `docs/roadmap-2026-05.md`.

---

## Foco Actual

**Objetivo:** MVP **comercializable atado a Ubiqo Evidence**, robusto en producción, para comercializar con clientes (Fruit of the Loom).
**Secuencia estricta:** `WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4 ─► Onboarding Self-Serve`
*   **WS2 Backend & Frontend:** ✅ 100% completado.
*   **WS3 Export Excel:** ✅ 100% completado.
*   **WS4 E2E Planograma Real:** ✅ 100% completado.
*   **Onboarding Self-Serve (Fases 1-3):** ✅ 100% completado (migración a Gemini 3.5 Flash, tags XML, guías dinámicas `/guide` y drawer de calibración).
*   **Onboarding Self-Serve (Fase 4 — Persistencia y Cero Fricción):** ✅ 100% completado y verificado en Vitest (275/275 tests verdes).
*   **Siguiente:** Lanzamiento comercial del MVP y onboarding self-serve interactivo de BBM.

---

## Handoff — próxima sesión (leer esto primero)

**Dónde estamos:** El Onboarding Self-Serve interactivo cuenta con sus Fases 1-4 completamente terminadas, integradas en la UI y probadas (275/275 tests en verde). El login sin fricción por correo, la reanudación interactiva y el autoguardado del sandbox en caliente funcionan de extremo a extremo.

**Siguiente acción concreta:**
1. Presentar el MVP comercializable a los clientes y habilitar el pipeline interactivo self-serve con Fruit of the Loom.

---

## Specs

| Spec | Título | Estado |
| :--- | :--- | :--- |
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — webhook post-MVP |
| 01 | Engine v3 — onboarding conversacional | **Implementado** |
| 02 | Comparación contra Planograma | **Implementado** — Backend, Frontend, Export Excel y Planogramas reales completados y testeados con éxito. |
| 03 | Worker BullMQ en VPS | **Implementado** (BullMQ + Express Bull Board) |
| 04 | Fundación Multi-tenant | **Implementado** (Tablas canónicas + `scopedQuery`) |
| 05 | Hardening de Seguridad | **Implementado** (Retry, taxonomía de error Gemini y robustez Basic Auth) |

---

## Roadmap TP — Workstreams (detalle en `docs/roadmap-2026-05.md`)

| WS | Qué | Estado |
| :--- | :--- | :--- |
| WS0 | Reconciliación, limpieza, docs fiel | **Completo** |
| WS1 | Worker BullMQ en VPS | **Completo** |
| WS-D | Cierre de specs + modelo de tenencia | **Completo** |
| WS-MT | Fundación multi-tenant (3 roles, RLS) | **Completo** |
| WS-H | Hardening de producción | **Completo** |
| WS2 | Dashboard FOTL Fase 2 (tenant-scoped) | **Completo** |
| WS3 | Export Excel Fase 3 (tenant-scoped) | **Completo** |
| WS4 | Validación E2E con fotos reales FOTL | **Completo** (Planograma real subido a Supabase y validado en UI) |
| WS5 | Webhook Ubiqo | **Post-MVP** |

---

## Apps y Tests

| App | Tests | Estado |
| :--- | :--- | :--- |
| API producción (`/api/analyze`) | 60 | Funcional |
| API comparación (`/api/compare`) | — | Funcional |
| Planogram API (`/api/planogram/*`) | 33 | Funcional — upload, clients, incidences, detail, assign, export, regression |
| Ubiqo pipeline (`/api/ubiqo/*`) | 58 | Funcional |
| Hook Dashboard (`useDashboard`) | 3 | Funcional |
| Onboarding API & Synthesis & Persistence | 19 | Funcional — guide, fallback, synthesis, XML, persistence, history, rehydration |
| **Total** | **275 / 275** | Runner: **Vitest ^4.1.2** (100% pass) |

---

## Migraciones Supabase

001 `bbm_client_configs` · 002 `bbm_comparison_log` · 003 `bbm_share_tokens` · 004 `bbm_planograms` · 005 `bbm_incidences` · 006 `bbm_planogram_assignments` · 007 `bbm_onboarding_codes` · 008 `bbm_ubiqo_captures` · 009 `bbm_tenancy` · 010 `add_error_kind` · 011 `make_planogram_id_nullable` — **todas aplicadas con éxito**.

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
| :--- | :--- | :--- |
| Webhook payload format de Evidence | Ubiqo (Guillermo/Alberto) | WS5 (post-MVP) |
| Fotos reales FOTL para E2E | Ubiqo/FOTL vía Enrique | WS4 (no bloquea WS2/WS3) |

---

## Decisiones Clave (sesión 2026-05-22 — nuevas)

| Decisión | Contexto |
| :--- | :--- |
| **Migración Completa a Gemini 3.5 Flash** | Descontinuamos por completo la familia 2.5 en favor de `gemini-3.5-flash` para mantener vigencia frente a deprecaciones de Google y optimizar velocidad/costos. |
| **Encapsulación XML en Criterios** | Enmarcamos dictados libres dentro de tags XML `<user_rules>` para blindar al LLM contra ataques de inyección de prompt de manera simple y robusta. |
| **Descarte Activo de Paja ("N/A")** | El sintetizador descarta de manera proactiva facetas de reglas no mencionadas por el usuario, previniendo reportes con auditorías genéricas o irrelevantes. |

---

## Documentación

*   `docs/roadmap-2026-05.md` — Roadmap TP (fuente de verdad del orden)
*   `docs/tenancy-model.md` — Modelo de tenencia formal (RLS, scoping)
*   `spec/implementation_plan.md` — Plan de diseño y QA de UI + Excel
*   `spec/task.md` — Checklist y estado físico de las tareas
