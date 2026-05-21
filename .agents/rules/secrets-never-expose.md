---
description: Regla de seguridad para manejo de secretos por agentes IA. Aplica siempre que se trabaje con variables de entorno, configuración de servicios, o deployment.
globs: ["**/.env*", "**/vercel*", "**/*.env*"]
alwaysApply: true
---

# Secretos — NUNCA exponer

## Reglas inquebrantables

1. **NUNCA leer `.env.local`, `.env`, `.env.production` ni ningún archivo `.env*` con datos reales.** Para verificar qué variables existen, leer `.env.example` (que solo tiene placeholders).
2. **NUNCA mostrar, copiar ni usar valores de secretos en texto plano** — ni en respuestas, ni en argumentos de comandos, ni en archivos temporales.
3. **Para agregar variables a Vercel u otro servicio:** usar scripts que lean los valores internamente sin exponerlos en stdout. Nunca pasar `--value "valor-literal"` en un comando visible.
4. **Para verificar si una variable existe en un servicio:** usar el listado de nombres (ej. `vercel env ls`), nunca pedir el valor.
5. **Si por error se expone un secreto:** rotar inmediatamente todos los secretos afectados, no "recomendar" al usuario que lo haga.

## Incidente de referencia

> **Sesión 17, 2026-05-21:** Un agente hizo `view_file` de `.env.local` y expuso todos los secretos del proyecto (API keys, service role keys, tokens de GitHub/Vercel/Supabase/Ubiqo) en la conversación. Después usó los valores literales en comandos de terminal. Se rotaron `BBM_COOKIE_SECRET` y `BBM_API_KEYS`. Los tokens de terceros quedaron pendientes de rotación manual.
