# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-05-22 (Sesión 21 — Implementación del Onboarding Automático e Interactivo Self-Serve en Gemini 3.5 Flash, mitigación XML de inyección y endpoint dinámico para guías de industrias personalizadas, verificado con 267/267 tests de Vitest en verde). Roadmap TP: `docs/roadmap-2026-05.md`.

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

**Dónde estamos:** El Onboarding Automático e Interactivo Self-Serve está 100% completado, integrado y probado. Migramos el backend del onboarding, síntesis y chat a la familia **Gemini 3.5 Flash**, depreciando la obsoleta familia 2.5. Implementamos mitigaciones de prompt injection encapsulando dictados en tags XML `<user_rules>` e instruyendo tratamiento pasivo. Desarrollamos un endpoint dinámico para guías de industrias personalizadas (`/api/onboarding/guide`) y un selector interactivo Neo-Brutalista con estados del micrófono CSS y un drawer lateral de calibración en caliente para re-síntesis asíncrona. La suite completa cuenta con 267/267 tests pasando con éxito.

**Specs y Estado de Código:**
*   `src/lib/gemini-chat.ts` — Constantes de modelos migradas a `'gemini-3.5-flash'`.
*   `src/lib/onboarding/synthesis.ts` — Encapsulación XML, descarte de paja ("N/A") y mitigación de inyección.
*   `src/app/api/onboarding/guide/route.ts` — Endpoint de preguntas guía dinámicas con fallback estructurado.
*   `src/app/onboarding/onboarding.css` — Estilos Neo-Brutalistas, micrófono pulsante y slide-out calibration drawer.
*   `src/app/onboarding/page.tsx` — Flujo interactivo de 3 pasos y drawer colapsable.

**Siguiente acción concreta:**
1.  Proceder con el merge del PR actual `session/21-onboarding-interactive` a `main` tras validar que el pipeline en CI esté 100% verde.

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
| Onboarding API & Synthesis | 13 | Funcional — guide generation, fallback, synthesis, XML injection test |
| **Total** | **267 / 267** | Runner: **Vitest ^4.1.2** (100% pass) |

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
