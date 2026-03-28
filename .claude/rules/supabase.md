# Supabase — Reglas de Uso

## General

- Supabase es **opcional** en este proyecto — la app debe funcionar si Supabase no está disponible.
- Usar `SUPABASE_SERVICE_ROLE_KEY` solo en server-side (API routes). Nunca en el cliente.
- El cliente Supabase es singleton (`src/lib/supabase.ts`). No crear instancias adicionales.

## Tablas

| Tabla | Propósito |
|-------|-----------|
| `bbm_users` | Registro de usuarios del demo (email, contador de análisis) |
| `bbm_analysis_log` | Log de cada análisis (metadata, resultado, tokens, modelo) |

## Migraciones

- Migraciones siempre **aditivas** — no eliminar columnas ni tablas sin confirmación.
- Documentar migraciones en el PR description.
- Verificar que la migración no rompa queries existentes antes de aplicar.

## Queries

- Usar `upsert` para `bbm_users` (evitar duplicados por email).
- Manejar errores de Supabase con graceful degradation (log del error, no bloquear la app).
- No hacer queries desde componentes React — solo desde API routes o server actions.

## RLS (Row Level Security)

- Si se activa RLS, configurar policies antes de usarlas en producción.
- Service role key bypasea RLS — adecuado para logging server-side, pero no para queries de usuario.
