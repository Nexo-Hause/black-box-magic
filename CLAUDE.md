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
| `spec/02-reference-comparison.md` | Comparación contra Planograma (Producción Beta) | **En implementación** — Fase 0+1 en `main`; Fase 2-3 en progreso. Ver `docs/roadmap-2026-05.md`. § WS-D cierra C11/O1/O3/O4/design-system |
| `spec/03-ws1-pipeline-bullmq.md` | WS1 — pipeline compartido + worker BullMQ | **Implementado** — Pipeline BullMQ y observabilidad Express Bull Board |
| `spec/04-ws-mt-multitenant.md` | WS-MT — fundación multi-tenant (3 roles, scoping) | **Implementado** — Tablas canónicas, 3 roles y helper `scopedQuery` |
| `spec/05-ws-h-hardening.md` | WS-H — endurecimiento de producción | **Implementado** — Clasificador de errores Gemini, retries inteligentes y reconciliación |
| `spec/02-ws2-dashboard.md` | WS2 — dashboard FOTL tenant-scoped | **Escrita + auditada** — pendiente ejecución |
| `spec/02-ws3-export.md` | WS3 — export Excel tenant-scoped | **Escrita + auditada** — pendiente ejecución |
| `docs/tenancy-model.md` | Modelo de tenencia formal (entrada de WS-MT) | Diseño cerrado |

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

Siempre **español mexicano**, forma "tú" (no "vos"). Aplica a chat, comentarios que yo escribo, commits, specs, PRs.

- Verbos: dime/dices, tienes, puedes, haces, mira, cuéntame, verificas (NO decime/decís, tenés, podés, hacés, mirá, contame, verificás)
- Evitar rioplatense: vos, che, boludo, dale, chévere, bacán, copado
- Aceptable mexicano: ahorita, órale, sale, va, checar, platicar; "aquí" sobre "acá"; "güey" solo si Gonzalo lo usa primero
- No aplica a: comentarios pre-existentes, código/docs en inglés de fuentes externas, identificadores

---

## Debugging & Fixes

Ante cualquier bug, test que falla, error 500, stack trace o comportamiento inesperado que NO sea un typo trivial de una línea: invocar el agente `depurador` (automático, avisando en una línea — "voy con el depurador"). Diagnostica la causa raíz y escribe el test que reproduce; NO aplica el fix (eso se revisa y aplica aparte).

Prohibido el fix inline sin causa raíz verificada con evidencia. Si te descubres alcanzando un parche del síntoma (CHECK constraint, try/catch que traga el error, subir un timeout para que "deje de fallar"), detente y usa el depurador.

---

## "Hacer la tarea"

Antes de proponer implementación/solución/enfoque: investigar a fondo (docs oficiales, foros, código de referencia). La pregunta es "¿cuál es la mejor forma?", no "¿funciona?". Si Gonzalo tiene que cuestionar mi enfoque y había uno mejor, no hice la tarea. Iteración por aprender = normal; iteración por negligencia = inaceptable. Aplica a código, arquitectura, seguridad, herramientas, config.

---

## Regla anti-ambigüedad

Ante ambigüedad: **decido, dejo la DEC escrita (revisable) y sigo.** Pregunto sólo si las dos lecturas dan trabajo materialmente distinto Y caro de rehacer. Datos que el usuario debe ver → dónde y cómo los verá se declara en la spec, no se pregunta antes. Un dato que NO tengo no es ambigüedad: se busca o se pregunta (§Anti-fabricación). *(Gonzalo, 2026-09-18: fuera los barandales del 4.6.)*

⛔ SUPERSEDED 2026-09-18: «ante cualquier ambigüedad, PREGUNTAR antes de asumir; confirmar dónde verá los datos antes de implementar» — barandal del 4.6.

---

## UX-First

Features visibles al usuario: el flujo paso a paso desde la perspectiva del usuario **va en la spec** y se implementa — sin ronda de confirmación previa. Copys que cambian el sentido se publican marcados `PENDIENTE DE SIGN-OFF`; Gonzalo firma por lote. Backend/infra: verificar que no rompe UI existente (contratos, tipos, tests). *(Gonzalo, 2026-09-18: fuera los barandales del 4.6.)*

⛔ SUPERSEDED 2026-09-18: «(1) describir flujo, (2) confirmar con Gonzalo, (3) entonces escribir código» — el paso (2) era barandal del 4.6.

---

## Trabajo en fases paralelas

Todo trabajo no-trivial se divide en fases. Cada fase lanza agentes en paralelo para tareas independientes. Flujo: Planificar → Lanzar paralelo → Evaluar coherencia → Corregir (directo si menor, relanzar si mayor) → Siguiente fase cuando la actual esté sólida. Ejecutar secuencialmente sin dependencias es incorrecto.

---

## Mergear, deployar, migrar y borrar ramas — por criterio, con disciplina

Con las condiciones del repo cumplidas — **CI verde real** (tras `gh pr ready`, no el de un draft) **+ review dispuesto** (`LISTO`, `rules/review.md`) — **mergeo, deployo, migro y borro ramas por criterio propio**, sin pedir permiso. Disciplina, siempre: listar qué se afecta → snapshot si hay datos → ejecutar → mostrar output. Un PR listo de una sesión anterior se **aterriza** con esas mismas condiciones, no se reporta a esperar. *(Gonzalo, 2026-09-18: fuera los barandales del 4.6.)*

⛔ **REGLA VIVA — NUNCA push directo a `main`/`master`: entra sólo por PR.** No es barandal del 4.6, es lo que hace que todo lo demás (review, CI, squash) exista. El ruleset de GitHub (DEXO lo tiene) y el hook `guard-main-branch` (Write/Edit en main + `git push` hacia main/master por Bash, desde 2026-09-18) son **refuerzo, no sustituto**: `claude-config` no tenía protección de rama (medido 2026-09-18: `branches/main/protection` → 404, rulesets `[]`) y la regla tiene que sostenerse sola.

**Lo que SÍ sube a Gonzalo — es NEGOCIO suyo, no mecánica:** decisiones de producto, dinero (planes, add-ons, compras), correos al despacho o al cliente, copys que cambian el sentido (se publican `PENDIENTE DE SIGN-OFF`, firma por lote).

⛔ SUPERSEDED 2026-09-18: «NUNCA mergear PRs (merge = deploy) · NUNCA deploy / delete branches / modificar DB prod · PR listo de sesión anterior → reportar y esperar» — barandales del 4.6. El «NUNCA push a main» de esa misma lista NO se supersede: sigue vivo arriba (fix tras revisión 2026-09-18: apoyarlo sólo en GitHub/hook lo dejaba sin guarda en repos sin protección).

---

## Rama nueva por sesión (siempre)

Toda sesión de trabajo empieza en una **rama nueva** desde `main`/`master` actualizado. **Nunca reutilizar la rama de una sesión anterior**, aunque su PR ya se haya mergeado.

- **Por qué:** el repo mergea por squash, así que ramificar de una rama ya mergeada garantiza conflicto. *(Razón histórica secundaria, ya NO vigente desde 2026-08-11: reutilizar la rama dejaba a GitHub sin emitir el evento `pull_request` y el AI review no se disparaba — incidente sesión 9. Ahora el review es local y no depende de ningún evento.)*
- **Cómo:** al arrancar (o en `/cierre`), `git switch -c <tipo>/<fecha>-<slug>` desde `main`/`master` recién traído. El nombre identifica la sesión, no se recicla.

---

## Infraestructura operativa de Gonzalo — acceso sin fricción

Los VPS de Gonzalo (Hetzner) son su **entorno de trabajo diario**: ahí corren sus agentes y sus pipelines. **Cada proyecto tiene el suyo**; cuál es, lo dice la línea **VPS del proyecto:** del `CLAUDE.md` de cada repo, fuera de este bloque. NO es "producción de cliente intocable". Entrar a operarlo es rutina, no excepción — tratarlo como excepcional convierte a Claude en cuello de botella de la propia infra de Gonzalo.

- **Sin fricción** (sin checkpoint ni pedir OK cada vez): SSH, lectura, health checks, logs, inspeccionar/operar/reiniciar agentes y servicios. Conectarse al VPS es operación normal.
- **Con red de seguridad** (listar → snapshot → ejecutar → mostrar, ver "Auditar antes de destruir"; sin esperar OK): solo lo destructivo dentro del VPS — borrar datos, `DROP`/`DELETE`/`TRUNCATE`, `rm -rf`, `prune`, `reset --hard`, tumbar servicios en uso.
- **Cómo conectarse:** el VPS, su alias SSH y el permiso pre-registrado los nombra el `CLAUDE.md` de cada repo. **Nunca asumir que dos proyectos comparten máquina.** La auth la resuelve el SSH agent de 1Password. No inferir/fabricar IP ni alias — tomarlos del `CLAUDE.md` del repo.
- **El bloqueo del classifier de Anthropic NO es regla nuestra** y no se apaga editando archivos. Bloquea SSH-root-a-prod si el destino no lo nombró el usuario o no hay permiso pre-registrado. Vías: (a) Gonzalo pega el comando con la IP, o (b) `Bash(ssh:*)` pre-registrado en el `settings.local.json` (local, **NO se sincroniza por `/sync`**) del repo de operación — ya presente en repos de Nexo/Minime, por eso ahí fluye. **En `claude-config` NO se registra ese permiso:** operar Nexo va desde sus propios repos; aquí el SSH es circunstancial (p.ej. validar la memoria) y por eso requiere que Gonzalo nombre el destino en el momento.
- **Anti-patrón (incidente sesión 8, costó horas):** ante "conéctate al VPS", NO cazar credenciales ni intentar editar permisos uno mismo (el harness lo bloquea como auto-bypass y escala restricciones). **Primera acción:** usar el permiso si el repo lo tiene; si no, pedir a Gonzalo el comando con la IP. Nada más.

---

## Costos y prerequisitos

Al recomendar activar servicio/feature/add-on, SIEMPRE especificar: (1) costo adicional y cuánto, (2) prerequisitos (ej: upgrade de plan), (3) si NO está incluido en el plan actual. Nunca "solo activa X" sin contexto de costo.

---

## Organizar por workstream

Planes organizados por **workstream completo** (un tema de principio a fin), NO por tipo de actividad. Cada workstream incluye su validación, corrección y cierre. Un workstream se cierra antes de abrir otro. Items "diferidos" se resuelven: cerrar, absorber, o diferir con razón documentada.

---

## Todo al repo, nada local

Specs, investigaciones, planes, decisiones → commiteados al repo. Nunca en rutas locales/temporales/fuera del repo. Razón: Gonzalo trabaja desde múltiples máquinas; si no está en el repo, se pierde.

Destinos: specs → `/spec/` o `.claude/tasks/`; estado → `.claude/STATUS.md`; decisiones → STATUS.md o el spec correspondiente; análisis → `docs/`.

---

## Post-plan → audit automático

Todo spec/plan con fases de implementación se audita antes de implementar. No empezar a escribir código sin auditar el plan. Command `/audit` existe para esto.

---

## Specs son de la tarea, no de la delegación

Cuando escribo un spec en `.claude/tasks/`:

- **Idioma:** inglés técnico. La spec la ejecuta un modelo — inglés es denso semánticamente y consistente con los identificadores del código.
- **SÍ incluir:** context, goal, files to touch, exact changes (before/after), objective acceptance criteria, verification commands, commit message.
- **NO incluir** lenguaje de proceso de delegación («delegar a <modelo>», «modelo sugerido», «reportá al terminar», «NO confiar en self-report») ni comandos `claude -p --bare …` en el chat. El spec se lee como instrucción técnica neutra; que se delegue es detalle operativo.

---

## Definición de terminado

Nada está "hecho" hasta que el usuario lo puede ver y usar. Tres requisitos:

- **Visibilidad** — ¿Todo dato generado tiene ruta visible en la UI?
- **Feedback** — ¿El usuario ve errores, progreso y resultados?
- **Tests** — ¿Hay al menos un test que verifica la experiencia del usuario?

Si alguna respuesta es NO, la feature no está terminada.

---

## Memoria y archivos de estado: densidad

El costo de contexto de STATUS/MEMORY/CLAUDE.md se paga en CADA sesión; el peso muerto y las entradas stale son deuda que se cobra sola. Reglas:

- **Memoria (MEMORY.md / vault) guarda decisiones estables y lecciones, NUNCA snapshots de progreso.** Test antes de escribir: ¿esto seguirá cierto en 2 semanas? Si no, es STATUS.md, no memoria. "En qué fase va X" es siempre STATUS.
- **STATUS.md = solo secciones vivas.** Sección cerrada/superseded → se BORRA en el mismo cierre — git es la traza (`git log -p`); no hay archivo de historia. Si STATUS pasa de ~15 KB, algo sobra.
- **Decisiones firmes van al registro canónico (DECISIONS.md o equivalente), no solo a la bitácora.** Y si supersede una anterior, la vieja se retro-marca `SUPERSEDED por <ref>` en ese momento — una decisión vieja sin marcar es una mentira activa.
- **Memoria que quedó falsa se corrige al detectarla**, no "después". Aplica también al declarar algo resuelto: buscar qué memoria/doc lo daba por pendiente y actualizarlo.

- **Estos archivos son para MÍ, no para un lector humano → densidad semántica máxima, cero prosa.** (Gonzalo, 2026-08-05.) Aplica a `STATUS.md`, `MEMORY.md`/vault, `DECISIONS.md`, `CLAUDE.md` y equivalentes: telegrama, no párrafo; símbolos y abreviaturas (`→`, `×`, `·`), cifras desnudas, rutas literales, punteros al detalle. **Test:** si una frase se puede borrar sin perder un hecho, un número o un puntero, sobra. La prosa explicativa va al chat o a `docs/`.

(Razón histórica 2026-07-07: la primera auditoría de densidad encontró STATUS con 83% de peso muerto, 2 precios superseded sin marcar en DECISIONS y 4 memorias factualmente vencidas.)

---

## Anti-fabricación

Cuando no tengo la información, pregunto. No invento constantes, umbrales, clasificaciones, criterios de aceptación, reglas de negocio.

**Señales de que estoy por fabricar:** "un valor razonable sería…", "voy a usar X como default" sin fuente, completar tabla con valores que "suenan bien", asumir que una regla sigue el patrón común.

**En su lugar:** buscar rubric/spec/doc en el repo (`grep`, `find`); si no existe, preguntar ("no encuentro la fuente de X, ¿tienes el valor o confirmamos uno?"). Preferir "no sé, necesito que me confirmes Y" a inventar algo plausible.

Razón histórica: Claude inventó reglas y tolerancias que desperdiciaron horas de trabajo.

---

## Verificación obligatoria

Antes de declarar "listo/funciona/pasa/completado", corro el comando de verificación en esta sesión y muestro el output. Si no lo corrí aquí, no puedo afirmar que pasa.

**Qué cuenta como evidencia:** tests con conteo (`34/34 pass`), build con exit 0, bug reproducido y luego no-reproducido, URL del PR, output de `gh pr merge`, log de deploy, output de migrate + verificación de schema, `git diff HEAD~1` revisado contra spec para agentes delegados.

**Señales de declarar sin verificar:** "debería funcionar", "tiene buena pinta", "perfecto/listo/ya quedó" antes de correr el comando, confiar en self-report de Alibaba sin leer diff, extrapolar ("el lint pasó → compila"), "hace rato pasaba, asumo que sigue igual".

Skill `verification` tiene el checklist completo. Aplica a TODA tarea, no solo features.

---

## Auditar antes de destruir

Operación destructiva: (1) listar qué se afecta concretamente, (2) snapshot si son datos (respaldo de tabla, volumen, imagen o rama), (3) EJECUTAR, (4) mostrar output. **Sin esperar confirmación**: la red es el snapshot y la lista, no el permiso. Nunca asumir "es seguro". *(Gonzalo, 2026-09-18: fuera los barandales del 4.6.)*

**Destructivas:** `docker prune`/`rm`, `git reset --hard`/`push --force`/`clean -fd`, `rm -rf` sobre directorios, `DROP TABLE`/`DELETE FROM`/`TRUNCATE`, eliminar branches, cerrar PRs, revertir commits publicados, desinstalar dependencias.

**Verificaciones previas típicas:** `docker ps -a` antes de prune, `git log --oneline` antes de reset, `SELECT COUNT(*) WHERE ...` antes de DELETE, `gh pr view <rama> --json state` = `MERGED` antes de borrar una rama.

**Señales de saltarme el flujo:** "es solo prune, no pasa nada", "la tabla está vacía, igual borro", "el branch ya se mergeó" sin haberlo preguntado a `gh`, "esto lo hago rápido mientras limpio".

Origen de la disciplina de snapshot: un `docker image prune -a` destruyó la imagen activa de un bot en producción — por eso se lista y se respalda ANTES; no por eso se pide permiso.

⛔ SUPERSEDED 2026-09-18: «(2) mostrar a Gonzalo, (3) esperar confirmación explícita» — barandal del 4.6; la lista y el snapshot se quedan.

---

## Checkpoint antes de ejecución

Checkpoint **informativo: se imprime y se sigue, sin esperar respuesta.** Cuándo, si la tarea cumple CUALQUIERA: (1) batch >10 items, (2) filtra dataset con criterios, (3) pipeline multi-paso, (4) >30 min o APIs de pago / procesamiento irreversible.

Checkpoint: **Qué** (acción concreta), **Cuánto** (items), **Criterio** (por qué esos), **Destino** (dónde van los resultados).

**Se espera SÓLO si hay dinero real no presupuestado** (API de pago fuera del plan, add-on, compra) — eso es §Costos y prerequisitos, no mecánica.

No aplica a fixes puntuales, edición de archivos individuales, commits, PRs, ni tareas con scope obvio y costo bajo de rehacer. *(Gonzalo, 2026-09-18: fuera los barandales del 4.6.)*

⛔ SUPERSEDED 2026-09-18: el checkpoint como parada a esperar el OK — barandal del 4.6.

---

## Entorno Windows + Git Bash (MSYS)

Paths distintos: MSYS `/c/Users/gleon/...`, Windows/Node.js `C:\Users\gleon\...`.

- Comandos Bash → paths MSYS (`/c/...`)
- Paths a Node.js → Windows (`C:\\...`) o dejar que Node resuelva con `path.resolve()`
- `process.cwd()` devuelve Windows aunque el shell sea MSYS — no asumir formato
- SFTP/SCP a Linux → paths Linux (`/home/...`), no Windows ni MSYS
- Si un script falla con "file not found", verificar formato de path primero
- NUNCA reescribir archivos UTF-8 existentes con `Get-Content`/`Set-Content` de PowerShell 5.1: sin BOM los decodifica como ANSI y corrompe acentos (mojibake). Editar con el Edit tool o con node; verificar después con grep de `Ã` (incidente 2026-06-09, delegation.md)

---

## Memoria compartida entre superficies de Claude

Capa **adicional** de contexto universal de Claude: un repo externo de memoria al cual cualquier superficie acude (Claude Code CLI/web, Nexo en Telegram, agentes futuros). Es la memoria **de Claude** — Nexo es un cliente más, no su dueño. Los datos viven en **Supabase** (hoy provisional en la cuenta Nexo-Hause, a migrar a una cuenta neutral); el **motor** MCP `memoria` corre en el VPS de Nexo/Arthur (puerto 8767). Diseño: `docs/arquitectura-memoria-compartida.md`.

**No reemplaza nada.** Cada proyecto sigue trabajando con su flujo de archivos como hasta ahora — `STATUS.md`, handoff, session logs, contexto por repo —, y eso **siempre** se lee al inicio (vía `resume-session`). La memoria compartida **suma** una vista cross-proyecto; no sustituye el flujo de cada repo.

- **Cuándo acudir a ella:** es un **recurso al cual acudir cuando haga falta, no algo a evitar** — cuando el contexto del repo no alcanza, el tema cruza proyectos, o Gonzalo lo pide. No se vuelca entera al inicio (sería ruido), pero consultarla con `memoria_buscar` (scoped) es barato y vale cuando aporta.
- **Escritura: automática al `/cierre`** (el recuento de la sesión). No a mitad de sesión salvo que se pida.
- **Scoping (anti fuga cross-cliente):** scoped-by-default a `personal,proceso` + el `cliente:<uuid>` del repo activo (marcador `<!-- memoria-scope: ... -->` en su `CLAUDE.md`). Nunca devolver memoria de otro cliente sin pedido explícito.
- **Manual:** `/memoria buscar|list|stats|olvida|corrige`, o lenguaje natural.

Si el MCP `memoria` no está conectado, estas operaciones se saltan y se nota en una línea.
<!-- REGLAS-GLOBALES-END -->

## Secretos — NUNCA exponer

- **NUNCA leer `.env.local`, `.env`, ni archivos `.env*` con datos reales.** Usar `.env.example` para ver qué variables existen.
- **NUNCA mostrar valores de secretos** en respuestas, comandos, argumentos, logs ni archivos temporales.
- **Para configurar variables en servicios:** escribir scripts que lean internamente sin exponer valores en stdout.
- **Si se expone un secreto por error:** rotarlo inmediatamente, no "recomendar" que el usuario lo haga.

> **Lección (sesión 17):** un `view_file` de `.env.local` expuso todas las credenciales del proyecto. Se rotaron `BBM_COOKIE_SECRET` and `BBM_API_KEYS`. Los tokens de terceros quedaron pendientes de rotación manual. Ver `.claude/rules/security.md` § Manejo de Secretos por Agentes IA.
> **Lección (sesión 18):** El archivo `cierre.md` en la raíz del proyecto (CRMD) es un skill estático con instrucciones y NUNCA debe ser modificado por agentes IA. El estado del proyecto y el handoff solo se actualizan en `.claude/STATUS.md` y `.claude/SESSION_LOG.md`.
