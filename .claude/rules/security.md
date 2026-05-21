# Seguridad — API & Auth

## Autenticación

- **Producción**: Bearer token obligatorio en `Authorization` header. Keys en `BBM_API_KEYS`.
- **Demo**: Cookie HMAC-SHA256 con secreto `BBM_COOKIE_SECRET`. Expiración 30 días. Verificación con `crypto.timingSafeEqual()` — nunca comparación directa de strings.
- Nunca exponer API keys en el cliente. Todo secreto va en `.env.local`.
- No hardcodear secretos, tokens, o credenciales en el código.

## Input Validation

- Validar tipo MIME de imágenes antes de enviar a Gemini (solo image/*).
- Validar tamaño de payload (límite 10MB en `next.config.mjs`).
- Sanitizar cualquier input del usuario antes de incluirlo en prompts (inyección de prompt).
- No confiar en headers del cliente para decisiones de seguridad críticas.

## API Routes

- Todo endpoint público debe validar autenticación antes de procesar.
- Responder con códigos HTTP correctos (401 no autenticado, 403 prohibido, 400 input inválido).
- No exponer stack traces ni detalles internos en respuestas de error.
- Rate limiting: considerar para producción (no implementado aún).

## OWASP Relevantes

- **Injection**: No concatenar input de usuario en queries SQL ni prompts sin sanitizar.
- **Broken Auth**: Validar cookies/tokens en cada request, no solo en la primera.
- **Sensitive Data Exposure**: `.env.local` nunca en git. Supabase service role key solo server-side.
- **Security Misconfiguration**: Headers de seguridad en producción (CORS, CSP).

## Manejo de Secretos por Agentes IA

> **Incidente real (sesión 17, 2026-05-21):** Un agente IA hizo `view_file` de `.env.local` y expuso
> todos los secretos (API keys, service role keys, tokens) en el contexto de la conversación.
> Después usó los valores literales en comandos de terminal. Se tuvo que rotar `BBM_COOKIE_SECRET`,
> `BBM_API_KEYS`, y quedan pendientes de rotación manual los tokens de terceros.

**Reglas inquebrantables:**

1. **NUNCA leer `.env.local`, `.env`, `.env.production` ni ningún archivo `.env*` con datos reales.**
   Para verificar qué variables existen, leer `.env.example` (que solo tiene placeholders).
2. **NUNCA mostrar, copiar ni usar valores de secretos en texto plano** — ni en respuestas, ni en
   argumentos de comandos, ni en archivos temporales.
3. **Para agregar variables a Vercel u otro servicio:** usar scripts que lean los valores internamente
   sin exponerlos en stdout. Nunca pasar `--value "valor-literal"` en un comando visible.
4. **Para verificar si una variable existe en un servicio:** usar el listado de nombres (ej.
   `vercel env ls`), nunca pedir el valor.
5. **Si por error se expone un secreto:** rotar inmediatamente todos los secretos afectados,
   no "recomendar" al usuario que lo haga.

