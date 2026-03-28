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
