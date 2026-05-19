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
│   │   ├── admin/            # Admin endpoints (Bearer auth + cookie admin)
│   │   │   ├── gate/         # Admin gate (login, check, logout — cookie bbm_admin)
│   │   │   └── onboarding-code/ # Generar códigos de onboarding
│   │   ├── gate/             # Email gate (registro + check + logout)
│   │   ├── onboarding/       # Engine v3 onboarding endpoints
│   │   │   ├── session/      # Crear sesión (code exchange → JWT)
│   │   │   ├── chat/         # Chat con Gemini (function calling)
│   │   │   ├── synthesize/   # Síntesis de ClientConfig (Gemini Pro)
│   │   │   ├── test/         # Test de fotos con config candidato
│   │   │   ├── deploy/       # Activar config (testing → active)
│   │   │   └── voice/        # Token efímero para Live API (voz)
│   │   ├── ubiqo/            # Pipeline Ubiqo Evidence (Bearer auth, cron-driven)
│   │   │   ├── ingest/       # Discover capturas → registrar fotos pending
│   │   │   ├── process/      # Procesar 1 foto (download → analyze → store)
│   │   │   ├── results/      # Query resultados con filtros
│   │   │   └── status/       # Observabilidad (conteos, alertas)
│   │   └── health/           # Status + documentación
│   ├── admin/                # UI admin (generar links de onboarding)
│   ├── demo/                 # UI demo (upload, batch, exports)
│   ├── onboarding/           # UI onboarding (chat, review, test, voz)
│   └── page.tsx              # Landing page
├── lib/
│   ├── analyze.ts            # Función reutilizable de análisis 2-pasadas (extraída de /api/analyze)
│   ├── auth.ts               # Bearer token auth (producción, timing-safe)
│   ├── cookie.ts             # HMAC-signed email cookie (demo)
│   ├── gemini.ts             # Cliente Gemini Vision (2 modelos, fallback)
│   ├── gemini-chat.ts        # Cliente Gemini texto + function calling
│   ├── prompts.ts            # Motor de prompt híbrido v2 (legacy, 2 pasadas)
│   ├── ubiqo/                # Integración Ubiqo Evidence
│   │   ├── client.ts         # API client (fetchCaptures, buildPhotoUrl, extractPhotos)
│   │   ├── types.ts          # Interfaces TS + Zod schemas del API real
│   │   └── ssrf.ts           # Descarga de fotos con protección SSRF
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
| `src/lib/analyze.ts` | Función reutilizable de análisis 2-pasadas |
| `src/lib/ubiqo/client.ts` | Cliente API Ubiqo Evidence (fetch, URL build, photo extract) |
| `src/lib/ubiqo/types.ts` | Interfaces + Zod schemas del API real de Ubiqo |
| `src/lib/ubiqo/ssrf.ts` | Descarga de fotos con protección SSRF |
| `src/app/api/ubiqo/ingest/route.ts` | Discover capturas Ubiqo → registrar pending |
| `src/app/api/ubiqo/process/route.ts` | Procesar 1 foto pending (download → analyze → store) |
| `src/app/api/ubiqo/results/route.ts` | Query resultados con filtros |
| `src/app/api/ubiqo/status/route.ts` | Observabilidad pipeline Ubiqo |
| `src/app/api/planogram/ingest/route.ts` | Discover capturas → crear incidencias pending |
| `src/app/api/planogram/process/route.ts` | Procesar 1 incidencia (compare vs planograma) |
| `src/app/api/planogram/webhook/route.ts` | Webhook Ubiqo (esqueleto, HMAC validation) |
| `supabase/migrations/008_create_bbm_ubiqo_captures.sql` | Tabla + stored procedures para pipeline Ubiqo |

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
- `UBIQO_API_TOKEN` — Bearer token para API Evidence (bi.ubiqo.net)
- `UBIQO_API_BASE` — Base URL del API (default: `https://bi.ubiqo.net`)
- `UBIQO_PHOTO_DOMAINS` — Allowlist de dominios para descarga de fotos (CloudFront)
- `UBIQO_QSR_CUSTOM_RULES` — Reglas custom para caso QSR (opcional)

---

## Testing

Runner: **Vitest** `^4.1.2`. Correr con `npm test` (`vitest run`) o `npm run test:watch`.

~165 tests en `src/**/__tests__/`: Engine v3 (config, prompt-builder, analyzer,
escalation), Ubiqo lib (client, ssrf, types), Onboarding (auth, synthesis, test-runner,
tools, live-session), y `analyze`/`auth`. Configuración en `vitest.config.ts`.

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
| `spec/00-ubiqo-integration.md` | Integración BBM × Ubiqo (Evidence/Gather) | **Implementado** — Fase 0+1 en `main` (PR #14). Webhook post-MVP |
| `spec/01-engine-v3.md` | Engine v3 — Motor multi-industria con onboarding conversacional | **Implementado** — Fases 0-4 (PRs #5-#6) |
| `spec/02-reference-comparison.md` | Comparación contra Planograma (Producción Beta) | **En implementación** — Fase 0+1 en `main`; Fase 2-3 + WS-MT/WS-H pendientes. Ver `docs/roadmap-2026-05.md` |

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

<!-- REGLAS-GLOBALES-START -->
## Idioma — español mexicano

Gonzalo está en México. Hablar **siempre en español mexicano**, usando conjugaciones de "tú" (no "vos"). Aplica a chat, comentarios de código que yo escribo, commit messages, specs que escribo para delegaciones, y PR descriptions.

**Conjugaciones correctas (forma tú):**
- dime, dices, dijo → no decime, decís
- tienes, tuviste → no tenés
- puedes, pudiste → no podés
- quieres, quisiste → no querés
- sabes, supiste → no sabés
- haces, hiciste → no hacés
- lees, leíste → no leés
- mira, mira → no mirá
- apruebas, aprobaste → no aprobás
- verificas, verificaste → no verificás
- cuéntame, fíjate, acuérdate → no contame, fijate, acordate

**Vocabulario a evitar (rioplatense):**
- "vos", "che", "pibe", "boludo", "dale" → nunca
- "chévere", "bacán", "copado" → no son mexicanos

**Vocabulario mexicano aceptable:**
- "ahorita", "órale", "sale", "va", "checar", "platicar"
- "aquí" es más común que "acá" (ambos existen, preferir el primero)
- "güey/wey" solo si Gonzalo lo usa primero

**No aplica a:**
- Comentarios de código que ya existen (no reescribirlos por idioma)
- Código/docs en inglés de fuentes externas
- Identificadores, nombres de variables, APIs

---

## "Hacer la tarea"

Antes de proponer cualquier implementación, solución o enfoque: investigar a fondo.
Documentación oficial, foros, Twitter, Reddit, código de referencia — lo que haga falta.

- Proponer la mejor opción, no la más fácil
- La pregunta no es "¿funciona?" sino "¿cuál es la mejor forma de hacerlo?"
- Si Gonzalo tiene que cuestionar mi enfoque y resulta que había uno mejor, no hice la tarea
- Iteración legítima (aprender cosas nuevas, ajustar al uso real) = normal
- Iteración por negligencia (no investigar, proponer lo primero que se me ocurre) = inaceptable
- Aplica a todo: código, arquitectura, seguridad, herramientas, configuración

---

## Regla anti-ambigüedad

Ante cualquier ambigüedad, PREGUNTAR antes de asumir. No interpretar la intención sin validarla. Cuando una instrucción pueda significar más de una cosa, detenerse y preguntar.

Si la tarea toca datos que el usuario debería ver, confirmar dónde y cómo los verá antes de implementar.

---

## UX-First

Para features visibles al usuario:
1. Describir el flujo paso a paso desde la perspectiva del usuario
2. Confirmar con Gonzalo si el flujo es correcto
3. Solo entonces escribir código

Para cambios backend/infraestructura: verificar que no rompen la UI existente (contratos de API, tipos, tests).

---

## Trabajo en fases paralelas

Todo trabajo no-trivial se divide en fases. Cada fase lanza agentes en paralelo para las tareas independientes.

1. **Planificar** — dividir en fases, identificar dependencias
2. **Lanzar** — agentes en paralelo para tareas independientes de la fase
3. **Evaluar** — revisar resultados, coherencia entre agentes
4. **Corregir** — arreglar directamente si es menor, relanzar si es mayor
5. **Siguiente fase** — solo cuando la actual está sólida

Ejecutar todo secuencialmente cuando no hay dependencias es incorrecto.

---

## Acciones que NUNCA tomar sin autorización

- NUNCA mergear PRs (merge = deploy a producción)
- NUNCA push a main/master
- NUNCA acciones que afecten producción (deploy, delete branches, modificar DB prod)
- PR listo de sesión anterior → reportar estado y esperar instrucciones, no actuar

---

## Costos y prerequisitos

Cuando recomiende activar un servicio, feature o add-on, SIEMPRE especificar:
1. Si tiene costo adicional y cuánto
2. Si tiene prerequisitos (ej: upgrade de plan)
3. Si NO está incluido en el plan actual

Nunca usar frases como "solo activa X" sin contexto de costo.

---

## Organizar por workstream

Cuando arme planes de trabajo, organizar por **workstream completo** (un tema de principio a fin), NO por tipo de actividad (validar → corregir → completar).

- Cada workstream incluye su propia validación, corrección y cierre
- Un workstream se cierra completamente antes de abrir otro
- Items "diferidos" se resuelven: cerrar, absorber en un workstream, o diferir con razón documentada

---

## Todo al repo, nada local

Specs, investigaciones, planes, documentos de análisis, decisiones — todo va commiteado al repo del proyecto. Nunca guardar artefactos de trabajo en rutas locales, temporales, o fuera del repo.

- Specs → `/spec/`
- Estado del proyecto → `.claude/STATUS.md`
- Decisiones → en el repo (STATUS.md, DECISIONS_ARCHIVE.md, o el spec correspondiente)
- Investigaciones y análisis → como archivo en el repo (en `docs/`, `spec/`, o donde corresponda)

Razón: Gonzalo trabaja desde múltiples máquinas. Si no está en el repo, se pierde.

---

## Post-plan → audit automático

Todo spec o plan con fases de implementación se audita antes de implementar. No empezar a escribir código sin haber auditado el plan. El command `/audit` existe para esto.

---

## Definición de terminado

Nada está "hecho" hasta que el usuario lo puede ver y usar.

| Requisito | Pregunta |
|-----------|----------|
| **Visibilidad** | ¿Todo dato generado tiene ruta visible en la UI? |
| **Feedback** | ¿El usuario ve errores, progreso y resultados? |
| **Tests** | ¿Hay al menos un test que verifica la experiencia del usuario? |

Si la respuesta a cualquiera es NO, la feature no está terminada.

---

## Anti-fabricación

**La regla:** cuando no tengo la información, pregunto. No invento datos, umbrales, clasificaciones, tolerancias, ni reglas de negocio.

**Aplica especialmente a:**
- Constantes numéricas (límites, tolerancias, timeouts)
- Reglas de clasificación (categorías, rubrics, puntuación)
- Criterios de aceptación
- Umbrales de validación

**Señales de que estoy por fabricar:**
- "Un valor razonable sería..." sin referencia
- "Voy a usar X como default" sin fuente
- Completar una tabla con valores que "suenan bien"
- Asumir que una regla sigue el patrón común sin verificarlo

**Qué hacer en su lugar:**
- Buscar rubric, spec, o doc de referencia en el repo (`grep`, `find`)
- Si existe, usarlo literal
- Si no existe, preguntar a Gonzalo: *"No encuentro la fuente para X. ¿Tienes el valor o confirmamos uno?"*
- Preferir *"no sé, necesito que me confirmes Y"* sobre inventar algo que parezca correcto

**Razón:** en proyectos anteriores, Claude inventó reglas de clasificación y tolerancias que desperdiciaron horas de trabajo.

---

## Verificación obligatoria

**La regla:** antes de declarar algo como "listo", "funciona", "pasa" o cualquier variación de éxito, corro el comando de verificación en esta sesión y muestro el output. Si no lo corrí en esta sesión, no puedo afirmar que pasa.

**Qué cuenta como evidencia:**
| Claim | Evidencia que lo prueba |
|---|---|
| Tests pasan | Output del test suite con conteo (ej. `34/34 pass`) |
| Build compila | Build command con exit 0 |
| Bug arreglado | Reproducir el caso original y confirmar que ya no ocurre |
| PR creado | URL del PR |
| PR mergeado | Output de `gh pr merge` o `gh pr view --json state` |
| Deploy exitoso | Link al log de deploy con status |
| Migración aplicada | Output del migrate tool + verificación de schema |
| Agente delegado terminó | `git diff HEAD~1 HEAD` revisado contra la spec |

**Señales de que estoy por declarar sin verificar:**
- Escribir "debería funcionar", "tiene buena pinta", "probablemente pasa"
- "Perfecto", "listo", "ya quedó" antes de haber corrido el comando
- Confiar en el reporte de Alibaba sin mirar el diff
- Extrapolar: "el lint pasó, entonces compila" (no necesariamente)
- "Hace rato pasaba, asumo que sigue igual"

**Apoyo:** la skill `verification` tiene el checklist completo con racionalizaciones típicas y cómo responder.

"Listo" sin prueba no es "listo". Aplica a TODA tarea, no solo features.

---

## Auditar antes de destruir

**La regla:** antes de cualquier operación destructiva, listo qué se va a afectar y confirmo con Gonzalo. Nunca asumo que "es seguro" sin verificar primero qué está activo o en uso.

**Operaciones que cuentan como destructivas:**
- `docker prune`, `docker rm` sobre contenedores/imágenes
- `git reset --hard`, `git push --force`, `git clean -fd`
- `rm -rf` sobre directorios
- `DROP TABLE`, `DELETE FROM`, `TRUNCATE`
- Eliminar branches, cerrar PRs, revertir commits publicados
- Desinstalar dependencias, remover servicios
- Cualquier acción que no se pueda deshacer con `Ctrl+Z` o un comando inverso trivial

**Flujo obligatorio:**

1. **Listar** qué se va a afectar concretamente
   - `docker ps -a` antes de `docker prune`
   - `git log --oneline` antes de `reset --hard`
   - `SELECT COUNT(*) WHERE ...` antes de `DELETE FROM`
2. **Mostrar** la lista a Gonzalo
3. **Esperar** confirmación explícita
4. **Ejecutar** y mostrar output

**Señales de que estoy por saltarme el flujo:**
- "Es solo prune, no debería pasar nada" → prune borra imágenes activas
- "La tabla está vacía, igual borro" → verifica primero
- "El branch ya está mergeado, seguro puedo borrarlo" → confirma con Gonzalo
- "Esto lo hago rápido mientras limpio" → las operaciones destructivas no se hacen "rápido"

**Razón:** en un proyecto anterior, un `docker image prune -a` destruyó la imagen activa de un bot en producción.

---

## Checkpoint antes de ejecución

Antes de ejecutar, mostrar un checkpoint cuando la tarea cumple CUALQUIERA de estas condiciones:

1. **Batch/volumen:** procesa más de ~10 items (archivos, registros, RFCs, etc.)
2. **Selección de datos:** filtra un dataset con criterios (fechas, umbrales, categorías)
3. **Pipeline multi-paso:** el resultado del paso 1 alimenta los pasos 2, 3, N
4. **Costo de re-hacer alto:** >30 min de ejecución, llamadas a APIs de pago, o procesamiento irreversible

El checkpoint debe incluir:
- **Qué:** acción concreta ("descargar y procesar con Faster-Whisper")
- **Cuánto:** cantidad de items ("847 archivos de 3,200 después de filtrar")
- **Criterio:** por qué esos y no otros ("≥5s de silencio, formato WAV")
- **Destino:** dónde van los resultados ("output/benchmark-run-03/")

No aplica a: fixes puntuales, edición de archivos individuales, commits, PRs, ni tareas donde el scope es obvio y el costo de re-hacer es bajo.

---

## Entorno Windows + Git Bash (MSYS)

Gonzalo trabaja en Windows con Git Bash. Esto causa conflictos de paths:

- **Git Bash (MSYS):** `/c/Users/gleon/Projects/...`
- **Windows/Node.js:** `C:\Users\gleon\Projects\...`

Reglas:
- Cuando ejecuto comandos Bash, usar paths MSYS (`/c/...`)
- Cuando paso paths a Node.js, usar paths Windows (`C:\\...`) o dejar que Node resuelva con `path.resolve()`
- `process.cwd()` en Node devuelve path Windows aunque el shell esté en MSYS — no asumir formato
- Para SFTP/SCP a servidores Linux, usar paths Linux (`/home/...`), no Windows ni MSYS
- Si un script falla con "file not found", verificar primero si es un conflicto de formato de path
<!-- REGLAS-GLOBALES-END -->
