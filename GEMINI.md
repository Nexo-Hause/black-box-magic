# Black Box Magic — Reglas para Agentes IA

## Secretos — NUNCA exponer

- **NUNCA leer `.env.local`, `.env`, ni archivos `.env*` con datos reales.** Usar `.env.example` para ver qué variables existen.
- **NUNCA mostrar valores de secretos** en respuestas, comandos, argumentos, logs ni archivos temporales.
- **Para configurar variables en servicios:** escribir scripts que lean internamente sin exponer valores en stdout.
- **Si se expone un secreto por error:** rotarlo inmediatamente, no "recomendar" que el usuario lo haga.

> **Lección (sesión 17):** un `view_file` de `.env.local` expuso todas las credenciales del proyecto. Se rotaron `BBM_COOKIE_SECRET` y `BBM_API_KEYS`. Los tokens de terceros quedaron pendientes de rotación manual.
> **Lección (sesión 18):** El archivo `cierre.md` en la raíz del proyecto (CRMD) es un skill estático con instrucciones y NUNCA debe ser modificado por agentes IA. El estado del proyecto y el handoff solo se actualizan en `.claude/STATUS.md` y `.claude/SESSION_LOG.md`.

## Contexto del proyecto

Este repo usa `CLAUDE.md` como documentación principal de arquitectura y reglas de trabajo. Léelo al inicio de cada sesión para obtener el contexto completo: stack, estructura, reglas de idioma, flujo de trabajo, y convenciones.
