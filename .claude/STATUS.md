# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-04-01 (sesión 12: Spec 00 + Spec 02 Fase 1 implementados)

---

## Foco Actual

**Activo:** Spec 02 — Comparación contra Planograma (Producción Beta)
**Spec:** `spec/02-reference-comparison.md` (auditado, con auditoría pre-implementación)
**PRs:** #8-#13 mergeados, #14 pendiente de merge (Ubiqo + Planogram pipelines)
**Siguiente:** Configurar cron externo + Fase 2 (dashboard) + test E2E con fotos FOTL

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — Fase 0 validada, Fase 1 completa (PR #14) |
| 01 | Engine v3 — Motor multi-industria con onboarding conversacional | **Implementado** (Fases 0-4), PRs #5-#6 mergeados |
| 02 | Comparación contra Planograma (Producción Beta) | **En implementación** — Demo + Fase 0 + Fase 1 pipeline completas, Fases 2-3 pendientes |

---

## Spec 00 — Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 — Validación API | JWT, form IDs, estructura URL (3 partes), idTipo=7, firma CloudFront | **Completada** |
| 1 — Pipeline genérico | ingest + process + results + status endpoints + SSRF + analyze lib | **Completada** (PR #14) |
| Cron | cron-job.org → POST /api/ubiqo/process cada 1 min | **Pendiente configuración** |

---

## Spec 02 — Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| Demo | UI `/compare` + endpoint `/api/compare` + share tokens | **Completada** |
| 0 — Foundation | Migraciones, tipos, storage, prompt, parser, endpoints upload/list/status | **Completada** |
| 1 — Pipeline | ingest + process + webhook skeleton | **Completada** (PR #14) |
| Cron | cron-job.org → POST /api/planogram/process cada 1 min | **Pendiente configuración** |
| 2 — Dashboard | Endpoints incidences + UI `/dashboard` + `/dashboard/planograms` | **Pendiente** |
| 3 — Export | Excel 4 hojas + cron producción | **Pendiente** |

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 60 | Funcional + engine v3 routing |
| API comparación (`/api/compare`) | — | Funcional — multi-imagen Gemini + retry/backoff |
| Planogram API (`/api/planogram/*`) | — | Funcional — upload, list, status, ingest, process, webhook |
| Ubiqo pipeline (`/api/ubiqo/*`) | 58 nuevos | **Nuevo** — ingest, process, results, status |
| Admin API (`/api/admin/onboarding-code`) | — | Funcional — genera códigos de onboarding (Bearer auth) |
| Demo (`/demo`) | 0 | Funcional (legacy, intacto) |
| Compare (`/compare`) | — | Funcional — UI responsive comparación |
| Email (`/api/demo/email`) | 0 | Funcional |
| Onboarding (`/onboarding`) | 40 | Funcional — chat + síntesis + test + deploy + voz + auto-start |
| Engine v3 (`src/lib/engine/`) | 60 | Funcional — config, prompt-builder, analyzer, escalation |
| Planogram lib (`src/lib/planogram/`) | — | Funcional — storage, incidence-prompt, incidence-parser |
| Ubiqo lib (`src/lib/ubiqo/`) | 58 | **Nuevo** — client, types, ssrf |
| Analyze lib (`src/lib/analyze.ts`) | 12 | **Nuevo** — función reutilizable 2-pasadas |
| **Total** | **165+** | — |

---

## Migraciones Supabase

| Migración | Tabla | Estado |
|-----------|-------|--------|
| 001 | `bbm_client_configs` | ✅ Aplicada |
| 002 | `bbm_comparison_log` | ✅ Aplicada (sesión 12) |
| 003 | `bbm_share_tokens` | ✅ Aplicada (sesión 12) |
| 004 | `bbm_planograms` | ✅ Aplicada (sesión 12) |
| 005 | `bbm_incidences` | ✅ Aplicada (sesión 12) |
| 006 | `bbm_planogram_assignments` | ✅ Aplicada (sesión 12) |
| 007 | `bbm_onboarding_codes` | ✅ Aplicada |
| 008 | `bbm_ubiqo_captures` + stored procedures | ✅ Aplicada (sesión 12) |

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
|---------|-----------|--------|
| Webhook payload format de Evidence | Ubiqo (Guillermo/Alberto) | Spec 02 webhook (esqueleto listo, falta acordar formato) |

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
| Cookie admin separada (bbm_admin) | No compartir cookie demo (bbm_user) con admin. sameSite: strict | 11 |
| Admin email via env var | BBM_ADMIN_EMAIL con fallback hardcoded para dev | 11 |
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
| URL foto = urlBase + path + firma (3 partes) | Descubierto en Fase 0 validación API real | 12 |
| Solo idTipo=7 tiene fotos en API real | idTipo=2 no tiene fotos — corrección al spec original | 12 |
| Atomic pick via stored procedure RPC | JS client no soporta FOR UPDATE SKIP LOCKED | 12 |
| Cron via servicio externo (cron-job.org) | Vercel Hobby no soporta crons de 1/min | 12 |

---

## Documentación Retail

| Doc | Contenido |
|-----|-----------|
| `docs/ubiqo/reunion-2026-03-30-retail.md` | Transcripción reunión con René y Carlos (FOTL) |
| `docs/ubiqo/resumen-reunion-2026-03-30-retail.md` | Resumen ejecutivo + análisis planograma |
| `docs/ubiqo/analisis-implicaciones-retail-2026-03-30.md` | Análisis de implicaciones 1er/2do orden (auditado) |
| `docs/ubiqo/api-validation-2026-03-31.md` | Validación Fase 0 — hallazgos reales del API Evidence |

---

## Próximos Pasos

1. **Mergear PR #14** — pipelines Ubiqo + Planograma (listo, CI verde, review procesado)
2. **Configurar cron externo** — cron-job.org: 2 jobs (ubiqo/process + planogram/process, cada 1 min, Bearer auth)
3. **Smoke test E2E** — ingest form 30143 → process → verificar en DB
4. **Fase 2 Spec 02** — dashboard para Carlos + gestión planogramas
5. **Fase 3 Spec 02** — Excel export 4 hojas
6. **Test E2E con fotos reales FOTL** — validar precisión del prompt de incidencias
7. **Webhook** — acordar formato payload con Guillermo/Alberto antes de activar
