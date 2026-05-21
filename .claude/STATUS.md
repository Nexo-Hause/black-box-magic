# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-21 (Sesión 17 — Completado el 100% del Backend de WS2: clientes, incidencias paginadas, detalle firmado y asignación de formulario, hook de React useDashboard verificado con 242/242 tests en verde y 0 errores de compilación tsc. Diseñado y aprobado plan de implementación unificado con la Fase 3 - Export Excel). Roadmap TP: `docs/roadmap-2026-05.md`.

---

## Foco Actual

**Objetivo:** MVP **comercializable atado a Ubiqo Evidence**, robusto en producción, para comercializar con clientes (Fruit of the Loom).
**Secuencia estricta:** `WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4`
*   **WS2 Backend:** ✅ 100% completado (endpoints `clients`, `incidences`, `incidences/[id]`, `assign` y hook `useDashboard` con tests).
*   **Siguiente:** WS2 Frontend (UI del Dashboard `/dashboard` y `/dashboard/planograms`) y WS3 (Export Excel tenant-scoped) unificados en una sola entrega para optimizar pruebas manuales.

---

## Handoff — próxima sesión (leer esto primero)

**Dónde estamos:** El backend del Dashboard (WS2) y toda la lógica de filtrado, paginación, firmado seguro de imágenes y asignación de planogramas a formularios 1:1 ya están completamente implementados, integrados y testeados. Además, se redactó el **Plan de Implementación Unificado (`spec/implementation_plan.md`)** que cubre de forma conjunta el Frontend del Dashboard (WS2) y el Exportador a Excel (WS3) con sus respectivas auditorías pre-implementación completadas (incluyendo Fase 3: Puntos Ciegos).

**Specs y Estado de Código:**
*   `spec/implementation_plan.md` — Plan de diseño y QA unificado para WS2 Frontend y WS3.
*   `spec/task.md` — Lista de tareas detallada con seguimiento y estado actual del trabajo.
*   `src/app/api/planogram/assign/route.ts` — Asignación 1:1 con prevención de duplicados HTTP 409 y cross-tenant HTTP 404.
*   `src/hooks/useDashboard.ts` — Hook React para el manejo de estados de filtros, paginación y detalle de incidencias.

**Siguiente acción concreta:**
1.  Obtener la confirmación de Gonzalo para fusionar el PR de esta sesión (`session/ws2-ws3-dashboard`) una vez aprobado el review automático de IA.
2.  Iniciar en una nueva sesión limpia el desarrollo de las vistas del Frontend (`/dashboard` y `/dashboard/planograms`) e implementar la capa de Exportación a Excel (WS3) conforme a la Tarea 8 del `spec/task.md`.

---

## Specs

| Spec | Título | Estado |
| :--- | :--- | :--- |
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — webhook post-MVP |
| 01 | Engine v3 — onboarding conversacional | **Implementado** |
| 02 | Comparación contra Planograma | **En implementación** — Backend completado, plan de frontend e implementación de export unificados en `spec/implementation_plan.md` |
| 03 | Worker BullMQ en VPS | **Implementado** (BullMQ + Express Bull Board) |
| 04 | Fundación Multi-tenant | **Implementado** (Tablas canónicas + `scopedQuery`) |
| 05 | Hardening de Producción | **Implementado** (Retry, taxonomía de error Gemini y robustez Basic Auth) |

---

## Roadmap TP — Workstreams (detalle en `docs/roadmap-2026-05.md`)

| WS | Qué | Estado |
| :--- | :--- | :--- |
| WS0 | Reconciliación, limpieza, docs fiel | **Completo** |
| WS1 | Worker BullMQ en VPS | **Completo** |
| WS-D | Cierre de specs + modelo de tenencia | **Completo** |
| WS-MT | Fundación multi-tenant (3 roles, RLS) | **Completo** |
| WS-H | Hardening de producción | **Completo** |
| WS2 | Dashboard FOTL Fase 2 (tenant-scoped) | **Backend completado y testeado** (Falta UI / Frontend) |
| WS3 | Export Excel Fase 3 (tenant-scoped) | **Spec escrita + plan de ejecución unificado** |
| WS4 | Validación E2E con fotos reales FOTL | Pendiente |
| WS5 | Webhook Ubiqo | **Post-MVP** |

---

## Apps y Tests

| App | Tests | Estado |
| :--- | :--- | :--- |
| API producción (`/api/analyze`) | 60 | Funcional |
| API comparación (`/api/compare`) | — | Funcional |
| Planogram API (`/api/planogram/*`) | 21 | Funcional — upload, clients, incidences, detail, assign |
| Ubiqo pipeline (`/api/ubiqo/*`) | 58 | Funcional |
| Hook Dashboard (`useDashboard`) | 3 | Funcional |
| **Total** | **242 / 242** | Runner: **Vitest ^4.1.2** (100% pass) |

---

## Migraciones Supabase

001 `bbm_client_configs` · 002 `bbm_comparison_log` · 003 `bbm_share_tokens` · 004 `bbm_planograms` · 005 `bbm_incidences` · 006 `bbm_planogram_assignments` · 007 `bbm_onboarding_codes` · 008 `bbm_ubiqo_captures` · 009 `bbm_tenancy` · 010 `add_error_kind` — **todas aplicadas con éxito**.

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
| :--- | :--- | :--- |
| Webhook payload format de Evidence | Ubiqo (Guillermo/Alberto) | WS5 (post-MVP) |
| Fotos reales FOTL para E2E | Ubiqo/FOTL vía Enrique | WS4 (no bloquea WS2/WS3) |

---

## Decisiones Clave (sesión 2026-05-21 — nuevas)

| Decisión | Contexto |
| :--- | :--- |
| **Integración Unificada WS2 + WS3** | Decidimos unificar el desarrollo del Frontend de la UI del Dashboard (WS2) y de la exportación a Excel (WS3) para evitar duplicación de flujos de prueba y entregar el dashboard utilizable de un solo golpe. |
| **Límite Defensivo de Exportación** | Establecemos un límite de 5,000 registros en el exportador de Excel para proteger los entornos serverless de caídas de tipo memoria insuficiente (OOM), retornando HTTP 413. |
| **Generación Server-Side de Excel** | Ejecutar SheetJS (`xlsx`) puramente del lado del servidor para evitar inflar el bundle size de frontend en el cliente, manteniendo la UI sumamente responsiva. |

---

## Documentación

*   `docs/roadmap-2026-05.md` — Roadmap TP (fuente de verdad del orden)
*   `docs/tenancy-model.md` — Modelo de tenencia formal (RLS, scoping)
*   `spec/implementation_plan.md` — Plan de diseño y QA de UI + Excel
*   `spec/task.md` — Checklist y estado físico de las tareas
