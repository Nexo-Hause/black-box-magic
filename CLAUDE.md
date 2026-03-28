# Black Box Magic

API de análisis visual con IA para retail y QSR (Quick Service Restaurants). Recibe fotos de tiendas, restaurantes y puntos de venta, y retorna inteligencia estructurada en 7 facetas: inventario, shelf share, precios, compliance, condiciones, contexto y recomendaciones estratégicas.

---

## Arquitectura

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/          # API producción (Bearer token auth)
│   │   ├── demo/             # Endpoints demo (cookie-gated)
│   │   │   ├── analyze/      # Análisis demo
│   │   │   └── email/        # Envío de reportes por email
│   │   ├── gate/             # Email gate (registro + check)
│   │   └── health/           # Status + documentación
│   ├── demo/                 # UI demo (upload, batch, exports)
│   └── page.tsx              # Landing page
├── lib/
│   ├── auth.ts               # Bearer token auth (producción)
│   ├── cookie.ts             # HMAC-signed email cookie (demo)
│   ├── gemini.ts             # Cliente Gemini Vision (2 modelos, fallback)
│   ├── prompts.ts            # Motor de prompt híbrido v2 (2 pasadas)
│   ├── supabase.ts           # Cliente Supabase (logging)
│   ├── email.ts              # Composición y envío de emails
│   └── exports/              # PDF, Excel, JSON, clipboard, WhatsApp, imagen anotada
├── types/
│   └── analysis.ts           # Interfaces TypeScript del response
└── hooks/
    └── useEmailGate.ts       # Hook React para estado del gate
```

---

## Tech Stack

| Tecnología | Uso | Versión |
|-----------|-----|---------|
| Next.js | Framework full-stack | 14.2.21 |
| TypeScript | Lenguaje (strict mode) | ^5 |
| React | UI | ^18 |
| Google Gemini API | Visión AI (análisis de imágenes) | gemini-3.1-flash-lite-preview |
| Supabase | PostgreSQL — logging de uso y usuarios | ^2.100.0 |
| Nodemailer | Email SMTP vía Gmail | ^8.0.4 |
| jspdf + autotable | Generación de PDF | ^4.2.1 |
| xlsx | Export Excel multi-hoja | ^0.18.5 |
| Vercel | Deployment serverless | — |

---

## Stack Existente Primero

| Necesito... | Usar | NO usar |
|------------|------|---------|
| Base de datos | Supabase (ya integrado) | Otro proveedor PostgreSQL |
| AI Vision | Gemini API (ya integrado) | OpenAI Vision, Claude Vision |
| Email | Nodemailer + Gmail SMTP | SendGrid, Resend, SES |
| PDF | jspdf + jspdf-autotable | Puppeteer, html-to-pdf |
| Excel | xlsx (SheetJS) | ExcelJS |
| Styling | Tailwind CSS (inline) | CSS modules, styled-components |
| Auth (producción) | Bearer token (BBM_API_KEYS) | NextAuth, Clerk |
| Auth (demo) | Cookie HMAC-signed | — |

---

## Archivos Clave

| Archivo | Responsabilidad |
|---------|----------------|
| `src/lib/prompts.ts` | Motor de prompt híbrido v2 — lógica de 2 pasadas y auto-escalación |
| `src/lib/gemini.ts` | Cliente Gemini — modelos, fallback, extracción JSON |
| `src/types/analysis.ts` | Contrato de tipos del response de análisis |
| `src/app/api/analyze/route.ts` | Endpoint producción (auth + análisis) |
| `src/app/api/demo/analyze/route.ts` | Endpoint demo (cookie gate + análisis) |
| `src/app/demo/page.tsx` | UI principal del demo |
| `src/lib/supabase.ts` | Cliente Supabase + funciones de logging |
| `vercel.json` | Configuración serverless (timeouts, memoria) |

---

## Comandos de Desarrollo

```bash
npm run dev      # Servidor de desarrollo (localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # ESLint
```

---

## Variables de Entorno

Definidas en `.env.local` (no versionado). Template en `.env.example`:
- `GOOGLE_AI_API_KEY` — Gemini API key
- `BBM_API_KEYS` — Keys de producción (formato `label:key`)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — Logging
- `BBM_COOKIE_SECRET` — Secreto HMAC para cookies del demo gate
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Gmail SMTP

---

## Testing

No hay framework de tests configurado. Cuando se agregue, documentar aquí.

---

## Reglas Contextuales

| Rule | Archivo | Aplica a |
|------|---------|----------|
| Seguridad API | `.claude/rules/security.md` | Endpoints, auth, input validation |
| Supabase | `.claude/rules/supabase.md` | Queries, RLS, migraciones |
| Frontend | `.claude/rules/frontend.md` | Componentes React, UI, accesibilidad |

---

## Protocolo de Sesión

1. Leer `.claude/STATUS.md` para contexto
2. Leer commands y rules en `.claude/`
3. Posicionarse en branch limpio, crear branch de sesión
4. Al terminar: `/cierre`
5. Todo PR pasa por review de AI (`/review`)
6. Todo spec con plan se audita (`/audit`) antes de implementar
