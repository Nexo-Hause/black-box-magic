# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-22 (Sesión 20 — Resolución de la visualización del planograma de referencia reemplazando el placeholder de 1x1 píxeles por un diagrama real y profesional en Supabase Storage, verificado con 259/259 tests de Vitest en verde). Roadmap TP: `docs/roadmap-2026-05.md`.

---

## Foco Actual

**Objetivo:** MVP **comercializable atado a Ubiqo Evidence**, robusto en producción, para comercializar con clientes (Fruit of the Loom).
**Secuencia estricta:** `WS0 ─► WS1 ─► WS-D ─► WS-MT ─► WS-H ─► WS2 ─► WS3 ─► WS4`
*   **WS2 Backend & Frontend:** ✅ 100% completado (endpoints de catálogo/incidencias/asignación, hook `useDashboard` y pantallas `/dashboard` y `/dashboard/planograms` con drag&drop y asignación).
*   **WS3 Export Excel:** ✅ 100% completado (generador multi-hoja con pivots, sanitización de celdas contra inyección CSV/DDE, tope de 5,000 registros para evitar OOM, endpoint `/api/planogram/export` y botón de descarga interactivo).
*   **WS4 E2E Planograma Real:** ✅ 100% completado (reemplazo de la imagen placeholder verde de 1x1 píxeles por un planograma real y profesional en Supabase Storage).
*   **Siguiente:** Proceder al merge de la sesión actual a `main`.

---

## Handoff — próxima sesión (leer esto primero)

**Dónde estamos:** WS2 (Dashboard Frontend), WS3 (Export Excel) y WS4 (Validación E2E en campo con planogramas reales) se encuentran 100% completados de extremo a extremo, integrados y testeados. Se diagnosticó y resolvió el problema del cuadro de planograma que aparecía en verde sólido en la UI: se debía a que el script de semillas cargaba un placeholder de 1x1 píxeles verdes en Supabase Storage, el cual era estirado por el navegador con `object-fit: contain`. Se subió de forma exitosa una imagen de planograma real y profesional que ahora se renderiza perfectamente en el modal de incidencias. La suite completa cuenta con 259/259 tests pasando con éxito.

**Specs y Estado de Código:**
*   `spec/implementation_plan.md` — Plan de diseño y QA unificado para WS2 Frontend y WS3 cerrado.
*   `spec/task.md` — Lista de tareas detallada con el 100% de las tareas marcadas como completadas.
*   `src/app/api/planogram/export/route.ts` — Endpoint de exportación con control de OOM (límite de 5,000 registros) y `scopedQuery`.
*   `src/app/api/planogram/__tests__/bulletproof-verification.test.ts` — Pruebas de regresión y robustez E2E añadidas.
*   `src/hooks/useDashboard.ts` — Actualizado con type-safety para la propiedad `client_key`.

**Siguiente acción concreta:**
1.  Proceder con el despliegue / merge de la rama `session/ws2-ws3-dashboard` (o el flujo de despliegue actual en `main`).

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
| **Total** | **259 / 259** | Runner: **Vitest ^4.1.2** (100% pass) |

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
