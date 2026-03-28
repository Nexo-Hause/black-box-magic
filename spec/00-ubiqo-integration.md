# Spec 00 — Integración BBM x Ubiqo (Evidence/Gather)

**Fecha:** 2026-03-28
**Estado:** Auditado — aprobado con observaciones
**Autor:** Gonzalo León + Claude

---

## Objetivo

Integrar Black Box Magic como **capa de inteligencia visual** sobre Evidence/Gather de Ubiqo. Las fotos que los trabajadores de campo ya capturan en Evidence se procesan automáticamente con BBM, convirtiendo evidencia fotográfica pasiva en reportes accionables con scoring.

**Alcance:** POC técnico de integración + path a producción.

---

## Contexto de Negocio

- **12 prospectos** en los clientes de Evidence (ver `docs/ubiqo/analisis-clientes-evidence.md`)
- **Caso piloto:** Franquicia QSR (Guillermo) — demo exitoso 26-mar-2026
- **Clusters:** Retail/BTL, Franquicias multi-sucursal, Infraestructura, Servicios regulados

| Hoy (Evidence solo) | Mañana (Evidence + BBM) |
|---------------------|------------------------|
| Foto = prueba de presencia | Foto = fuente de inteligencia |
| Revisión manual | Análisis automático con scoring |
| Sin comparación entre sucursales | Ranking por tienda/zona/región |
| Sin detección de incumplimientos | Compliance automático vs reglas custom |

---

## Arquitectura

### Producción: Webhook asíncrono

```
Evidence captura foto → Ubiqo almacena → Webhook POST a BBM
                                          → BBM analiza (1 foto sync, ~30s)
                                          → Almacena resultado
                        Ubiqo consulta ← GET /results
```

**Por qué webhook:** Desacoplado (captura no depende de BBM), patrón estándar (Stripe, GitHub), desarrollo incremental para Ubiqo (ya tienen webhook de GPS).

### POC: Polling sobre API existente

Mientras Ubiqo implementa el webhook, el POC usa su REST API:

```
Cron externo (cada 5 min) → POST /api/ubiqo/ingest → GET bi.ubiqo.net/Capturas
                                                       → Registra fotos pendientes
Cron externo (cada 1 min) → POST /api/ubiqo/process → Toma 1 foto pending
                                                       → Descarga + analiza + almacena
```

---

## API de Ubiqo — Lo que existe hoy

Swagger: `bi.ubiqo.net/swagger/v1/swagger.json`

| # | Endpoint | Uso para BBM |
|---|----------|-------------|
| 1 | `GET /v1/Capturas/Rango/{formId}/{de}/{a}` | **Principal** — capturas estructuradas con fotos |
| 2 | `GET /v1/Capturas/Rango/Sabana/{formId}/{de}/{a}` | Tabla plana (Power BI) — backup |
| 3 | `GET /v1/Capturas/Grupo/Sabana/{formId}/{grupo}` | Por grupo UUID |

- **Auth:** `Authorization: Bearer {token}` (provisto por Ubiqo comercial)
- **Fechas:** `YYYYMMDDHHmmss` UTC. Siempre enviar `?tz=America/Mexico_City`.

### Estructura de una captura

```typescript
interface UbiqoCaptura {
  alias: string;                    // Nombre del trabajador
  username: string;                 // Usuario
  estatus: string;                  // "validado" | "pendiente" | "rechazado"
  grupo: string;                    // UUID del grupo de captura
  folioEvidence: string;            // Folio único
  fechaInicial: string;             // ISO 8601
  fechaSincronizacion: string;      // ISO 8601
  urlBase: string;                  // Base URL para media
  capturas: UbiqoCapturaBase[];     // Array de campos del formulario
}
```

### Cómo vienen las fotos

Campos con `idTipo: 2` (foto única) o `idTipo: 7` (galería):

```json
{
  "idTipo": 2,
  "fotografias": [
    {
      "url": "Capsulas/[uuid].jpeg",
      "descripcion": "Fachada principal",
      "latitud": 19.727,
      "longitud": -99.208,
      "tieneCoordenada": true
    }
  ],
  "fechaCaptura": "2026-03-28T15:30:00Z"
}
```

**URL completa** = `urlBase` + `fotografias[].url`

> **POR CONFIRMAR con Ubiqo:** Valor exacto de `urlBase`, si las URLs son públicas/temporales/auth-required.

---

## Prerequisites de Ubiqo

| # | Item | Gate |
|---|------|------|
| 1 | Bearer token para `bi.ubiqo.net` | **Bloqueante Fase 0** |
| 2 | Cuenta Evidence/Gather de prueba | Bloqueante Fase 0 |
| 3 | Confirmar `urlBase` de fotos | **Bloqueante Fase 0** |
| 4 | Confirmar si foto URLs requieren auth | **Bloqueante Fase 0** |
| 5 | Confirmar si token expira + mecanismo de refresh | Bloqueante Fase 1 |
| 6 | SLA: rate limits, retención de URLs | Bloqueante Fase 1 |
| 7 | Acordar formato de webhook (firma, payload, replay) | Bloqueante Fase 2 |

**Gate Criteria:** Fase 0 NO arranca sin #1, #3, #4 resueltos. Fase 1 NO arranca sin Fase 0 exitosa. Fase 2 NO arranca sin #7 acordado.

---

## Plan de Implementación

### Fase 0 — Validación del API (1-2 días)

**Gate de entrada:** Prerequisites #1, #3, #4 resueltos.

**Objetivo:** Confirmar que podemos obtener fotos del API y que BBM las analiza correctamente.

- [ ] Obtener Bearer token + cuenta Evidence de prueba
- [ ] Crear formulario QSR con campos: foto fachada, foto interior, foto cocina, foto baños, foto personal, notas
- [ ] Capturar 10-15 fotos de prueba con Evidence
- [ ] Llamar `GET /v1/Capturas/Rango/{formId}/{de}/{a}` y verificar estructura, URLs descargables, metadata GPS
- [ ] Descargar fotos y pasarlas por `POST /api/analyze`
- [ ] Verificar calidad del análisis con fotos reales

**Entregable:** Documentación del formato real del API + 10 análisis exitosos.

### Fase 1 — POC Polling (1 semana)

**Gate de entrada:** Fase 0 exitosa.

**Qué se construye:**

#### Refactors previos

1. **Extraer `src/lib/analyze.ts`** — Mover lógica de análisis 2-pasadas de `/api/analyze/route.ts` a función reutilizable:

```typescript
async function analyzePhoto(
  imageBase64: string,
  mimeType: string,
  customRules?: string
): Promise<{
  analysis: AnalysisData;
  conditionDetail?: ConditionDetail;
  meta: { model: string; tokens: TokenInfo; processing_time_ms: number; escalated: boolean };
}>
```

2. **Timing-safe auth** — Cambiar `===` por `crypto.timingSafeEqual()` en `src/lib/auth.ts` y `src/lib/cookie.ts`.

3. **Instalar `zod`** (MIT, ~13KB gzipped) para validación de inputs.

#### Endpoint 1: `POST /api/ubiqo/ingest` — Discover

Consulta API de Ubiqo, descubre nuevas capturas con fotos, las registra como pendientes.

```typescript
// Input (validado con Zod)
interface IngestRequest {
  form_id: string;       // /^[a-zA-Z0-9_-]+$/
  from: string;          // /^\d{14}$/ (YYYYMMDDHHmmss)
  to: string;            // /^\d{14}$/, from < to, rango max 7 días
  tz?: string;           // default: "America/Mexico_City"
}

// Flow
// 1. Validar input
// 2. GET bi.ubiqo.net/v1/Capturas/Rango/{form_id}/{from}/{to}?tz={tz}
// 3. Filtrar campos tipo foto (idTipo 2 o 7)
// 4. Deduplicar vs ya procesadas (por ubiqo_grupo + photo_path)
// 5. Registrar nuevas en Supabase con status = 'pending'
// 6. Retornar: { discovered: N, already_processed: M, pending: P }

// Si response vacío o sin fotos: retornar { discovered: 0 } con 200 (no es error)
```

**Config Vercel:** 30s timeout, 512MB (solo descubre, no analiza).

#### Endpoint 2: `POST /api/ubiqo/process` — Analyze

Toma 1 foto pendiente, la descarga, analiza y almacena resultado.

```typescript
// Input (opcional)
interface ProcessRequest {
  capture_id?: string;   // UUID específico, o toma el más antiguo pending
}

// Flow
// 1. Query atómico:
//    UPDATE bbm_ubiqo_captures SET status='processing', updated_at=NOW()
//    WHERE id = (SELECT id FROM bbm_ubiqo_captures
//                WHERE status='pending'
//                   OR (status='processing' AND updated_at < NOW() - INTERVAL '5 min')
//                ORDER BY created_at ASC LIMIT 1)
//    RETURNING *
// 2. Descargar foto (con protección SSRF — ver Seguridad)
// 3. Convertir a base64
// 4. analyzePhoto(base64, mimeType, customRules)
// 5. UPDATE: status='completed', analysis_result, score, severity, etc.
// 6. Si falla: status='failed', error_message. Retry: max 3 intentos (backoff 1s/2s/4s)
// 7. Retornar resultado
```

**Config Vercel:** 60s timeout, 1GB (consistente con `/api/analyze`).

**Recovery:** El query atómico del paso 1 resuelve dos problemas: concurrencia (dos crons no toman la misma foto) y status huérfano (processing > 5 min se reintenta).

#### Endpoint 3: `GET /api/ubiqo/results` — Query

```typescript
// Query params (todos opcionales)
interface ResultsQuery {
  form_id?: string;
  from?: string;               // ISO date
  to?: string;
  alias?: string;
  min_score?: number;
  max_score?: number;
  severity?: string;
  limit?: number;              // default 50, max 200
  offset?: number;
}

// Response
interface ResultsResponse {
  success: boolean;
  total: number;
  results: Array<{
    id: string;
    ubiqo_folio: string;
    ubiqo_alias: string;
    photo_url: string;
    photo_captured_at: string;
    photo_lat: number | null;
    photo_lon: number | null;
    execution_score: number | null;
    photo_type: string;
    severity: string;
    escalated: boolean;
    analysis: AnalysisData;
    condition_detail?: ConditionDetail;
    analyzed_at: string;
  }>;
}
```

**Config Vercel:** 10s timeout, 256MB.

#### Endpoint 4: `GET /api/ubiqo/status` — Observabilidad

```typescript
interface UbiqoStatusResponse {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  last_ingest_at: string | null;
  last_completed_at: string | null;
  alert: string | null;  // si failed > 5
}
```

**Config Vercel:** 10s timeout, 256MB.

#### Auth

Todos los endpoints usan Bearer token existente (`BBM_API_KEYS`). Key específico para Ubiqo: `BBM_API_KEYS="...,ubiqo:key-para-ubiqo"`.

#### Cron trigger

Servicio externo gratuito (cron-job.org, UptimeRobot, o GitHub Actions scheduled):
1. Cada 5 min → `POST /api/ubiqo/ingest` con Bearer token
2. Cada 1 min → `POST /api/ubiqo/process` con Bearer token

#### Custom rules (POC)

Las reglas de Guillermo (criterios por área: fachada, cocina, baños, personal) se almacenan como env var `UBIQO_QSR_CUSTOM_RULES` o constante en código. Se pasan como `customRules` a `analyzePhoto()`.

Para multi-tenant (12 clientes, reglas diferentes) → tabla `bbm_client_configs` que mapee `form_id → custom_rules`. Alcance de Fase 3.

#### Tareas de cierre Fase 1

- [ ] Actualizar CLAUDE.md con nuevos endpoints
- [ ] Actualizar `.env.example` con nuevas env vars
- [ ] Logging: cada ejecución de ingest/process se registra en `bbm_analysis_log` con `source: 'ubiqo'`

### Fase 2 — Webhook (2-3 semanas, post-validación POC)

**Gate de entrada:** POC validado + prerequisite #7 acordado con Ubiqo.

#### Endpoint: `POST /api/webhook/ubiqo`

```typescript
// Payload propuesto (a acordar con Ubiqo)
interface UbiqoWebhookPayload {
  event: "capture.created" | "capture.validated";
  form_id: string;
  grupo: string;
  folio: string;
  alias: string;
  username: string;
  photos: Array<{
    url: string;
    lat: number;
    lon: number;
    description: string;
    captured_at: string;
  }>;
  timestamp: string;
  // Firma va en header HTTP, NO en el body
}
```

#### Verificación de firma

Patrón estándar (Stripe, GitHub):

1. Firma en header: `X-Ubiqo-Signature: sha256=<hex_digest>`
2. Se firma el **raw body** (bytes exactos, no campo JSON)
3. HMAC-SHA256 con `UBIQO_WEBHOOK_SECRET` (min 32 chars)
4. Comparación con `crypto.timingSafeEqual()` — nunca `===`
5. Anti-replay: rechazar si `timestamp` > 5 minutos

```typescript
const signature = request.headers.get('X-Ubiqo-Signature');
const rawBody = await request.text();
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
const payload = JSON.parse(rawBody); // parsear DESPUÉS de verificar
const age = Date.now() - new Date(payload.timestamp).getTime();
if (age > 5 * 60 * 1000) {
  return NextResponse.json({ error: 'Webhook expired' }, { status: 401 });
}
```

#### Procesamiento síncrono

Vercel serverless **no soporta background processing** post-response. El webhook procesa dentro de 60s:

1. Verificar firma → Validar payload (Zod)
2. Registrar todas las fotos como `pending` en Supabase
3. Procesar **1 sola foto** sync (~30s peor caso con escalación)
4. Las demás quedan para el cron de `/api/ubiqo/process`
5. Responder 200 con resumen

**Escalamiento futuro:** Si el volumen crece, desacoplar con Inngest o QStash. El webhook solo registra y responde 200.

#### Callback opcional a Ubiqo

No construir hasta que Ubiqo confirme endpoint receptor.

```typescript
interface BBMCallbackPayload {
  ubiqo_grupo: string;
  ubiqo_folio: string;
  execution_score: number;
  severity: string;
  photo_type: string;
  analysis_summary: string;
  full_result_url: string;
  analyzed_at: string;
}
```

**Config Vercel:** 60s timeout, 1GB.

### Fase 3 — Dashboard y features de negocio

Fuera del alcance de esta spec. Ver `docs/ubiqo/roadmap-franquicia-restaurantes.md`:
- Scoring por sucursal (promedio ponderado de áreas)
- Comparación entre sucursales/franquiciatarios/zonas
- Validación de campañas vigentes
- Valor para el franquiciatario (benchmarking, badges)
- Tabla `bbm_client_configs` para multi-tenant

---

## Modelo de Datos

```sql
CREATE TABLE bbm_ubiqo_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers Ubiqo
  ubiqo_grupo UUID NOT NULL,
  ubiqo_folio TEXT,
  ubiqo_form_id TEXT NOT NULL,

  -- Metadata
  ubiqo_alias TEXT,
  ubiqo_username TEXT,
  ubiqo_estatus TEXT,

  -- Foto
  photo_path TEXT NOT NULL,                -- path relativo (estable para dedup)
  photo_url TEXT,                          -- URL completa (puede ser temporal)
  photo_lat DOUBLE PRECISION,
  photo_lon DOUBLE PRECISION,
  photo_description TEXT,
  photo_captured_at TIMESTAMPTZ,

  -- Estado de procesamiento
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  error_message TEXT,

  -- Análisis BBM (null hasta completed)
  analysis_result JSONB,
  execution_score INTEGER,                 -- 0-100, nullable si no evaluable
  photo_type TEXT,
  severity TEXT,
  escalated BOOLEAN DEFAULT FALSE,

  -- Metadata BBM
  model TEXT,
  tokens_total INTEGER,
  processing_time_ms INTEGER,

  -- Timestamps
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ubiqo_grupo, photo_path)
);

CREATE INDEX idx_ubiqo_captures_form ON bbm_ubiqo_captures(ubiqo_form_id);
CREATE INDEX idx_ubiqo_captures_status ON bbm_ubiqo_captures(status);
CREATE INDEX idx_ubiqo_captures_score ON bbm_ubiqo_captures(execution_score);
CREATE INDEX idx_ubiqo_captures_date ON bbm_ubiqo_captures(photo_captured_at);
CREATE INDEX idx_ubiqo_captures_alias ON bbm_ubiqo_captures(ubiqo_alias);
```

**Dedup:** Por `photo_path` (relativo, estable) no por `photo_url` (puede cambiar con signed URLs).

**Rollback:** `DROP TABLE IF EXISTS bbm_ubiqo_captures;`

**Política:** Fases 0-1 schema provisional (DROP+recrear OK, no hay datos prod). Fase 2+ migraciones aditivas.

---

## Seguridad

### Descarga de fotos — protección SSRF

1. **Allowlist de dominios:** Solo descargar de `UBIQO_PHOTO_DOMAINS`. Rechazar todo lo demás.
2. **Solo HTTPS.** Rechazar `http://`, `file://`, otros protocolos.
3. **Validar Content-Type:** Solo `image/*`.
4. **Validar tamaño:** Max 10MB.
5. **Redirects:** `redirect: 'manual'`, validar dominio destino contra allowlist antes de seguir.
6. **Timeout de descarga:** 10s por foto.

### Validación de inputs

Todos los inputs se validan con **Zod** antes de procesar:
- `form_id`: alfanumérico + guiones
- `from`/`to`: exactamente 14 dígitos, `from < to`, rango max 7 días
- Webhook payload: schema completo validado después de verificar firma
- Campos de texto (`alias`, `username`, `description`): sanitizar antes de almacenar

### Auth

- Endpoints BBM: Bearer token existente (`BBM_API_KEYS`)
- Webhook: HMAC-SHA256 en header + anti-replay
- Mejora pendiente: `timingSafeEqual` en `auth.ts` y `cookie.ts` (Fase 1)

---

## Variables de Entorno

```bash
# Ubiqo API (Fase 0+)
UBIQO_API_TOKEN=             # Bearer token para bi.ubiqo.net
UBIQO_API_BASE_URL=https://bi.ubiqo.net
UBIQO_PHOTO_DOMAINS=         # Allowlist (comma-sep): capsulas.ubiqo.net,media.ubiqo.net
UBIQO_QSR_CUSTOM_RULES=      # Custom rules para caso Guillermo (POC)

# Ubiqo Webhook (Fase 2)
UBIQO_WEBHOOK_SECRET=        # Shared secret HMAC (min 32 chars)
UBIQO_CALLBACK_URL=          # Endpoint Ubiqo para resultados (opcional)
```

**Regla:** Todas se validan **dentro del handler** (runtime), nunca a nivel de módulo. Si faltan, el endpoint retorna 500 sin afectar otros endpoints.

---

## Configuración Vercel

Merge con `vercel.json` existente (dentro de `"functions"`):

```json
"src/app/api/ubiqo/ingest/route.ts":  { "maxDuration": 30,  "memory": 512  },
"src/app/api/ubiqo/process/route.ts": { "maxDuration": 60,  "memory": 1024 },
"src/app/api/ubiqo/results/route.ts": { "maxDuration": 10,  "memory": 256  },
"src/app/api/ubiqo/status/route.ts":  { "maxDuration": 10,  "memory": 256  },
"src/app/api/webhook/ubiqo/route.ts": { "maxDuration": 60,  "memory": 1024 }
```

Todo funciona en **Vercel Hobby** (60s max). No requiere Pro.

---

## Dependencias Nuevas

| Paquete | Uso | Licencia | Tamaño |
|---------|-----|----------|--------|
| `zod` | Validación de inputs | MIT | ~13KB gzipped |

Todo lo demás usa built-ins (`crypto`, `fetch`) o dependencias existentes (Supabase, Gemini).

---

## Estimación de Costos

| Escenario | Fotos/día | Gemini/mes | Supabase | Vercel |
|-----------|-----------|-----------|----------|--------|
| **POC (1 cliente)** | 10-30 | $0.60-$1.80 | Free tier | Free tier |
| **Piloto (3 clientes)** | 50-150 | $3-$9 | Free tier | Free tier |
| **Producción (12 clientes)** | 200-1,000 | $12-$60 | Evaluar | Evaluar |

Costo por imagen: ~$0.002 USD (1 pasada), ~$0.004 USD (con escalación).

---

## Observabilidad

- **`GET /api/ubiqo/status`** — conteos por status (pending, processing, completed, failed) + alertas
- **Logging** — cada ingest/process se registra en `bbm_analysis_log` con `source: 'ubiqo'`
- **Recovery** — status `processing` > 5 min se trata como huérfano y se reintenta
- **Kill switch** — para desactivar: vaciar `UBIQO_API_TOKEN` en Vercel. No se pierden datos.

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Foto URLs requieren auth | Confirmar en Fase 0 (gate). Si sí, pasar Bearer token |
| URLs temporales / expiran | Cron cada 1 min. Dedup por `photo_path` (estable) |
| Rate limits de Ubiqo | Polling conservador (5 min). Backoff exponencial |
| Fotos baja calidad | Validar en Fase 0. Ajustar prompts si necesario |
| API difiere de docs | Fase 0 valida formato real antes de construir |
| SSRF via foto URL | Allowlist, HTTPS, Content-Type, tamaño |
| Costo Gemini por abuso | Bearer token + rate limit implícito (1 foto/invocación) |
| Ubiqo no implementa webhook | Polling funciona indefinidamente |

---

## Tests Requeridos

| Tipo | Qué verificar | Fase |
|------|--------------|------|
| Unit | Zod validation de ingest input | 1 |
| Unit | Deduplicación (misma captura no genera duplicado) | 1 |
| Unit | Extracción de fotos de payload Ubiqo (idTipo 2 y 7) | 1 |
| Unit | URL construction con allowlist SSRF | 1 |
| Unit | Webhook signature (timing-safe, anti-replay) | 2 |
| Integration | Ingest → discover → insert Supabase | 1 |
| Integration | Process → fetch → analyze → update Supabase | 1 |
| Integration | Results → query con filtros | 1 |
| Error path | Ubiqo API 401 (token expirado) | 1 |
| Error path | Foto 404, timeout, Content-Type incorrecto | 1 |
| Error path | Gemini falla ambos modelos → status=failed | 1 |
| Error path | Constraint violation (dedup) | 1 |
| Visibility | GET /results retorna todos los campos documentados | 1 |
| Visibility | GET /status retorna conteos correctos | 1 |
| Regression | timingSafeEqual no rompe flujo demo ni producción | 1 |

---

## Criterios de Aceptación

| Requisito | Métrica |
|-----------|---------|
| Conectividad | API Ubiqo responde + foto URLs descargables |
| Calidad | 10+ fotos analizadas con score coherente (validación manual) |
| Pipeline | Ingest + process funcionan sin intervención |
| Deduplicación | Misma captura no se procesa dos veces |
| Latencia | Captura → resultado < 15 min |
| Resultados | GET /results retorna análisis filtrados |
| Observabilidad | GET /status muestra estado real |
| Seguridad | SSRF mitigado, inputs validados, tokens timing-safe |
| Costos | < $2 USD/mes para el POC |

---

## Próximos Pasos

1. **Gonzalo** → Pedir a Alberto: Bearer token + cuenta Evidence de prueba
2. **Gonzalo** → Confirmar con Ubiqo: `urlBase`, auth de fotos, rate limits, expiración del token
3. **BBM** → Fase 0: validar API con datos reales
4. **BBM** → Fase 1: refactor analyze.ts + pipeline completo
5. **Guillermo** → Enviar criterios de evaluación + fotos de referencia
6. **BBM** → Configurar custom rules para franquicia QSR

---

## Auditoría Pre-Implementación

**Fecha:** 2026-03-28 | **Resultado:** Aprobado con observaciones

### Hallazgos críticos resueltos (15)

| # | Hallazgo | Resolución |
|---|----------|------------|
| C1 | Batch 300s inviable en Vercel | Discover + process (1 foto, 60s) |
| C2 | Async queue no existe en Vercel | Webhook sync (1 foto, ~30s) |
| C3 | Cron trigger no definido | Cron externo gratuito |
| C4 | SSRF en descarga de fotos | Allowlist, HTTPS, Content-Type |
| C5 | Firma webhook en JSON body | Header HTTP, raw body, timing-safe, anti-replay |
| C6 | Sin validación de payloads | Zod en todos los inputs |
| C7 | Prerequisites sin gate | Gate explícito por fase |
| C8 | Env vars rompen deploy | Validación runtime, no módulo |
| C9 | Lógica 2-pass no reutilizable | Extraer `src/lib/analyze.ts` |
| C10 | Webhook 3 fotos > 60s | Max 1 foto sync |
| C11 | Sin tests | 15 tests documentados |
| C12 | Zod no en dependencies | Documentado como dep nueva |
| C13 | Sin observabilidad | Endpoint /status, logging, recovery |
| C14 | Sin costos | Tabla por escenario |
| C15 | Sin rollback | Script DOWN, política por fase |

### Observaciones (resolver durante implementación)

1. Callback a Ubiqo: no construir sin confirmación de receptor
2. `analysis_result` JSONB sin schema en DB: OK para POC
3. Batch insert Supabase: implementar si volumen crece
4. Recovery de `processing` huérfano: query atómico con ventana de 5 min
5. Timezone: siempre enviar `?tz=` explícito
6. PII (GPS): protegido por Bearer, evaluar filtrado en Fase 3
7. Actualizar CLAUDE.md y `.env.example` en cada fase

### Riesgos residuales

1. Formato real del API puede diferir de docs → Fase 0 valida antes de construir
2. Fotos de campo pueden ser baja calidad → depende del promotor, no hay mitigación técnica
3. Ubiqo puede no implementar webhook → polling funciona indefinidamente

---

## Referencias

- `docs/ubiqo/reunion-2026-03-26.md` — Transcripción reunión demo 26-mar
- `docs/ubiqo/roadmap-franquicia-restaurantes.md` — Roadmap caso Guillermo
- `docs/ubiqo/analisis-clientes-evidence.md` — Análisis 12 prospectos
- Ubiqo API Swagger: `bi.ubiqo.net/swagger/v1/swagger.json`
- Ubiqo Docs: `documentacion.ubiqo.net`
