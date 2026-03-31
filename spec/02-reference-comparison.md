# Spec 02 — Comparación contra Planograma (Producción Beta)

**Cliente:** FOTL (Fruit of the Loom) via UBIQO/Evidence
**Usuarios:** Carlos (coordinador anaqueles) + Enrique (supervisor UBIQO)
**Prerequisito:** Tokens parciales de Evidence disponibles (spec 00 prerequisites)

---

## Problema

Carlos revisa 400-500 carpetas de fotos semanalmente a mano, comparando contra planogramas.
Le toma un día completo. Los errores se le pasan por fatiga visual.

## Solución

BBM toma las fotos de Evidence, las compara contra planogramas almacenados, y genera
una lista de incidencias que Carlos revisa en un dashboard con export a Excel.

## Enfoque

**Detección de incidencias, no scoring de cumplimiento.** Carlos necesita "qué está mal",
no "qué porcentaje está bien." Cada incidencia = una acción concreta para el promotor.

---

## Arquitectura

```
PATH A — Webhook (principal, procesamiento inmediato):

Evidence captura foto → UBIQO almacena → Webhook POST /api/planogram/webhook
                                          → BBM descarga foto
                                          → Compara vs planograma
                                          → Incidencia en Supabase
                                          → Carlos ve resultado en minutos

PATH B — Cron (fallback, atrapa lo que el webhook falle):

Cron cada 5 min → POST /api/planogram/ingest → Consulta Evidence API
                                               → Descubre fotos no procesadas
                                               → POST /api/planogram/process (1 a la vez)
                                               → Incidencias en Supabase

Ambos paths → bbm_incidences → Dashboard BBM → Carlos → Excel
```

### Decisiones clave

| Decisión | Opción elegida | Por qué |
|----------|---------------|---------|
| Trigger | Webhook (principal) + Cron fallback (cada 5 min) | Procesamiento inmediato; cron atrapa lo que el webhook falle |
| Multi-foto | Todas las fotos de una sección en UN call a Gemini | Sin dedup, un solo listado de incidencias |
| Storage planogramas | Supabase Storage | Ya en el stack, signed URLs, free tier 1GB |
| Prompt | Incidencias (qué está mal) no compliance (qué % está bien) | Lo que Carlos necesita para actuar |
| Dashboard | App BBM propia (`/dashboard`) | Carlos no depende de cambios en Evidence |

---

## Modelo de datos

### Tabla `bbm_planograms`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| client_key | TEXT NOT NULL | `'fotl_caballeros'`, `'fotl_damas'` |
| name | TEXT NOT NULL | Nombre legible |
| storage_path | TEXT NOT NULL | Path en Supabase Storage bucket `planograms` |
| mime_type | TEXT NOT NULL | |
| reference_items | JSONB DEFAULT '[]' | Items estructurados (opcional, tipo ReferenceItem[]) |
| reference_type | TEXT DEFAULT 'planogram' | |
| section | TEXT | `'caballeros'`, `'damas'` |
| active | BOOLEAN DEFAULT true | Solo 1 activo por client_key |
| created_at | TIMESTAMPTZ | |

Partial unique index: `UNIQUE(client_key) WHERE active = true`

### Tabla `bbm_incidences`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| planogram_id | UUID FK → bbm_planograms | |
| ubiqo_capture_id | TEXT | Folio de Evidence (nullable para uploads manuales) |
| promoter_name | TEXT | Nombre del promotor |
| store_name | TEXT | Nombre de tienda |
| photo_captured_at | TIMESTAMPTZ | Fecha de captura |
| field_photo_paths | TEXT[] | Array de 1-3 paths en Storage |
| status | TEXT DEFAULT 'pending' | pending → processing → completed / failed |
| incidences | JSONB | Array de objetos Incidence |
| incidence_count | INT | |
| severity_critical | INT DEFAULT 0 | Conteo denormalizado |
| severity_high | INT DEFAULT 0 | |
| severity_medium | INT DEFAULT 0 | |
| severity_low | INT DEFAULT 0 | |
| summary | TEXT | Resumen de Gemini |
| photo_quality | TEXT | good / acceptable / poor |
| coverage | TEXT | full / partial |
| processing_time_ms | INT | |
| model | TEXT | |
| tokens_total | INT | |
| raw_response | JSONB | Response completo de Gemini (debug) |
| created_at | TIMESTAMPTZ | |
| processed_at | TIMESTAMPTZ | |

Indexes: status, promoter_name, store_name, photo_captured_at

### Tipo Incidence

```typescript
interface Incidence {
  id: string;
  category: 'missing_product' | 'wrong_position' | 'wrong_price' | 'empty_shelf'
           | 'unauthorized_product' | 'damaged_product' | 'wrong_facing' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  product?: string;           // nombre del producto afectado
  description: string;        // descripción legible de la incidencia
  location?: string;          // ubicación en el anaquel
  expectedState?: string;     // qué debería haber según planograma
  observedState?: string;     // qué se observa en la foto
  priceDifference?: number;   // solo para wrong_price
}
```

### Reglas de severidad (prompt)

| Severidad | Cuándo |
|-----------|--------|
| critical | Producto totalmente ausente de posición requerida, sección entera vacía |
| high | Posición incorrecta afectando visibilidad, error de precio >10%, producto competidor en posición prime |
| medium | Desplazamiento menor de posición, discrepancia pequeña de precio, facing incorrecto |
| low | Problemas de presentación menores, producto ligeramente rotado, daño menor en etiqueta |

---

## Endpoints

### Planogram management

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/planogram/upload` | POST | Cookie | Subir/reemplazar planograma (multipart) |
| `/api/planogram/list` | GET | Cookie | Listar planogramas activos |

### Processing pipeline

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/planogram/webhook` | POST | WEBHOOK_SECRET (HMAC signature) | Recibe notificación de Evidence, procesa inmediato |
| `/api/planogram/ingest` | POST | CRON_SECRET | Fallback: descubrir capturas no procesadas |
| `/api/planogram/process` | POST | CRON_SECRET o Cookie | Procesar 1 pendiente |
| `/api/planogram/status` | GET | Cookie | Conteos por status, último procesado |

### Dashboard data

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/planogram/incidences` | GET | Cookie | Lista con filtros (fecha, promotor, tienda, severidad) |
| `/api/planogram/incidences/[id]` | GET | Cookie | Detalle con fotos (signed URLs) |
| `/api/planogram/export` | GET | Cookie | Excel con mismos filtros |

---

## UI

### `/dashboard` — Vista principal de Carlos

1. **Barra de filtros:** Rango de fechas, promotor (dropdown), tienda (dropdown), severidad mínima
2. **Resumen:** 4 tarjetas — total incidencias, críticas, altas, pendientes de procesar
3. **Tabla:** Fecha | Promotor | Tienda | Críticas | Altas | Medias | Bajas | Resumen
4. **Detalle (click en fila):** Foto + planograma + lista de incidencias con badges de severidad
5. **Export:** Botón descarga Excel con filtros actuales

### `/dashboard/planograms` — Gestión de planogramas

1. **Grid:** Planogramas activos (thumbnail + nombre + fecha)
2. **Upload:** Zona de drag & drop para nuevo planograma
3. **Reemplazar:** Botón por planograma para actualizar

### Patrones de UI

Reutilizar exactamente los patrones de `src/app/demo/page.tsx`:
- Inline styles + CSS variables de `globals.css`
- Clases: `.card`, `.btn`, `.badge`, `.drop-zone`, `.table`, `.spinner`
- Hook `useEmailGate()` para auth
- NO Tailwind

---

## Prompt de incidencias

### Nueva función: `buildIncidencePrompt()` en `src/lib/planogram/incidence-prompt.ts`

Enfoque: "Encuentra TODO lo que está mal" — no "evalúa cumplimiento"

```
Eres un inspector visual experto en cumplimiento de planogramas retail.

Se te proporcionan imágenes:
1. IMAGEN DE REFERENCIA: El planograma oficial.
2-N. FOTOS DE CAMPO: Fotos del anaquel real (pueden ser 1-3 fotos cubriendo secciones).

Tu trabajo: Identificar CADA incidencia — cualquier cosa en las fotos de campo
que difiera del planograma. Enfócate en lo que está MAL, no en lo que está bien.

Para cada incidencia, clasifica:
- category: missing_product | wrong_position | wrong_price | empty_shelf |
            unauthorized_product | damaged_product | wrong_facing | other
- severity: critical | high | medium | low (según reglas)
- product: nombre del producto afectado
- description: descripción clara de la incidencia
- location: dónde en el anaquel (estante X, zona Y)
- expectedState: qué debería haber según planograma
- observedState: qué se observa en la foto

Retorna JSON: { summary, photoQuality, coverage, incidences[], shelfOverview }
```

---

## Gemini client

### Nueva función en `src/lib/gemini.ts`

```typescript
export async function analyzeWithMultipleFields(
  fieldImages: ImageSource[],      // 1-3 fotos de campo
  referenceImages: ImageSource[],  // 1 planograma
  prompt: string,
  apiKey: string,
  timeoutMs?: number
): Promise<AnalysisResult>
```

Reutiliza `callGeminiMultiImage()` y `withRetry()` existentes. No modifica
`analyzeWithReferences()` que usa la demo.

---

## Excel export

### 4 hojas

1. **Resumen** — 1 fila por comparación: fecha, promotor, tienda, severidades, resumen
2. **Incidencias** — 1 fila por incidencia: comparación_id, categoría, severidad, producto, descripción, ubicación
3. **Por Promotor** — Pivot: promotor | total | críticas | altas | medias | bajas
4. **Por Tienda** — Pivot: tienda | total | críticas | altas | medias | bajas

Usa `xlsx` (ya en stack). Sigue patrones de `src/lib/exports/excel.ts`.

---

## Fases de implementación

### Fase 0 — Foundation (sin dependencia externa)

- Migración SQL: `bbm_planograms` + `bbm_incidences`
- Tipos: `src/types/incidence.ts`
- Storage: `src/lib/planogram/storage.ts` (upload, download, signed URL)
- Prompt: `src/lib/planogram/incidence-prompt.ts`
- Parser: `src/lib/planogram/incidence-parser.ts`
- Gemini: `analyzeWithMultipleFields()` en `gemini.ts`
- Endpoints: upload + list
- Test: subir planograma FOTL real

### Fase 1 — Pipeline de comparación (requiere al menos fotos de prueba)

- Endpoint: process (toma 1 pendiente, compara, guarda incidencias)
- Endpoint: ingest (consulta Evidence API — requiere token)
- Endpoint: status
- Cron config en `vercel.json`
- Test E2E: crear pending manualmente → process → verificar incidencias

### Fase 2 — Dashboard (requiere Fase 1 con datos)

- Endpoint: incidences (con filtros) + incidences/[id] (detalle)
- UI: `/dashboard` (tabla + filtros + detalle)
- UI: `/dashboard/planograms` (gestión)
- Hook: `useDashboard.ts`

### Fase 3 — Export + Automatización

- Endpoint: export (Excel 4 hojas)
- Vercel Cron configurado
- CLAUDE.md actualizado
- Test con Carlos: flujo completo Evidence → incidencias → Excel

---

## Archivos a crear

```
src/
  app/
    api/planogram/
      upload/route.ts
      list/route.ts
      webhook/route.ts
      process/route.ts
      ingest/route.ts
      incidences/route.ts
      incidences/[id]/route.ts
      export/route.ts
      status/route.ts
    dashboard/
      page.tsx
      planograms/page.tsx
  lib/planogram/
    storage.ts
    incidence-prompt.ts
    incidence-parser.ts
    excel-export.ts
  types/
    incidence.ts
  hooks/
    useDashboard.ts
supabase/migrations/
  004_create_bbm_planograms.sql
  005_create_bbm_incidences.sql
```

## Archivos a modificar

- `src/lib/gemini.ts` — agregar `analyzeWithMultipleFields()`
- `vercel.json` — endpoints + cron
- `CLAUDE.md` — documentar nueva arquitectura

---

## Variables de entorno nuevas

- `UBIQO_API_TOKEN` — Bearer token para Evidence API
- `UBIQO_API_BASE` — URL base (`bi.ubiqo.net`)
- `CRON_SECRET` — Secret para auth de cron endpoints
- `WEBHOOK_SECRET` — Secret para validar firma HMAC del webhook de Evidence
- `SUPABASE_STORAGE_BUCKET` — Nombre del bucket (default: `planograms`)

---

## Costos (beta FOTL)

- Gemini: ~100 comparaciones/semana × $0.008 = **~$3.20/mes**
- Supabase Storage: <100MB de planogramas = **free tier**
- Vercel Cron: incluido en Pro plan
- **Total: ~$3-5/mes**

---

## Riesgos

1. **Precisión del prompt** — La primera versión del prompt de incidencias necesitará iteración
   con fotos reales de FOTL. Mitigación: Fase 1 incluye tuning del prompt.

2. **Token de Evidence** — Parcialmente disponible. Si falta urlBase o auth de fotos,
   Fase 1 se bloquea. Mitigación: Fase 0 no depende de Evidence.

3. **Fotos parciales** — Promotores toman 2-3 fotos. Si no se asocian correctamente
   al mismo planograma, se generan falsos negativos. Mitigación: campo `section`
   en el formulario de Evidence.

4. **Calidad fotográfica** — Fotos borrosas, mal iluminadas, ángulo oblicuo.
   Mitigación: pre-flight quality check + guía para promotores.

---

## Auditoría pre-implementación

**Fecha:** 2026-03-30
**Resultado global:** Aprobado con cambios (9 hallazgos críticos resueltos)

### Hallazgos críticos (resueltos)

**C1. Webhook asíncrono, no síncrono.**
Webhook solo encola (INSERT status='pending', responde 202 en <10s).
Cron cada 1 min procesa 1 pendiente (60s timeout). Patrón de spec 00.

**C2. No crear analyzeWithMultipleFields().**
`analyzeWithReferences()` ya acepta arrays. Reutilizar directamente.

**C3. Auth: email gate + allowlist para beta.**
Agregar `DASHBOARD_ALLOWED_EMAILS` en env. Solo emails autorizados acceden
al dashboard. El email gate sigue como mecanismo, pero con whitelist.
Para producción futura: migrar a auth real.

**C4. Webhook con replay protection.**
Timestamp + nonce en firma HMAC. Rechazar requests >5 min. Guardar IDs procesados.

**C5. Cron auth con timingSafeEqual().**
Validar `CRON_SECRET` con `crypto.timingSafeEqual()`, no `===`.

**C6. Supabase Storage: bucket privado + signed URLs.**
Bucket privado. Signed URLs generadas server-side con TTL 30 min.
Guardar solo paths en DB, nunca URLs firmadas.

**C7. Soft delete de planogramas.**
Desactivar con `active=false`. Incidencias existentes mantienen su FK.
No se borran planogramas con incidencias activas.

**C8. Paths en DB, signed URLs on-the-fly.**
`field_photo_paths` guarda paths de Storage. Endpoint de detalle genera
signed URLs cuando Carlos abre una incidencia.

**C9. Webhook payload: diseño genérico.**
El endpoint valida firma y encola. El formato exacto del payload se define
con Ubiqo. Fase 1 usa polling (ingest), no depende del webhook.

**C10. Multi-foto: por captura de Evidence.**
Un folio de Evidence = un grupo de fotos. Si una captura tiene 3 fotos,
las 3 se comparan juntas contra el planograma asignado.

**C11. Mapeo planograma ↔ formulario.**
Carlos asigna un planograma a un formulario de Evidence (1:1).
Todas las fotos de ese formulario se comparan contra ese planograma.
Tabla de mapeo: `bbm_planogram_assignments(planogram_id, form_id)`.

### Observaciones

| # | Observación | Decisión |
|---|-------------|----------|
| O1 | Timezone handling | Usar TIMESTAMPTZ. Evidence envía en UTC. Dashboard muestra hora local. |
| O2 | Data retention | Diferir. <5K records/año en beta. Revisar post-beta. |
| O3 | Pagination | Offset/limit. 80-100 rows no necesita cursor. |
| O4 | Empty state dashboard | Diseñar en Fase 2. Mensaje + CTA para subir planograma. |
| O5 | CSS table extensions | Agregar hover + sticky headers en Fase 2. |
| O6 | Per-promoter export | Filtro por promotor en endpoint export. No endpoint separado. |
| O7 | Duplicate captures | Cada captura es un row. Dashboard muestra ambas. Sin dedup. |
| O8 | Promoters sin fotos | Out of scope para beta. Evidence maneja asistencia, no BBM. |

### Fases de implementación (revisadas)

**Fase 0 — Foundation (sin dependencia externa)**
- Migración SQL: `bbm_planograms` + `bbm_incidences` + `bbm_planogram_assignments`
- Tipos: `src/types/incidence.ts`
- Storage: `src/lib/planogram/storage.ts` (bucket privado, signed URLs)
- Prompt: `src/lib/planogram/incidence-prompt.ts`
- Parser: `src/lib/planogram/incidence-parser.ts`
- Auth: allowlist en env (`DASHBOARD_ALLOWED_EMAILS`)
- Endpoints: upload + list + assign planogram to form
- Test: subir planograma FOTL real, verificar Storage

**Fase 1 — Pipeline (requiere fotos de prueba)**
- Endpoint: process (atómico: toma 1 pending, compara, guarda)
- Endpoint: ingest (polling Evidence API — requiere token parcial)
- Endpoint: webhook (enqueue only, firma HMAC + replay protection)
- Endpoint: status
- Cron config en `vercel.json` (ingest 5 min, process 1 min)
- Test E2E: crear pending → process → verificar incidencias

**Fase 2 — Dashboard (requiere datos de Fase 1)**
- Endpoints: incidences (filtros) + incidences/[id] (detalle + signed URLs)
- UI: `/dashboard` (tabla + filtros + resumen + detalle)
- UI: `/dashboard/planograms` (gestión + asignación a formularios)
- CSS: extender globals.css con table hover + sticky headers
- Hook: `useDashboard.ts`
- Empty state diseñado

**Fase 3 — Export + Automatización**
- Endpoint: export (Excel 4 hojas, filtrable por promotor/tienda)
- Cron verificado en producción
- CLAUDE.md + .env.example actualizados
- Test con Carlos

### Tests requeridos

| Tipo | Qué verificar | Prioridad |
|------|--------------|-----------|
| Unit | `buildIncidencePrompt()` genera prompt correcto con/sin referenceItems | Alta |
| Unit | `incidence-parser.ts` mapea raw Gemini → Incidence[] con severidades | Alta |
| Unit | Signed URL generation con TTL | Alta |
| Unit | HMAC webhook signature verification + replay rejection | Alta |
| Unit | Auth allowlist: emails permitidos pasan, otros no | Alta |
| Integración | Upload planogram → Storage → retrieve → verify | Alta |
| Integración | Process endpoint: pending → processing → completed | Alta |
| Integración | Ingest endpoint: descubre capturas, dedup, encola | Media |
| Integración | Export Excel: 4 hojas, filtros por promotor/tienda | Media |
| Visibilidad | Dashboard table: 80+ rows, filtros, sort | Alta |
| Visibilidad | Detail view: fotos (signed URLs) + incidencias con badges | Alta |
| E2E | Flujo completo: foto en Evidence → ingest → process → dashboard → Excel | Alta |
| Edge case | Foto baja calidad → incidencia con warning, no crash | Media |
| Edge case | Planograma desactivado → incidencias existentes siguen visibles | Media |

### Criterios de aceptación

1. **Pipeline funcional:** Foto encolada → procesada en <2 min → incidencias visibles en dashboard
2. **Dashboard usable:** Carlos filtra por promotor/tienda/fecha, ve incidencias, exporta Excel
3. **Auth controlado:** Solo emails en allowlist acceden. Otros ven error 403.
4. **Storage seguro:** Planogramas y fotos en bucket privado. Signed URLs con TTL 30 min.
5. **No breaking changes:** Demo, onboarding, API producción siguen funcionando.
6. **Export completo:** Excel con 4 hojas (resumen, incidencias, por promotor, por tienda)
7. **Tests:** Todos los de prioridad Alta pasan.

### Riesgos residuales

1. **Token de Evidence parcial** — Si falta urlBase o auth de fotos, Fase 1 ingest se bloquea.
   Fase 0 y Fase 2 no dependen de esto.

2. **Webhook payload de Evidence** — No definido aún. El endpoint se construye genérico
   (valida firma, encola). El mapeo exacto del payload se ajusta cuando Ubiqo confirme.

3. **Precisión del prompt de incidencias** — Primera versión necesitará iteración con fotos
   reales. Fase 1 incluye tuning.
