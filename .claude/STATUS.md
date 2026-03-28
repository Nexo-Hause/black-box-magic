# Estado del Proyecto — Black Box Magic

> Se actualiza al final de cada sesión con `/cierre`.
> Última actualización: 2026-03-28 (sesión 1: inicialización)

---

## Foco Actual

**Activo:** Demo QSR v2 — motor de prompt híbrido, UI en español, exports múltiples

---

## Apps y Tests

| App | Tests | Estado |
|-----|-------|--------|
| API producción (`/api/analyze`) | 0 | Funcional |
| Demo (`/demo`) | 0 | En desarrollo activo |
| Email (`/api/demo/email`) | 0 | Funcional |

---

## Bloqueos Activos

Ninguno.

---

## Decisiones Clave

| Decisión | Contexto | Sesión |
|----------|----------|--------|
| Gemini como motor de visión | Costo bajo (~$0.0015/imagen), calidad suficiente para QSR | Pre-init |
| Prompt híbrido 2 pasadas | Pasada 1: análisis general. Pasada 2: escalación condiciones CRITICAL/MODERATE | Pre-init |
| UI y reportes en español | Target market latinoamericano | Pre-init |
| Cookie HMAC para demo gate | Simplicidad, sin necesidad de auth provider externo | Pre-init |

---

## Próximos Pasos

- Definir en la primera sesión de trabajo post-init
