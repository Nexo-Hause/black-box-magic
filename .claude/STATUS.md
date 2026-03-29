# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-03-28 (sesión 5: video Remotion BBM+Evidence)

---

## Foco Actual

**Activo:** Engine v3 — Motor multi-industria con onboarding conversacional
**Spec:** `spec/01-engine-v3.md` (1,190 líneas, auditado)
**PR:** #5 — Fases 0-3 implementadas, 3 rondas de AI review procesadas
**Siguiente:** Mergear PR #5, ejecutar migración Supabase, Fase 4 (voz, opcional)

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | Aprobado, pendiente tokens de Ubiqo |
| 01 | Engine v3 — Motor multi-industria con onboarding conversacional | Fases 0-3 implementadas, PR #5 |

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 60 | Funcional + engine v3 routing |
| Demo (`/demo`) | 0 | Funcional (legacy, intacto) |
| Email (`/api/demo/email`) | 0 | Funcional |
| Onboarding (`/onboarding`) | 40 | Nuevo — chat + síntesis + test + deploy |
| Engine v3 (`src/lib/engine/`) | 60 | Nuevo — config, prompt-builder, analyzer, escalation |
| **Total** | **100** | — |

---

## Engine v3 — Progreso de Fases

| Fase | Descripción | Estado | Archivos |
|------|-------------|--------|----------|
| 0 | Infraestructura de tests (Vitest + Zod) | **Completada** | vitest.config.ts, package.json |
| 1 | Motor configurable | **Completada** | src/lib/engine/* (6 módulos) |
| 2 | Onboarding por texto | **Completada** | src/lib/onboarding/* (5 módulos), 3 endpoints, UI |
| 3 | Test de fotos + deploy | **Completada** | test-runner, 2 endpoints, UI testing/deploy |
| 4 | Voz con Live API | **Pendiente** (opcional) | Requiere investigar token efímero de Google |

---

## Migración Supabase Pendiente

Archivo: `supabase/migrations/001_create_bbm_client_configs.sql`

Ejecutar manualmente en Supabase SQL Editor. Crea tabla `bbm_client_configs` con:
- Config JSONB, transcript JSONB, partial_config JSONB
- Partial unique index: un solo config `active` por client_id
- Indexes para (client_id, status), status, industry

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
|---------|-----------|--------|
| Tokens de Ubiqo (Bearer, Evidence account, urlBase) | Alberto (Ubiqo) | Spec 00 implementación |
| PAT de GitHub sin permisos de write | Gonzalo | Crear PRs desde CLI |
| Migración Supabase no ejecutada | Gonzalo (SQL Editor) | Onboarding funcional en producción |

---

## Decisiones Clave

| Decisión | Contexto | Sesión |
|----------|----------|--------|
| Gemini como motor de visión | Costo bajo (~$0.004/imagen), calidad suficiente para QSR | Pre-init |
| Prompt híbrido 2 pasadas | Pasada 1: análisis general. Pasada 2: escalación condiciones | Pre-init |
| UI y reportes en español | Target market latinoamericano | Pre-init |
| Cookie HMAC para demo gate | Simplicidad, sin auth provider externo | Pre-init |
| Path B: Rule engine estructurado | Motor configurable por cliente, no prompt templates por industria | 2-3 |
| Todo Gemini (Live + Pro + Flash Lite) | Una sola API, una key. Live para voz, Pro para síntesis, Flash Lite para análisis | 3 |
| Scoring server-side | LLM retorna raw values, servidor calcula scores determinísticamente | 3 |
| Auth onboarding: JWT con HMAC derivation | JWT derivado de BBM_COOKIE_SECRET via HMAC, no reuso directo. Code exchange en vez de JWT en URL | 4 |
| Triggers de escalación estructurados | Gramática tipada evaluada server-side, no texto libre | 3 |
| Config versioning sin UNIQUE | Partial unique index para active, múltiples versiones por cliente | 3 |
| jose para JWT | Ligero, ESM-first, edge-compatible. No jsonwebtoken (CommonJS, pesado) | 4 |
| gemini-chat.ts separado de gemini.ts | Chat texto ≠ análisis imagen. Módulos paralelos, no extensión | 4 |
| Remotion para video marketing | Video programático con React, skill oficial instalado. TTS con Gemini, música con Lyria 3 | 5 |
| Proteger IP en materiales públicos | Nunca exponer modelos, costos, arquitectura en videos/presentaciones. Solo beneficios. | 5 |
| SVG icons sobre emojis | Emojis renderizan diferente por OS. SVG inline para consistencia cross-platform. | 5 |

---

## Video BBM + Evidence (Remotion)

**Estado:** Renderizado, listo para review
**Archivo:** `out/bbm-evidence.mp4` (10 MB, 1920x1080, 2:10)
**Audio:** Voiceover Gemini TTS + música Lyria 3
**Archivos fuente:** `remotion/src/` (8 escenas, 7 componentes, theme centralizado)

---

## Próximos Pasos

1. **Mergear PR #5** — engine v3 completo (Fases 0-3)
2. **Ejecutar migración SQL** — `supabase/migrations/001_create_bbm_client_configs.sql`
3. **Test E2E manual** — onboarding completo con Gemini real
4. **Fase 4 (opcional):** Investigar Live API token efímero para voz
5. **Pendiente Ubiqo:** Solicitar tokens a Alberto para spec 00
6. **Video BBM+Evidence:** Iterar pacing voiceover vs escenas, considerar re-render con audio ajustado
