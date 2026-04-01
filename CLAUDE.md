# Black Box Magic

API de análisis visual con IA para retail y QSR (Quick Service Restaurants). Recibe fotos de tiendas, restaurantes y puntos de venta, y retorna inteligencia estructurada en 7 facetas: inventario, shelf share, precios, compliance, condiciones, contexto y recomendaciones estratégicas.

---

## Arquitectura

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/          # API producción (Bearer token auth, legacy + engine v3)
│   │   ├── demo/             # Endpoints demo (cookie-gated)
│   │   │   ├── analyze/      # Análisis demo
│   │   │   └── email/        # Envío de reportes por email
│   │   ├── admin/            # Admin endpoints (Bearer auth)
│   │   │   └── onboarding-code/ # Generar códigos de onboarding
│   │   ├── gate/             # Email gate (registro + check + logout)
│   │   ├── onboarding/       # Engine v3 onboarding endpoints
│   │   │   ├── session/      # Crear sesión (code exchange → JWT)
│   │   │   ├── chat/         # Chat con Gemini (function calling)
│   │   │   ├── synthesize/   # Síntesis de ClientConfig (Gemini Pro)
│   │   │   ├── test/         # Test de fotos con config candidato
│   │   │   ├── deploy/       # Activar config (testing → active)
│   │   │   └── voice/        # Token efímero para Live API (voz)
│   │   └── health/           # Status + documentación
│   ├── demo/                 # UI demo (upload, batch, exports)
│   ├── onboarding/           # UI onboarding (chat, review, test, voz)
│   └── page.tsx              # Landing page
├── lib/
│   ├── auth.ts               # Bearer token auth (producción)
│   ├── cookie.ts             # HMAC-signed email cookie (demo)
│   ├── gemini.ts             # Cliente Gemini Vision (2 modelos, fallback)
│   ├── gemini-chat.ts        # Cliente Gemini texto + function calling
│   ├── prompts.ts            # Motor de prompt híbrido v2 (legacy, 2 pasadas)
│   ├── supabase.ts           # Cliente Supabase (logging)
│   ├── email.ts              # Composición y envío de emails
│   ├── exports/              # PDF, Excel, JSON, clipboard, WhatsApp, imagen anotada
│   ├── engine/               # Engine v3 — motor configurable
│   │   ├── config.ts         # ClientConfig Zod validation + CRUD
│   │   ├── prompt-builder.ts # Prompt dinámico desde config
│   │   ├── analyzer.ts       # Scoring server-side + orquestación
│   │   ├── escalation.ts     # Triggers estructurados
│   │   └── qsr-default-config.ts # Config QSR replicando legacy
│   └── onboarding/           # Módulos de onboarding
│       ├── auth.ts           # JWT (jose) + code exchange
│       ├── tools.ts          # Function calling tools + processing
│       ├── synthesis.ts      # Síntesis con Gemini Pro
│       ├── system-prompt.ts  # System prompt del chat
│       ├── live-session.ts   # Ephemeral tokens para Live API
│       └── test-runner.ts    # Test de fotos con config
├── types/
│   ├── analysis.ts           # Interfaces TypeScript del response (legacy)
│   ├── engine.ts             # ClientConfig, EngineV3Result, triggers
│   └── onboarding.ts         # Zod schemas para API de onboarding
└── hooks/
    ├── useEmailGate.ts       # Hook React para estado del gate
    ├── useOnboardingChat.ts  # State machine del onboarding (7 fases)
    └── useVoiceSession.ts    # WebSocket + audio para voz
```

---

## Tech Stack

| Tecnología | Uso | Versión |
|-----------|-----|---------|
| Next.js | Framework full-stack | 14.2.21 |
| TypeScript | Lenguaje (strict mode) | ^5 |
| React | UI | ^18 |
| Google Gemini API | Visión AI + chat + síntesis + voz | Flash Lite, Flash, Pro, Live |
| Zod | Validación de schemas | ^4.3.6 |
| jose | JWT sign/verify (onboarding auth) | latest |
| Vitest | Test runner | ^4.1.2 |
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
| Styling | CSS vars + globals.css | Tailwind CSS, CSS modules, styled-components |
| Auth (producción) | Bearer token (BBM_API_KEYS) | NextAuth, Clerk |
| Auth (demo) | Cookie HMAC-signed | — |
| Auth (onboarding) | JWT via jose + HKDF derivation | — |
| Test runner | Vitest | — |
| Schema validation | Zod v4 (`zod/v4`) | — |

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
| `src/lib/engine/config.ts` | Engine v3 — Zod schemas + CRUD de ClientConfig |
| `src/lib/engine/analyzer.ts` | Engine v3 — Scoring server-side + orquestación |
| `src/lib/engine/prompt-builder.ts` | Engine v3 — Prompt dinámico desde config |
| `src/lib/onboarding/auth.ts` | JWT auth para onboarding (jose + HKDF) |
| `src/lib/onboarding/synthesis.ts` | Síntesis de ClientConfig con Gemini Pro |
| `src/types/engine.ts` | Tipos del engine v3 (ClientConfig, EngineV3Result) |
| `src/hooks/useOnboardingChat.ts` | State machine del onboarding (7 fases) |
| `supabase/migrations/001_create_bbm_client_configs.sql` | Migración SQL (pendiente) |

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

## Specs

| Spec | Título | Estado |
|------|--------|--------|
| `spec/00-ubiqo-integration.md` | Integración BBM × Ubiqo (Evidence/Gather) | Aprobado, pendiente tokens |
| `spec/01-engine-v3.md` | Engine v3 — Motor multi-industria con onboarding conversacional | Auditado, PR #3 |

---

## Documentación

| Doc | Contenido |
|-----|-----------|
| `docs/guia-discovery-onboarding.md` | Guía de discovery/onboarding (32 preguntas, 5 fases, 3 capas de valor) |
| `docs/ubiqo/reunion-2026-03-26.md` | Transcripción reunión con Guillermo y Alberto |
| `docs/ubiqo/roadmap-franquicia-restaurantes.md` | Roadmap franquicia restaurantes con fases y pricing |
| `docs/ubiqo/analisis-clientes-evidence.md` | Análisis de 12 prospectos Evidence en 5 industrias |
| `docs/ubiqo/reunion-2026-03-30-retail.md` | Transcripción reunión con René y Carlos (retail, Fruit of the Loom) |
| `docs/ubiqo/resumen-reunion-2026-03-30-retail.md` | Resumen ejecutivo + análisis de la reunión del 30 marzo |

---

## Protocolo de Sesión

1. Leer `.claude/STATUS.md` para contexto
2. Leer commands y rules en `.claude/`
3. Posicionarse en branch limpio, crear branch de sesión
4. Al terminar: `/cierre`
5. Todo PR pasa por review de AI (`/review`)
6. Todo spec con plan se audita (`/audit`) antes de implementar

---

## Reglas de Trabajo

### "Hacer la tarea"

Antes de proponer cualquier implementación, solución o enfoque: investigar a fondo.
Documentación oficial, foros, Twitter, Reddit, código de referencia — lo que haga falta.

- Proponer la mejor opción, no la más fácil
- La pregunta no es "¿funciona?" sino "¿cuál es la mejor forma de hacerlo?"
- Si Gonzalo tiene que cuestionar mi enfoque y resulta que había uno mejor, no hice la tarea
- Iteración legítima (aprender cosas nuevas, ajustar al uso real) = normal
- Iteración por negligencia (no investigar, proponer lo primero que se me ocurre) = inaceptable
- Aplica a todo: código, arquitectura, seguridad, herramientas, configuración

### Regla anti-ambigüedad

Ante cualquier ambigüedad, PREGUNTAR antes de asumir. No interpretar la intención sin validarla. Cuando una instrucción pueda significar más de una cosa, detenerse y preguntar.

Si la tarea toca datos que el usuario debería ver, confirmar dónde y cómo los verá antes de implementar.

### UX-First

Para features visibles al usuario:
1. Describir el flujo paso a paso desde la perspectiva del usuario
2. Confirmar con Gonzalo si el flujo es correcto
3. Solo entonces escribir código

Para cambios backend/infraestructura: verificar que no rompen la UI existente (contratos de API, tipos, tests).

### Trabajo en fases paralelas

Todo trabajo no-trivial se divide en fases. Cada fase lanza agentes en paralelo para las tareas independientes.

1. **Planificar** — dividir en fases, identificar dependencias
2. **Lanzar** — agentes en paralelo para tareas independientes de la fase
3. **Evaluar** — revisar resultados, coherencia entre agentes
4. **Corregir** — arreglar directamente si es menor, relanzar si es mayor
5. **Siguiente fase** — solo cuando la actual está sólida

Ejecutar todo secuencialmente cuando no hay dependencias es incorrecto.

### Acciones que NUNCA tomar sin autorización

- NUNCA mergear PRs (merge = deploy a producción)
- NUNCA push a main/master
- NUNCA acciones que afecten producción (deploy, delete branches, modificar DB prod)
- PR listo de sesión anterior → reportar estado y esperar instrucciones, no actuar

### Costos y prerequisitos

Cuando recomiende activar un servicio, feature o add-on, SIEMPRE especificar:
1. Si tiene costo adicional y cuánto
2. Si tiene prerequisitos (ej: upgrade de plan)
3. Si NO está incluido en el plan actual

Nunca usar frases como "solo activa X" sin contexto de costo.

### Anti-fabricación

Nunca inventar datos, umbrales, clasificaciones, tolerancias, o reglas de negocio. Si no tengo la información, PREGUNTAR.

- Preferir "no sé, necesito que me confirmes X" a inventar algo que parezca correcto
- Si un rubric, spec, o documento de referencia existe, buscarlo y usarlo — no improvisar uno
- Aplica a: constantes numéricas, reglas de clasificación, criterios de aceptación, umbrales de validación
- Si la fuente de verdad no está en el código ni en los docs, preguntar a Gonzalo

### Verificación obligatoria

No declarar una tarea como terminada sin evidencia verificable.

- Si creé un PR → mostrar la URL
- Si mergeé → mostrar el output de `gh pr merge`
- Si deployé → mostrar el log de deploy
- Si ejecuté una migración → mostrar el resultado
- Si corrí tests → mostrar el resultado

"Listo" sin prueba no es "listo".

### Checkpoint antes de ejecución

Antes de ejecutar, mostrar un checkpoint cuando la tarea cumple CUALQUIERA de estas condiciones:

1. **Batch/volumen:** procesa más de ~10 items (archivos, registros, RFCs, etc.)
2. **Selección de datos:** filtra un dataset con criterios (fechas, umbrales, categorías)
3. **Pipeline multi-paso:** el resultado del paso 1 alimenta los pasos 2, 3, N
4. **Costo de re-hacer alto:** >30 min de ejecución, llamadas a APIs de pago, o procesamiento irreversible

El checkpoint debe incluir:
- **Qué:** acción concreta
- **Cuánto:** cantidad de items
- **Criterio:** por qué esos y no otros
- **Destino:** dónde van los resultados

No aplica a: fixes puntuales, edición de archivos individuales, commits, PRs, ni tareas donde el scope es obvio y el costo de re-hacer es bajo.

### Auditar antes de destruir

Antes de cualquier operación destructiva, listar qué se va a afectar y confirmar con Gonzalo.

Operaciones destructivas incluyen:
- `docker prune/rm`, `git reset --hard`, `git push --force`, `rm -rf`
- `DROP TABLE`, `DELETE FROM`, `TRUNCATE`
- Eliminar branches, cerrar PRs, revertir commits
- Cualquier acción que no se pueda deshacer fácilmente

Flujo: (1) listar qué se afecta → (2) mostrar a Gonzalo → (3) esperar confirmación → (4) ejecutar.
Nunca asumir que "es seguro" sin verificar primero qué está activo/en uso.
