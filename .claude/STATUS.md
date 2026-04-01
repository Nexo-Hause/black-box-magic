# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-03-31 (sesión 10: rescue código perdido de sesiones paralelas)

---

## Foco Actual

**Activo:** Spec 02 — Comparación contra Planograma (Producción Beta)
**Spec:** `spec/02-reference-comparison.md` (auditado, con auditoría pre-implementación)
**PRs:** #8 (docs reunión retail), #9 (implementación Demo + Fase 0 producción)
**Siguiente:** Implementar Fase 1 (process endpoint) + Fase 2 (dashboard)

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | Aprobado, pendiente tokens de Ubiqo |
| 01 | Engine v3 — Motor multi-industria con onboarding conversacional | **Implementado** (Fases 0-4), PRs #5-#6 mergeados |
| 02 | Comparación contra Planograma (Producción Beta) | **En implementación** — Demo + Fase 0 prod completas, Fases 1-3 pendientes |

---

## Spec 02 — Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| Demo | UI `/compare` + endpoint `/api/compare` + share tokens | **Completada** |
| 0 — Foundation | Migraciones, tipos, storage, prompt, parser, endpoints upload/list/status | **Completada** |
| 1 — Pipeline | Endpoint process + ingest + webhook + cron | **Pendiente** (process no tiene bloqueo) |
| 2 — Dashboard | Endpoints incidences + UI `/dashboard` + `/dashboard/planograms` | **Pendiente** |
| 3 — Export | Excel 4 hojas + cron producción | **Pendiente** |

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 60 | Funcional + engine v3 routing |
| API comparación (`/api/compare`) | — | Nuevo — multi-imagen Gemini + retry/backoff |
| Planogram API (`/api/planogram/*`) | — | Nuevo — upload, list, status |
| Admin API (`/api/admin/onboarding-code`) | — | Nuevo — genera códigos de onboarding (Bearer auth) |
| Demo (`/demo`) | 0 | Funcional (legacy, intacto) |
| Compare (`/compare`) | — | Nuevo — UI responsive comparación |
| Email (`/api/demo/email`) | 0 | Funcional |
| Onboarding (`/onboarding`) | 40 | Funcional — chat + síntesis + test + deploy + voz + auto-start |
| Engine v3 (`src/lib/engine/`) | 60 | Funcional — config, prompt-builder, analyzer, escalation |
| Planogram lib (`src/lib/planogram/`) | — | Nuevo — storage, incidence-prompt, incidence-parser |
| **Total** | **107+** | — |

---

## Migraciones Supabase

| Migración | Tabla | Estado |
|-----------|-------|--------|
| 001 | `bbm_client_configs` | Pendiente |
| 002 | `bbm_comparison_log` | Pendiente |
| 003 | `bbm_share_tokens` | Pendiente |
| 004 | `bbm_planograms` | Pendiente |
| 005 | `bbm_incidences` | Pendiente |
| 006 | `bbm_planogram_assignments` | Pendiente |
| 007 | `bbm_onboarding_codes` | Pendiente |

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
|---------|-----------|--------|
| Tokens de Ubiqo (Bearer, Evidence account, urlBase) | Alberto (Ubiqo) | Spec 00 + spec 02 Fase 1 (ingest) |
| Webhook payload format de Evidence | Ubiqo | Spec 02 Fase 1 (webhook) |
| PAT de GitHub sin permisos de write | Gonzalo | Crear PRs desde CLI |

---

## Decisiones Clave

| Decisión | Contexto | Sesión |
|----------|----------|--------|
| Gemini como motor de visión | Costo bajo (~$0.004/imagen), calidad suficiente para QSR | Pre-init |
| Prompt híbrido 2 pasadas | Pasada 1: análisis general. Pasada 2: escalación condiciones | Pre-init |
| UI y reportes en español | Target market latinoamericano | Pre-init |
| Cookie HMAC para demo gate | Simplicidad, sin auth provider externo | Pre-init |
| Path B: Rule engine estructurado | Motor configurable por cliente, no prompt templates por industria | 2-3 |
| Todo Gemini (Live + Pro + Flash Lite) | Una sola API, una key | 3 |
| Scoring server-side | LLM retorna raw values, servidor calcula scores determinísticamente | 3 |
| Auth onboarding: JWT con HKDF derivation | JWT derivado de BBM_COOKIE_SECRET via HKDF-SHA256 | 6 |
| Triggers de escalación estructurados | Gramática tipada evaluada server-side, no texto libre | 3 |
| jose para JWT | Ligero, ESM-first, edge-compatible | 6 |
| Ephemeral tokens para Live API | Browser conecta directo a Gemini via WebSocket | 6 |
| Onboarding codes en Supabase | Códigos persistentes (7 días TTL), fallback in-memory | 10 |
| Modelos Gemini actualizados | Chat: 2.5-flash, Synthesis: 2.5-pro, Live: 3.1-flash-live-preview | 10 |
| Remotion para video marketing | Video programático con React, TTS con Gemini, música con Lyria 3 | 5 |
| Media con Veo 3.1 + Imagen 4 | Clips de video e imágenes AI para fondos de escenas Remotion | 9 |
| Proteger IP en materiales públicos | Nunca exponer modelos, costos, arquitectura en videos/presentaciones | 5 |
| CSS del proyecto (no Tailwind) | globals.css classes + CSS variables. NO Tailwind | 7 |
| Comparación como feature de primer nivel | ComparisonResult tipo separado de EngineV3Result (no criterion type) | 8 |
| Incidencias > scoring de cumplimiento | Carlos necesita "qué está mal", no "qué % está bien" | 8 |
| Webhook async (enqueue only) | Webhook solo encola (202), cron procesa. 90s timeout insuficiente para sync | 8 |
| Auth dashboard: email gate + allowlist | DASHBOARD_ALLOWED_EMAILS en env. Para producción futura: auth real | 8 |
| Supabase Storage privado + signed URLs | Bucket privado, TTL 30 min, paths en DB (no URLs firmadas) | 8 |
| Planograma ↔ formulario Evidence (1:1) | Carlos asigna planograma a form. bbm_planogram_assignments | 8 |
| Multi-foto por captura Evidence | Un folio = un grupo de fotos, se comparan juntas | 8 |

---

## Documentación Retail

| Doc | Contenido |
|-----|-----------|
| `docs/ubiqo/reunion-2026-03-30-retail.md` | Transcripción reunión con René y Carlos (FOTL) |
| `docs/ubiqo/resumen-reunion-2026-03-30-retail.md` | Resumen ejecutivo + análisis planograma |
| `docs/ubiqo/analisis-implicaciones-retail-2026-03-30.md` | Análisis de implicaciones 1er/2do orden (auditado) |

---

## Próximos Pasos

1. **Mergear PRs #8 y #9** — docs retail + implementación spec 02
2. **Implementar Fase 1** — endpoint `process` (sin bloqueo externo)
3. **Implementar Fase 2** — dashboard para Carlos + gestión planogramas
4. **Implementar Fase 3** — Excel export 4 hojas
5. **Ejecutar migraciones** — 001-006 en Supabase SQL Editor
6. **Test E2E con fotos reales FOTL** — validar precisión del prompt de incidencias
7. **Pendiente Ubiqo:** Tokens para ingest + formato webhook
