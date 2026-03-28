# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-03-28 (sesión 3: engine v3 spec + auditoría)

---

## Foco Actual

**Activo:** Engine v3 — Motor multi-industria con onboarding conversacional
**Spec:** `spec/01-engine-v3.md` (1,190 líneas, auditado, PR #3)
**Siguiente:** Implementar Fase 0 (Vitest) + Fase 1 (motor configurable)

---

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| 00 | Integración BBM × Ubiqo (Evidence/Gather) | Aprobado, pendiente tokens de Ubiqo |
| 01 | Engine v3 — Motor multi-industria con onboarding conversacional | Auditado, PR #3 |

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 0 | Funcional |
| Demo (`/demo`) | 0 | En desarrollo activo |
| Email (`/api/demo/email`) | 0 | Funcional |

---

## Bloqueos Activos

| Bloqueo | Depende de | Afecta |
|---------|-----------|--------|
| Tokens de Ubiqo (Bearer, Evidence account, urlBase) | Alberto (Ubiqo) | Spec 00 implementación |
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
| Todo Gemini (Live + Pro + Flash Lite) | Una sola API, una key. Live para voz, Pro para síntesis, Flash Lite para análisis | 3 |
| Scoring server-side | LLM retorna raw values, servidor calcula scores determinísticamente | 3 |
| Auth onboarding: JWT token (opción A) | Liga con token generado por admin. Migración futura a opción C (Ubiqo genera liga) | 3 |
| Triggers de escalación estructurados | Gramática tipada evaluada server-side, no texto libre | 3 |
| Config versioning sin UNIQUE | Partial unique index para active, múltiples versiones por cliente | 3 |
| timingSafeEqual para HMAC | Previene timing attacks en verificación de cookies | 3 |

---

## Próximos Pasos

1. **Mergear PR #3** — spec 01 + fixes de seguridad
2. **Fase 0:** Instalar Vitest, configurar test runner
3. **Fase 1:** Motor configurable (src/lib/engine/) — 0 dependencias externas
4. **Fase 2:** Onboarding por texto (REST chat con Gemini)
5. **Pendiente Ubiqo:** Solicitar tokens a Alberto para spec 00
