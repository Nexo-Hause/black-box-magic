# Spec 00 — Integración BBM x Ubiqo (Evidence/Gather)

**Fecha:** 2026-03-28
**Estado:** Auditado
**Autor:** Gonzalo León + Claude
**Contexto:** Reunión demo 26-mar-2026 con Guillermo y Alberto (Ubiqo). Ver `docs/ubiqo/`.

---

## Objetivo

Integrar Black Box Magic como **capa de inteligencia visual** sobre Evidence/Gather de Ubiqo. Las fotos que los trabajadores de campo ya capturan en Evidence se procesan automáticamente con BBM, convirtiendo evidencia fotográfica pasiva en reportes accionables con scoring.

**Alcance de esta spec:** POC técnico de integración + path a producción.

---

## Contexto de Negocio

### Pipeline actual

- **12 prospectos** identificados en los clientes de Evidence (ver `docs/ubiqo/analisis-clientes-evidence.md`)
- **Caso piloto:** Franquicia de restaurantes QSR (Guillermo) — demo exitoso 26-mar
- **Clusters replicables:** Retail/BTL, Franquicias multi-sucursal, Infraestructura, Servicios regulados

### Qué resuelve

| Hoy (Evidence solo) | Mañana (Evidence + BBM) |
|---------------------|------------------------|
| Foto = prueba de presencia | Foto = fuente de inteligencia |
| Revisión manual de cada foto | Análisis automático con scoring |
| Sin comparación entre sucursales | Ranking por tienda/zona/región |
| Sin detección de incumplimientos | Compliance automático vs reglas custom |
| Supervisor revisa 1 foto a la vez | Dashboard con KPIs agregados |

---

## Arquitectura de Integración

### Modelo elegido: Webhook asíncrono (Opción A)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Evidence /     │     │    Ubiqo         │     │      BBM        │
│   Gather App     │     │    Backend       │     │    API          │
│                  │     │                  │     │                 │
│  Promotor toma   │────>│  Almacena foto   │     │                 │
│  foto en campo   │     │  + metadata      │     │                 │
│                  │     │                  │     │                 │
│                  │     │  Dispara webhook │────>│  POST /webhook  │
│                  │     │  con foto URL    │     │  /ubiqo         │
│                  │     │                  │     │                 │
│                  │     │                  │     │  Descarga foto  │
│                  │     │                  │     │  Analiza (2-pass│
│                  │     │                  │     │  hybrid engine) │
│                  │     │                  │     │                 │
│                  │     │  Consulta        │<────│  Almacena       │
│                  │     │  resultado       │     │  resultado      │
│                  │     │  GET /results/   │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Por qué webhook y no otra opción

| Criterio | Webhook (elegido) | Ubiqo llama API sync | Bucket compartido |
|----------|-------------------|---------------------|-------------------|
| Captura de Evidence se afecta si BBM falla | No | Sí | No |
| Dev requerido de Ubiqo | Extender webhook existente | Modificar flujo core | Configurar infra nueva |
| Patrón industria | Stripe, GitHub, Twilio | Microservicio interno | Pipelines big data |
| Complejidad | Baja | Media | Alta |

### Fase intermedia: Polling API (para el POC)

Mientras Ubiqo implementa el webhook, el POC usa polling sobre su API REST existente:

```
┌──────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Cron    │────>│  bi.ubiqo.net   │     │      BBM        │
│  Job     │     │  GET /Capturas/ │     │                 │
│  (cada   │     │  Rango/{form}/  │     │                 │
│  N min)  │     │  {de}/{a}       │     │                 │
│          │     │                 │     │                 │
│          │     │  Responde JSON  │     │                 │
│          │<────│  con foto URLs  │     │                 │
│          │     │                 │     │                 │
│          │     │                 │────>│  Descarga foto  │
│          │     │                 │     │  POST /analyze  │
│          │     │                 │     │  Almacena       │
└──────────┘     └─────────────────┘     └─────────────────┘
```

---

## API de Ubiqo — Lo que existe hoy

### Endpoints disponibles (Swagger en `bi.ubiqo.net/swagger/v1/swagger.json`)

| # | Endpoint | Uso para BBM |
|---|----------|-------------|
| 1 | `GET /v1/Capturas/Rango/{formId}/{de}/{a}` | **Principal** — capturas estructuradas con fotos |
| 2 | `GET /v1/Capturas/Rango/Sabana/{formId}/{de}/{a}` | Tabla plana (Power BI) — backup |
| 3 | `GET /v1/Capturas/Rango/Sabana/{formId}/{plantillaId}/{de}/{a}` | Filtrado por template |
| 4 | `GET /v1/Capturas/Rango/Sabana/Versiones/{formId}/{de}/{a}` | Incluye sub-versiones |
| 5 | `GET /v1/Capturas/Grupo/Sabana/{formId}/{grupo}` | Por grupo UUID |
| 6 | `GET /v1/InformacionDeServicios/{formId}/{movilId}/{grupo}` | Info de servicio |

### Autenticación

- Bearer token: `Authorization: Bearer {token}`
- Token provisto por equipo comercial de Ubiqo (no self-service)

### Formato de fechas

- `YYYYMMDDHHmmss` en UTC (ej: `20260328000000`)
- Parámetro opcional: `?tz=America/Mexico_City`

### Estructura de una captura (endpoint 1 — estructurado)

```typescript
interface UbiqoCaptura {
  alias: string;                    // Nombre del dispositivo/trabajador
  username: string;                 // Usuario que capturó
  estatus: string;                  // "validado" | "pendiente" | "rechazado"
  motivo: string;                   // Razón de rechazo
  idMovil: number;                  // ID del dispositivo
  grupo: string;                    // UUID del grupo de captura
  folioEvidence: string;            // Folio único
  fechaInicial: string;             // Inicio de captura (ISO 8601)
  fechaSincronizacion: string;      // Cuándo se sincronizó
  urlBase: string;                  // Base URL para media
  firma: string;                    // Referencia a firma digital
  capturas: UbiqoCapturaBase[];     // Array de campos del formulario
}

interface UbiqoCapturaBase {
  timeStamp: string;
  latitud: string;
  longitud: string;
  idTipo: number;                   // Tipo de campo (ver tabla abajo)
  idSubformulario: number;
  orden: number;
  fechaCaptura: string;             // ISO 8601
}
```

### Tipos de campo relevantes para BBM

| idTipo (Base II) | Tipo | Campos clave |
|-----------------|------|-------------|
| **2** | **Fotografía (una)** | `fotografias[].url`, `.latitud`, `.longitud`, `.descripcion` |
| **7** | **Galería (múltiples)** | Mismo formato, múltiples entries |
| 3 | Firma digital | `base64Firma`, `url` |
| 4 | Código de barras | `codigoBarras`, `url` |
| 5 | QR | `codigoQr`, `url` |
| 6 | Punto de interés | Coordenadas + nombre + URL |

### Cómo vienen las fotos

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

**URL completa de la foto** = `urlBase` + `fotografias[].url`

Ejemplo: `https://capsulas.ubiqo.net/Capsulas/abc-123.jpeg`

> **POR CONFIRMAR con Ubiqo:** El valor exacto de `urlBase` y si las URLs son públicas, temporales (signed), o requieren auth.

---

## Qué necesitamos de Ubiqo (prerequisitos)

| # | Item | Para qué | Estado | Gate |
|---|------|----------|--------|------|
| 1 | Bearer token para `bi.ubiqo.net` | Auth del API | Pendiente — pedir a Alberto | **Bloqueante para Fase 0** |
| 2 | Cuenta Evidence/Gather de prueba | Crear formularios, capturar fotos | Pendiente | Bloqueante para Fase 0 |
| 3 | Confirmar `urlBase` de fotos | Saber la URL completa para descargar | Pendiente | **Bloqueante para Fase 0** |
| 4 | Confirmar si foto URLs requieren auth | Saber si necesitamos pasar token para descargar | Pendiente | **Bloqueante para Fase 0** |
| 5 | Un `formId` de formulario con campo foto | Saber qué consultar | Se crea con cuenta de prueba | Bloqueante para Fase 0 |
| 6 | SLA: rate limits, retención de URLs | Diseñar polling interval y retry | Pendiente | Bloqueante para Fase 1 |
| 7 | Acordar formato de webhook (Fase 2) | Firma en header, formato payload, replay protection | Pendiente | Bloqueante para Fase 2 |

> **Gate Criteria:** Fase 0 NO arranca hasta resolver items #1, #3, #4. Fase 1 NO arranca hasta completar Fase 0 exitosamente. Fase 2 NO arranca hasta resolver item #7 con Ubiqo.

---

## Plan de Implementación

### Fase 0 — Setup y validación del API (1-2 días)

**Objetivo:** Confirmar que podemos obtener fotos del API de Ubiqo y que BBM las analiza correctamente.

**Tareas:**

- [ ] Obtener Bearer token de Ubiqo
- [ ] Obtener cuenta Evidence/Gather de prueba
- [ ] Crear formulario de auditoría QSR con campos: foto fachada, foto interior, foto cocina, foto baños, foto personal, notas texto
- [ ] Capturar 10-15 fotos de prueba con Evidence
- [ ] Llamar `GET /v1/Capturas/Rango/{formId}/{de}/{a}` y verificar:
  - [ ] Estructura del response
  - [ ] URLs de fotos son descargables
  - [ ] Metadata de GPS y timestamps llegan
- [ ] Descargar fotos manualmente y pasarlas por `POST /api/analyze` de BBM
- [ ] Verificar calidad del análisis con fotos reales de Evidence

**Entregable:** Documentación del formato real del API + 10 análisis de prueba exitosos.

### Fase 1 — POC Polling (1 semana)

**Objetivo:** Pipeline automático que consulta nuevas capturas de Ubiqo y las analiza con BBM.

**Qué se construye:**

#### 1.1 Diseño de dos fases: discover + process

El ingest se divide en dos pasos para respetar el timeout de 60s de Vercel y ser resiliente a fallos parciales:

**Paso 1 — Discover:** `POST /api/ubiqo/ingest` (trigger: cron externo o manual)

```typescript
// Input
interface IngestRequest {
  form_id: string;
  from: string;          // YYYYMMDDHHmmss
  to: string;            // YYYYMMDDHHmmss
  tz?: string;           // default: "America/Mexico_City"
}

// Validación de input (Zod)
// - form_id: /^[a-zA-Z0-9_-]+$/ (alfanumérico + guiones)
// - from/to: /^\d{14}$/ (exactamente 14 dígitos)
// - from < to
// - rango máximo: 7 días (evitar queries masivos)

// Flow
// 1. Validar input con Zod schema
// 2. GET bi.ubiqo.net/v1/Capturas/Rango/{form_id}/{from}/{to}
// 3. Filtrar capturas con campos tipo foto (idTipo 2 o 7)
// 4. Deduplicar vs capturas ya procesadas (por ubiqo_grupo + photo_path)
// 5. Registrar fotos nuevas en Supabase con status = 'pending'
// 6. Retornar: { discovered: N, already_processed: M, pending: P }
```

**Paso 2 — Process:** `POST /api/ubiqo/process` (trigger: cron externo o manual)

```typescript
// Input (opcional — sin input procesa el siguiente pendiente)
interface ProcessRequest {
  capture_id?: string;   // UUID específico, o procesa el más antiguo pending
}

// Flow
// 1. Query Supabase: 1 capture con status = 'pending' (ORDER BY created_at ASC LIMIT 1)
// 2. Marcar status = 'processing'
// 3. Descargar foto:
//    a. Construir URL: urlBase + photo_path
//    b. Validar dominio contra allowlist (solo dominios Ubiqo conocidos)
//    c. Validar protocolo: solo HTTPS
//    d. Fetch con timeout de 10s
//    e. Validar Content-Type: solo image/*
//    f. Validar tamaño: max 10MB
// 4. Convertir a base64
// 5. Llamar analyzeImage (función extraída a src/lib/analyze.ts)
// 6. Actualizar row: status = 'completed', analysis_result, score, etc.
// 7. Si falla: status = 'failed', error_message
// 8. Retornar resultado del análisis

// Timeout: 60s — suficiente para 1 foto (descarga ~3s + Gemini ~15-25s)
```

**Cron trigger (POC):** Servicio externo gratuito (cron-job.org, UptimeRobot, o GitHub Actions scheduled) que llama secuencialmente:
1. `POST /api/ubiqo/ingest` — descubre nuevas capturas (cada 5 min)
2. `POST /api/ubiqo/process` — procesa 1 pendiente (cada 1 min mientras haya pendientes)

Ambos endpoints protegidos con Bearer token (`BBM_API_KEYS`).

#### 1.2 Modelo de datos en Supabase

```sql
-- Capturas de Ubiqo procesadas
CREATE TABLE bbm_ubiqo_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers de Ubiqo
  ubiqo_grupo UUID NOT NULL,              -- grupo UUID de la captura
  ubiqo_folio TEXT,                        -- folioEvidence
  ubiqo_form_id TEXT NOT NULL,

  -- Metadata del campo
  ubiqo_alias TEXT,                        -- nombre del trabajador/dispositivo
  ubiqo_username TEXT,
  ubiqo_estatus TEXT,                      -- validado/pendiente/rechazado

  -- Foto
  photo_path TEXT NOT NULL,                -- path relativo (Capsulas/[uuid].jpeg) — estable para dedup
  photo_url TEXT,                          -- URL completa (puede ser temporal/signed)
  photo_lat DOUBLE PRECISION,
  photo_lon DOUBLE PRECISION,
  photo_description TEXT,                  -- descripción del campo de foto
  photo_captured_at TIMESTAMPTZ,           -- fechaCaptura de Ubiqo

  -- Estado de procesamiento
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  error_message TEXT,                      -- si status = failed

  -- Análisis BBM (null hasta que status = completed)
  analysis_result JSONB,                   -- resultado completo del análisis
  execution_score INTEGER,                 -- 0-100 extraído (puede ser NULL si no evaluable)
  photo_type TEXT,                         -- retail_shelf, facade, condition, etc.
  severity TEXT,                           -- CRITICAL, MODERATE, MINOR, N/A
  escalated BOOLEAN DEFAULT FALSE,

  -- Metadata BBM
  model TEXT,
  tokens_total INTEGER,
  processing_time_ms INTEGER,

  -- Timestamps
  analyzed_at TIMESTAMPTZ,                 -- NULL hasta completado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),    -- se actualiza en cada cambio de status

  -- Deduplicación por path relativo (estable aunque URL cambie)
  UNIQUE(ubiqo_grupo, photo_path)
);

-- Índices para queries comunes
CREATE INDEX idx_ubiqo_captures_form ON bbm_ubiqo_captures(ubiqo_form_id);
CREATE INDEX idx_ubiqo_captures_status ON bbm_ubiqo_captures(status);
CREATE INDEX idx_ubiqo_captures_score ON bbm_ubiqo_captures(execution_score);
CREATE INDEX idx_ubiqo_captures_date ON bbm_ubiqo_captures(photo_captured_at);
CREATE INDEX idx_ubiqo_captures_alias ON bbm_ubiqo_captures(ubiqo_alias);
```

> **Nota:** `execution_score` es nullable — algunas fotos pueden no ser evaluables (ej: foto borrosa, sin contexto). El schema usa `photo_path` (path relativo estable) para deduplicación en lugar de `photo_url` (que puede cambiar si Ubiqo usa signed URLs).

#### 1.3 Endpoint de resultados: `GET /api/ubiqo/results`

Para que Ubiqo (o nosotros) consulte resultados de análisis.

```typescript
// Query params
interface ResultsQuery {
  form_id?: string;
  from?: string;               // ISO date
  to?: string;                 // ISO date
  alias?: string;              // filtrar por trabajador
  min_score?: number;          // filtrar por score mínimo
  max_score?: number;          // filtrar por score máximo
  severity?: string;           // filtrar por severidad
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
    photo_lat: number;
    photo_lon: number;
    execution_score: number;
    photo_type: string;
    severity: string;
    escalated: boolean;
    analysis: AnalysisData;       // response completo de BBM
    condition_detail?: ConditionDetail;
    analyzed_at: string;
  }>;
}
```

#### 1.4 Auth para endpoints de Ubiqo

Los nuevos endpoints usan el mismo Bearer token auth que `/api/analyze`:

```
Authorization: Bearer {bbm_api_key}
```

Se puede crear un key específico para Ubiqo: `BBM_API_KEYS="...,ubiqo:key-para-ubiqo"`

### Fase 2 — Webhook en producción (2-3 semanas, post-validación POC)

**Objetivo:** Ubiqo dispara webhook cuando hay nueva captura con foto. BBM procesa en tiempo real.

**Qué se construye:**

#### 2.1 Endpoint receptor: `POST /api/webhook/ubiqo`

```typescript
// Payload esperado del webhook de Ubiqo (a acordar con ellos)
interface UbiqoWebhookPayload {
  event: "capture.created" | "capture.validated";
  form_id: string;
  grupo: string;                   // UUID del grupo
  folio: string;                   // folioEvidence
  alias: string;
  username: string;
  photos: Array<{
    url: string;                   // URL completa (o relativa + urlBase)
    lat: number;
    lon: number;
    description: string;
    captured_at: string;           // ISO 8601
  }>;
  timestamp: string;               // ISO 8601
  // NOTA: signature va en header HTTP, NO en el body (ver 2.2)
}
```

> **Acordar con Ubiqo:** Este formato es una propuesta. El payload real se define en conjunto con su equipo técnico.

#### 2.2 Verificación de firma (acordar con Ubiqo)

Seguir el patrón estándar de la industria (Stripe, GitHub):

1. **Firma en header HTTP:** `X-Ubiqo-Signature: sha256=<hex_digest>`
2. **Se firma el raw body** (bytes exactos del POST, no un campo JSON)
3. **HMAC-SHA256** con shared secret (`UBIQO_WEBHOOK_SECRET`, min 32 caracteres)
4. **Comparación timing-safe:** `crypto.timingSafeEqual()` — nunca `===`
5. **Anti-replay:** Validar que `timestamp` del payload esté dentro de ventana de 5 minutos. Rechazar webhooks más antiguos.

```typescript
// Pseudocódigo
const signature = request.headers.get('X-Ubiqo-Signature');
const rawBody = await request.text();
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
const payload = JSON.parse(rawBody); // parsear DESPUÉS de verificar firma
const age = Date.now() - new Date(payload.timestamp).getTime();
if (age > 5 * 60 * 1000) {
  return NextResponse.json({ error: 'Webhook too old' }, { status: 401 });
}
```

#### 2.3 Procesamiento síncrono (no async)

Vercel serverless **no soporta procesamiento background** después de enviar response. El webhook procesa dentro del timeout de 60s:

```
Webhook POST → Verificar firma → Validar payload (Zod)
             → Para cada foto (max 3 por webhook, típicamente 1):
               → Registrar en Supabase (status: pending)
               → Descargar foto (con validación SSRF)
               → Analizar con BBM engine
               → Actualizar resultado (status: completed)
             → Responder 200 con resumen
```

**Límite: 1 foto por webhook.** En el peor caso (descarga 3s + Gemini Pass 1 12s + Pass 2 12s + overhead 3s = ~30s), 1 foto cabe cómodo en 60s. Si el webhook trae múltiples fotos, registrar todas como `pending` en Supabase, procesar solo la primera, y dejar el resto para el cron de `/api/ubiqo/process`.

**Alternativa futura:** Si el volumen crece, migrar a procesamiento desacoplado con Inngest o QStash (Upstash). El webhook solo registra en Supabase y responde 200, el procesamiento real lo hace un worker.

#### 2.4 Callback opcional a Ubiqo

```typescript
// POST a endpoint de Ubiqo con el resultado (si ellos lo implementan)
interface BBMCallbackPayload {
  ubiqo_grupo: string;
  ubiqo_folio: string;
  execution_score: number;
  severity: string;
  photo_type: string;
  analysis_summary: string;
  full_result_url: string;         // URL para consultar resultado completo
  analyzed_at: string;
}
```

### Fase 3 — Dashboard y features de negocio

Fuera del alcance de esta spec. Ver `docs/ubiqo/roadmap-franquicia-restaurantes.md` para:
- Scoring por sucursal (promedio ponderado de áreas)
- Comparación entre sucursales/franquiciatarios/zonas
- Validación de campañas vigentes
- Valor para el franquiciatario (benchmarking, badges)

---

## Configuración Vercel

Agregar dentro de `"functions"` en `vercel.json` (merge con config existente):

```json
{
  "functions": {
    "src/app/api/ubiqo/ingest/route.ts": {
      "maxDuration": 30,
      "memory": 512
    },
    "src/app/api/ubiqo/process/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "src/app/api/ubiqo/results/route.ts": {
      "maxDuration": 10,
      "memory": 256
    },
    "src/app/api/webhook/ubiqo/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

**Notas:**
- `ingest` solo descubre y registra capturas (no analiza) — 30s y 512MB son suficientes.
- `process` analiza 1 foto — 60s y 1GB (consistente con `/api/analyze`).
- Todos los endpoints funcionan en **Vercel Hobby (60s max)**. No requiere Pro.

---

## Variables de entorno nuevas

```bash
# Ubiqo API
UBIQO_API_TOKEN=             # Bearer token para bi.ubiqo.net
UBIQO_API_BASE_URL=https://bi.ubiqo.net
UBIQO_PHOTO_DOMAINS=         # Allowlist de dominios para descargar fotos (comma-separated)
                             # Ejemplo: capsulas.ubiqo.net,media.ubiqo.net

# Ubiqo Webhook (Fase 2)
UBIQO_WEBHOOK_SECRET=        # Shared secret para verificar firma HMAC (min 32 chars)
UBIQO_CALLBACK_URL=          # URL de Ubiqo para enviar resultados (opcional)
```

> **Importante (C8):** Todas las env vars se validan **dentro del handler** (runtime), nunca a nivel de módulo. Esto evita que un deploy sin estas vars configuradas rompa el cold start de otras funciones. Seguir el patrón existente de `/api/analyze/route.ts` con `GOOGLE_AI_API_KEY`. Si la var no está configurada, el endpoint retorna 500 con mensaje descriptivo, sin afectar otros endpoints.

---

## Seguridad

### Descarga de fotos — protección SSRF

Las URLs de fotos se construyen desde datos de Ubiqo. Para evitar SSRF (Server-Side Request Forgery):

1. **Allowlist de dominios:** Solo descargar de dominios en `UBIQO_PHOTO_DOMAINS`. Rechazar cualquier otro.
2. **Solo HTTPS:** Rechazar `http://`, `file://`, y cualquier otro protocolo.
3. **Validar Content-Type:** Solo aceptar `image/*` en la respuesta.
4. **Validar tamaño:** Max 10MB (consistente con `/api/analyze`).
5. **No seguir redirects a dominios fuera de la allowlist.**

### Validación de payloads

Todos los inputs se validan con Zod antes de procesar:

- **Ingest:** `form_id` alfanumérico, `from`/`to` exactamente 14 dígitos, `from < to`, rango max 7 días
- **Webhook:** Schema completo del payload validado después de verificar firma
- **Campos de texto** (`alias`, `username`, `description`): sanitizar antes de almacenar en Supabase

### Auth existente — mejora pendiente

El comparador de tokens en `src/lib/auth.ts` usa `===` — cambiar a `crypto.timingSafeEqual()` para prevenir timing attacks. Aplica también a `src/lib/cookie.ts`. Esta mejora se hace como parte de Fase 1.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| URLs de fotos requieren auth para descargar | Bloquea POC | Confirmar con Ubiqo en Fase 0 (gate criteria). Si requiere auth, pasar Bearer token |
| URLs de fotos son temporales / expiran | Fotos no descargables después de X tiempo | Procesar rápido (cron cada 1 min). Dedup por `photo_path` (estable), no por URL |
| Rate limits no documentados en API Ubiqo | Throttling inesperado | Polling conservador (ingest cada 5 min). Retry con backoff exponencial |
| Fotos de Evidence son de baja resolución / mal iluminadas | Análisis de baja calidad | Validar en Fase 0 con fotos reales. Ajustar prompts si necesario |
| Formato real del API difiere de la documentación | Requiere ajustes | Fase 0 valida el formato real antes de construir |
| SSRF via URL de foto manipulada | Acceso a recursos internos | Allowlist de dominios, solo HTTPS, validar Content-Type |
| Ubiqo no implementa webhook (se queda en polling) | Sin real-time | Polling funciona indefinidamente. Webhook es mejora, no dependencia |
| Costo Gemini por abuso del endpoint ingest | Facturación inesperada | Rate limiting por API key en endpoint process. Bearer token requerido |

---

## Criterios de éxito del POC

| Criterio | Métrica |
|----------|---------|
| Conectividad | API de Ubiqo responde con capturas + foto URLs descargables |
| Calidad | BBM analiza fotos de Evidence con score coherente (validado manualmente en 10+ fotos) |
| Pipeline | Ingest automático procesa nuevas capturas sin intervención manual |
| Deduplicación | Misma captura no se procesa dos veces |
| Latencia | Desde captura en Evidence hasta resultado en BBM: < 15 minutos (polling cada 5 min) |
| Resultados consultables | GET /results retorna análisis filtrados correctamente |

---

## Dependencias nuevas

| Paquete | Uso | Licencia | Tamaño |
|---------|-----|----------|--------|
| `zod` | Validación de input (ingest, webhook, payloads) | MIT | ~13KB gzipped |

No se agregan otras dependencias. Se usa: `crypto` (built-in Node), `fetch` (built-in), Supabase client (ya instalado), Gemini client (ya instalado).

---

## Estimación de costos

| Escenario | Fotos/día | Costo Gemini/mes | Costo Supabase |
|-----------|-----------|-----------------|----------------|
| **POC (1 cliente)** | 10-30 | $0.60-$1.80 USD | Free tier |
| **Piloto (3 clientes)** | 50-150 | $3-$9 USD | Free tier |
| **Producción (12 clientes)** | 200-1,000 | $12-$60 USD | Evaluar plan |

Costo base por imagen: ~$0.002 USD (Gemini). Con escalación (2 pasadas): ~$0.004 USD.
Vercel: sin costo adicional si se mantiene en Hobby (60s timeout suficiente con diseño de 1-foto-por-invocación).

---

## Observabilidad

### Endpoint de status: `GET /api/ubiqo/status`

Query rápida que retorna estado del pipeline (últimas 24h):

```typescript
interface UbiqoStatusResponse {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  last_ingest_at: string | null;
  last_completed_at: string | null;
  alert: string | null;  // "5 fotos en status failed sin resolver" si failed > threshold
}
```

### Logging

Cada ejecución de `/ingest` y `/process` se registra en `bbm_analysis_log` (tabla existente) con campo `source: 'ubiqo'`. Esto permite rastrear: cuándo se ejecutó el último ingest, cuántas fotos se procesaron, errores.

### Recovery de status huérfano

Si una captura tiene `status = 'processing'` por más de 5 minutos (timeout de Vercel es 60s), se considera huérfana. El endpoint `/process` la reintenta:

```sql
WHERE status = 'pending'
   OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
ORDER BY created_at ASC
LIMIT 1
```

---

## Refactors necesarios

### Extraer lógica de análisis a `src/lib/analyze.ts`

La lógica de análisis 2-pasadas (Pass 1 + escalación) vive actualmente inline en `src/app/api/analyze/route.ts` (líneas 76-118). Para que `/api/ubiqo/process` pueda reutilizarla sin duplicar, se extrae a una función:

```typescript
// src/lib/analyze.ts
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

Tanto `/api/analyze` como `/api/ubiqo/process` importan esta función. Refactor en Fase 1.

### Custom rules para pipeline Ubiqo

Para el POC, las custom rules de Guillermo (criterios por área: fachada, cocina, baños, personal) se almacenan como **env var** (`UBIQO_QSR_CUSTOM_RULES`) o constante en código. El endpoint `/api/ubiqo/process` las pasa como parámetro `customRules` a `analyzePhoto()`.

Para multi-tenant (12 clientes con reglas diferentes), se necesitará una tabla `bbm_client_configs` que mapee `form_id → custom_rules`. Esto es alcance de Fase 3.

### Timing-safe comparison en auth

Cambiar `===` por `crypto.timingSafeEqual()` en:
- `src/lib/auth.ts` (comparación de Bearer tokens)
- `src/lib/cookie.ts` (comparación de firmas HMAC)

Refactor en Fase 1 como mejora de seguridad.

---

## Migraciones

### UP (crear)

El SQL de `CREATE TABLE bbm_ubiqo_captures` se ejecuta manualmente en Supabase Dashboard (el proyecto no tiene herramienta de migraciones).

### DOWN (rollback)

```sql
DROP TABLE IF EXISTS bbm_ubiqo_captures;
```

**Política:** En Fase 0 y Fase 1, el schema es provisional. Es aceptable hacer DROP + recrear porque no hay datos de producción. En Fase 2+, migraciones aditivas según regla de `.claude/rules/supabase.md`.

---

## Próximos pasos inmediatos

1. **Gonzalo** → Pedir a Alberto (Ubiqo): Bearer token + cuenta Evidence de prueba
2. **Gonzalo** → Confirmar con Ubiqo: formato de `urlBase`, auth para descargar fotos, rate limits, expiración del token
3. **BBM** → Fase 0: validar API con datos reales (gate: items #1, #3, #4 resueltos)
4. **BBM** → Fase 1: refactor analyze.ts + pipeline ingest/process/results/status
5. **Guillermo** → Enviar criterios de evaluación por área + fotos de referencia (correcto/incorrecto)
6. **BBM** → Con criterios de Guillermo: configurar custom rules para franquicia QSR
7. **BBM** → Actualizar CLAUDE.md y `.env.example` con endpoints y env vars nuevos

---

## Auditoría pre-implementación

**Fecha:** 2026-03-28
**Resultado global:** Aprobado con observaciones (todos los críticos resueltos en la spec)

### Hallazgos críticos (resueltos)

| # | Hallazgo | Resolución |
|---|----------|------------|
| C1 | Batch 300s inviable en Vercel | Rediseñado: discover + process (1 foto, 60s) |
| C2 | Async queue no existe en Vercel | Webhook procesa sincrónicamente (max 1 foto, ~30s) |
| C3 | Cron trigger no definido | Especificado: cron externo (cron-job.org o similar) |
| C4 | SSRF en descarga de fotos | Allowlist de dominios, solo HTTPS, Content-Type validation |
| C5 | Firma de webhook mal diseñada | Header HTTP, raw body, timing-safe, anti-replay (5 min) |
| C6 | Sin validación de payloads | Zod schema validation en todos los inputs |
| C7 | Prerequisites sin gate criteria | Gate explícito: Fase 0 requiere items #1, #3, #4 |
| C8 | Env vars pueden romper deploy | Validación runtime en handler, nunca a nivel módulo |
| C9 | Lógica 2-pass no es reutilizable | Extraer a `src/lib/analyze.ts` en Fase 1 |
| C10 | Webhook 3 fotos excede 60s | Reducido a max 1 foto sync por webhook |
| C11 | Sin sección de tests | Tests listados por tipo (ver abajo) |
| C12 | Zod no está en dependencies | Documentado como dependencia nueva |
| C13 | Sin observabilidad | Endpoint `/status`, logging, recovery de status huérfano |
| C14 | Sin estimación de costos | Tabla de costos por escenario documentada |
| C15 | Sin plan de rollback de migraciones | Script DOWN documentado, política por fase |

### Observaciones (aceptadas, resolver durante implementación)

1. Callback a Ubiqo (2.4): no construir hasta que Ubiqo confirme endpoint receptor
2. `analysis_result JSONB` sin schema en DB: aceptable para POC, campos clave ya extraídos a columnas
3. Batch insert de Supabase para volumen: implementar cuando sea necesario
4. Rate limiting en process: Bearer token protege acceso, status='processing' actúa como lock
5. Token de Ubiqo: confirmar si expira y mecanismo de refresh
6. Redirect handling en descarga: usar `redirect: 'manual'` o `redirect: 'error'`
7. Timezone: siempre enviar `?tz=America/Mexico_City` explícitamente
8. PII (GPS): protegido por Bearer token, evaluar filtrado por nivel de acceso en Fase 3
9. `vercel.json` merge: aditivo, sin conflictos
10. CLAUDE.md y `.env.example`: actualizar en cada fase

### Tests requeridos

| Tipo | Qué verificar | Fase |
|------|--------------|------|
| **Unit** | Validación Zod de ingest input (form_id, fechas, rangos) | 1 |
| **Unit** | Deduplicación: misma captura no genera insert duplicado | 1 |
| **Unit** | Extracción de fotos de payload Ubiqo (idTipo 2 y 7) | 1 |
| **Unit** | Construcción de URL con allowlist SSRF | 1 |
| **Unit** | Webhook signature verification (timing-safe, anti-replay) | 2 |
| **Integration** | Ingest → discover → insert en Supabase | 1 |
| **Integration** | Process → fetch foto → analyze → update en Supabase | 1 |
| **Integration** | Results → query con filtros retorna datos correctos | 1 |
| **Error path** | Ubiqo API retorna 401 (token expirado) | 1 |
| **Error path** | Foto URL no descargable (404, timeout, Content-Type incorrecto) | 1 |
| **Error path** | Gemini falla en ambos modelos → status = failed | 1 |
| **Error path** | Supabase constraint violation (dedup) | 1 |
| **Visibility** | GET /results retorna todos los campos de ResultsResponse | 1 |
| **Visibility** | GET /status retorna conteos correctos por status | 1 |
| **Regression** | Auth timing-safe no rompe flujo demo ni producción | 1 |

### Criterios de aceptación

| Requisito | Pregunta |
|-----------|----------|
| Conectividad | ¿API de Ubiqo responde con capturas + foto URLs descargables? |
| Calidad | ¿BBM analiza fotos de Evidence con score coherente (10+ fotos validadas manualmente)? |
| Pipeline | ¿Ingest descubre + process analiza sin intervención manual? |
| Deduplicación | ¿Misma captura no se procesa dos veces? |
| Latencia | ¿Captura → resultado en < 15 min (polling cada 5 min)? |
| Resultados | ¿GET /results retorna análisis filtrados correctamente? |
| Observabilidad | ¿GET /status muestra el estado real del pipeline? |
| Seguridad | ¿SSRF mitigado, inputs validados, tokens timing-safe? |
| Costos | ¿Costo Gemini < $2 USD/mes para el POC? |

### Riesgos residuales

1. **Formato real del API puede diferir de la documentación.** Mitigado por Fase 0 (validación antes de construir).
2. **Fotos de campo pueden ser de baja calidad.** Solo se valida en Fase 0 con fotos reales — no hay mitigación técnica, depende de la calidad de captura del promotor.
3. **Ubiqo puede no implementar webhook.** Polling funciona indefinidamente como alternativa. No es bloqueante.

---

## Referencias

- `docs/ubiqo/reunion-2026-03-26.md` — Transcripción de la reunión demo
- `docs/ubiqo/roadmap-franquicia-restaurantes.md` — Roadmap de fases para caso Guillermo
- `docs/ubiqo/analisis-clientes-evidence.md` — Análisis de 12 prospectos
- Ubiqo API Swagger: `https://bi.ubiqo.net/swagger/v1/swagger.json`
- Ubiqo Docs: `https://documentacion.ubiqo.net/`
