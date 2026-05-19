# Spec 03 — WS1: Pipeline compartido + worker BullMQ en VPS

## Objetivo

Extraer la lógica de proceso e ingest de los route handlers a un módulo
`src/lib/pipeline/` reutilizable, y montar un worker BullMQ en el VPS que importe
ese módulo (reemplaza cron-job.org y la cola emulada en Supabase; elimina el techo
de 60s de Vercel).

## Contexto

Hoy la lógica de "descargar foto → analizar → guardar" vive embebida en los bodies
de `src/app/api/ubiqo/process/route.ts` y `src/app/api/planogram/process/route.ts`,
y el ingest en los `ingest/route.ts`. Esto ata el procesamiento al límite de 60s de
Vercel y a un cron externo frágil. Decisión del roadmap (`docs/roadmap-2026-05.md`
WS1): mover el procesamiento a un worker BullMQ en el VPS existente. La API Next.js
(Vercel) queda igual en superficie; cambia quién ejecuta el trabajo. El módulo
extraído es la frontera: routes y worker lo importan.

## Alcance

**Incluye:**
- Crear `src/lib/pipeline/` con funciones puras de proceso e ingest (deps inyectadas).
- Refactor de los 4 routes (`ubiqo/process`, `ubiqo/ingest`, `planogram/process`,
  `planogram/ingest`) a wrappers delgados que llaman al módulo.
- Worker BullMQ en `infra/vps/worker/` (colas, processors, repeatable job de ingest,
  Bull Board).
- Tests unitarios del módulo `pipeline` con deps mockeadas.

**No incluye:**
- No cambiar la lógica de negocio (mismo análisis, mismas escrituras a Supabase).
- No cambiar el esquema de Supabase (la migración multi-tenant es WS-MT, spec 04).
- No tocar auth, `src/lib/gemini.ts`, `src/lib/analyze.ts`, `src/lib/ubiqo/*`,
  `src/lib/planogram/*` (se importan tal cual).
- No desplegar el worker ni mover secrets al VPS dentro de una delegación (pasos de
  operador, marcados abajo).
- No retirar las RPC `pick_pending_*` todavía (se hace en cierre de WS1, manual).

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/lib/pipeline/types.ts` | Crear |
| `src/lib/pipeline/ubiqo.ts` | Crear |
| `src/lib/pipeline/planogram.ts` | Crear |
| `src/lib/pipeline/index.ts` | Crear |
| `src/lib/pipeline/__tests__/ubiqo.test.ts` | Crear |
| `src/lib/pipeline/__tests__/planogram.test.ts` | Crear |
| `src/app/api/ubiqo/process/route.ts` | Modificar (reemplazar cuerpo `:69-131` por llamada) |
| `src/app/api/ubiqo/ingest/route.ts` | Modificar (extraer `:79-115`) |
| `src/app/api/planogram/process/route.ts` | Modificar (reemplazar `:81-213`) |
| `src/app/api/planogram/ingest/route.ts` | Modificar (extraer `:120-166`) |
| `infra/vps/worker/package.json` | Crear |
| `infra/vps/worker/src/queues.ts` | Crear |
| `infra/vps/worker/src/worker.ts` | Crear |
| `infra/vps/worker/src/board.ts` | Crear |
| `infra/vps/worker/ecosystem.config.js` | Crear (pm2) |
| `infra/vps/worker/README.md` | Crear (runbook de deploy — operador) |

## Tareas

### Tarea 1: Módulo `src/lib/pipeline/` — proceso Ubiqo (TDD)

**Archivos:** Crear `src/lib/pipeline/types.ts`, `src/lib/pipeline/ubiqo.ts`,
`src/lib/pipeline/__tests__/ubiqo.test.ts`.

**Steps:**

- [ ] **Step 1: Escribir test que falle.** En `src/lib/pipeline/__tests__/ubiqo.test.ts`:

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { processUbiqoCapture } from '@/lib/pipeline/ubiqo';
  import type { PipelineDeps } from '@/lib/pipeline/types';

  function makeDeps(over: Partial<PipelineDeps> = {}): PipelineDeps {
    return {
      downloadPhoto: vi.fn(async () => ({ buffer: Buffer.from('img'), contentType: 'image/jpeg' })),
      analyzePhoto: vi.fn(async () => ({
        analysis: { ok: true } as any,
        meta: { model: 'm', tokens: 1, processing_time_ms: 1, escalated: false },
      })),
      decryptFirma: vi.fn(() => 'firma'),
      supabase: {
        from: vi.fn(() => ({
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        })),
      } as any,
      env: { GOOGLE_AI_API_KEY: 'k' } as any,
      ...over,
    };
  }

  describe('processUbiqoCapture', () => {
    it('descarga, analiza y marca completed', async () => {
      const deps = makeDeps();
      const capture = {
        id: 'c1', url_base: 'https://cdn.test', photo_path: 'a/b.jpg',
        firma_encrypted: 'enc', custom_rules: null,
      };
      const r = await processUbiqoCapture(capture as any, deps);
      expect(deps.downloadPhoto).toHaveBeenCalledOnce();
      expect(deps.analyzePhoto).toHaveBeenCalledOnce();
      expect(r.status).toBe('completed');
    });

    it('propaga error de download sin marcar completed', async () => {
      const deps = makeDeps({ downloadPhoto: vi.fn(async () => { throw new Error('net'); }) });
      const capture = { id: 'c1', url_base: 'https://cdn.test', photo_path: 'a/b.jpg', firma_encrypted: 'enc', custom_rules: null };
      await expect(processUbiqoCapture(capture as any, deps)).rejects.toThrow('net');
      expect(deps.analyzePhoto).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Verificar que falla.** Run: `npm test src/lib/pipeline/__tests__/ubiqo.test.ts`
  Expected: FAIL (`processUbiqoCapture is not defined` / módulo inexistente).

- [ ] **Step 3: Definir tipos.** En `src/lib/pipeline/types.ts`:

  ```typescript
  import type { supabase as SupabaseClient } from '@/lib/supabase';
  import type { downloadPhoto } from '@/lib/ubiqo/ssrf';
  import type { analyzePhoto } from '@/lib/analyze';
  import type { decryptFirma } from '@/lib/ubiqo/crypto';

  export interface PipelineEnv {
    GOOGLE_AI_API_KEY: string;
  }

  export interface PipelineDeps {
    downloadPhoto: typeof downloadPhoto;
    analyzePhoto: typeof analyzePhoto;
    decryptFirma: typeof decryptFirma;
    supabase: typeof SupabaseClient;
    env: PipelineEnv;
  }

  export interface ProcessResult {
    status: 'completed';
    captureId: string;
  }
  ```

- [ ] **Step 4: Implementar `processUbiqoCapture`.** Leé primero
  `src/app/api/ubiqo/process/route.ts`. Moví **íntegro** el bloque de proceso de una
  foto (líneas `:69-131`: construir URL con `decryptFirma`+`url_base`+`photo_path`,
  `downloadPhoto`, base64, `analyzePhoto`, `UPDATE bbm_ubiqo_captures status=completed`)
  a `src/lib/pipeline/ubiqo.ts` como:

  ```typescript
  export async function processUbiqoCapture(
    capture: UbiqoCaptureRow,   // tipo de la fila que hoy maneja el route
    deps: PipelineDeps,
  ): Promise<ProcessResult>
  ```

  Reglas: misma lógica, mismas escrituras. Toda dependencia externa
  (`downloadPhoto`, `analyzePhoto`, `decryptFirma`, `supabase`, env) se usa **vía
  `deps`**, no por import directo dentro de la función. NO incluir el pick
  (`pick_pending_ubiqo_capture`) ni el retry/fail (`:132-169`): eso queda en el caller.

- [ ] **Step 5: Verificar que pasa.** Run: `npm test src/lib/pipeline/__tests__/ubiqo.test.ts`
  Expected: PASS 2/2.

- [ ] **Step 6: Refactor del route.** En `src/app/api/ubiqo/process/route.ts`:
  reemplazar el cuerpo `:69-131` por una llamada a `processUbiqoCapture(capture,
  realDeps)` donde `realDeps` arma `deps` con los imports reales. Conservar
  intactos: auth `:12-20`, validación env `:22-36`, pick `:40-55`, retry/fail
  `:132-169`. El route sigue respondiendo igual.

- [ ] **Step 7: tsc + lint.** Run: `npx tsc --noEmit && npm run lint`
  Expected: ambos exit 0.

- [ ] **Step 8: Commit local.**
  ```bash
  git add src/lib/pipeline/types.ts src/lib/pipeline/ubiqo.ts src/lib/pipeline/__tests__/ubiqo.test.ts src/app/api/ubiqo/process/route.ts
  git commit -m "refactor(pipeline): extrae processUbiqoCapture a src/lib/pipeline"
  ```

### Tarea 2: Módulo pipeline — proceso planograma (TDD)

Misma estructura que Tarea 1, para `src/app/api/planogram/process/route.ts`.

**Steps:**

- [ ] **Step 1: Test que falle.** En `src/lib/pipeline/__tests__/planogram.test.ts`:

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { processIncidence } from '@/lib/pipeline/planogram';

  function makeDeps(over = {}) {
    return {
      downloadPlanogram: vi.fn(async () => ({ buffer: Buffer.from('p'), contentType: 'image/png' })),
      downloadPhoto: vi.fn(async () => ({ buffer: Buffer.from('f'), contentType: 'image/jpeg' })),
      buildIncidencePrompt: vi.fn(() => 'PROMPT'),
      analyzeWithReferences: vi.fn(async () => ({ rawResponse: '{}', model: 'm', tokens: 1 })),
      parseIncidenceResponse: vi.fn(() => ({ summary: 's', incidences: [], photoQuality: 'good', coverage: 'full' })),
      supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'p1', storage_path: 'x' }, error: null })) })) })), update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })) } as any,
      env: { GOOGLE_AI_API_KEY: 'k' } as any,
      ...over,
    };
  }

  describe('processIncidence', () => {
    it('compara y marca completed con conteo de severidades', async () => {
      const deps = makeDeps();
      const row = { id: 'i1', planogram_id: 'p1', field_photo_paths: ['f1.jpg'] };
      const r = await processIncidence(row as any, deps as any);
      expect(deps.analyzeWithReferences).toHaveBeenCalledOnce();
      expect(deps.parseIncidenceResponse).toHaveBeenCalledOnce();
      expect(r.status).toBe('completed');
    });
  });
  ```

- [ ] **Step 2: Verificar FAIL.** `npm test src/lib/pipeline/__tests__/planogram.test.ts`
- [ ] **Step 3: Extender `PipelineDeps`** en `types.ts` con
  `downloadPlanogram`, `buildIncidencePrompt`, `analyzeWithReferences`,
  `parseIncidenceResponse` (tipados con `typeof` de sus módulos reales:
  `@/lib/planogram/storage`, `@/lib/planogram/incidence-prompt`, `@/lib/gemini`,
  `@/lib/planogram/incidence-parser`). Hacer las nuevas keys opcionales o crear
  `PlanogramPipelineDeps extends PipelineDeps` para no romper Tarea 1.
- [ ] **Step 4: Implementar `processIncidence`** en `src/lib/pipeline/planogram.ts`
  moviendo el bloque `src/app/api/planogram/process/route.ts:81-213` (fetch
  planograma, download planograma+fotos, `buildIncidencePrompt`,
  `analyzeWithReferences`, `parseIncidenceResponse`, UPDATE `bbm_incidences`
  completed). Deps vía `deps`. NO incluir el pick (`:51-79`) ni auth.
- [ ] **Step 5: Verificar PASS.** `npm test src/lib/pipeline/__tests__/planogram.test.ts`
- [ ] **Step 6: Refactor del route** `planogram/process/route.ts`: cuerpo `:81-213`
  → `processIncidence(row, realDeps)`. Conservar auth/env `:24-47`, pick `:51-79`.
- [ ] **Step 7: tsc + lint.** `npx tsc --noEmit && npm run lint`
- [ ] **Step 8: Commit local.**
  ```bash
  git add src/lib/pipeline/ src/app/api/planogram/process/route.ts
  git commit -m "refactor(pipeline): extrae processIncidence a src/lib/pipeline"
  ```

### Tarea 3: Módulo pipeline — ingest (TDD)

Extraer la lógica de discover/upsert de ambos ingest a
`ingestUbiqoCaptures(params, deps)` y `ingestPlanogramCaptures(params, deps)` en
`src/lib/pipeline/ubiqo.ts` / `planogram.ts`.

- [ ] **Step 1: Test que falle** en `__tests__/ubiqo.test.ts` (agregar `describe`):
  mock de `fetchCaptures` devolviendo 2 capturas `estatus:'Completa'` + 1 incompleta;
  assert que solo las 2 completas se upsertan (`supabase.from().upsert` llamado con
  2 filas) y que `extractPhotos` se invoca por captura.
- [ ] **Step 2: Verificar FAIL.**
- [ ] **Step 3: Implementar `ingestUbiqoCaptures`** moviendo
  `src/app/api/ubiqo/ingest/route.ts:79-115` (loop filtro `estatus==='Completa'`,
  `extractPhotos`, upsert `onConflict:'ubiqo_grupo,photo_path'`). Deps:
  `fetchCaptures`, `extractPhotos`, `encryptFirma`, `supabase`.
- [ ] **Step 4: Implementar `ingestPlanogramCaptures`** moviendo
  `src/app/api/planogram/ingest/route.ts:62-166` (lookup
  `bbm_planogram_assignments` por form_id + verify planograma activo + loop
  `extractPhotos`→`buildPhotoUrl`→upsert `onConflict:'ubiqo_capture_id'`).
- [ ] **Step 5: Verificar PASS.**
- [ ] **Step 6: Refactor ambos `ingest/route.ts`** a wrappers.
- [ ] **Step 7: tsc + lint.**
- [ ] **Step 8: Commit local.**
  ```bash
  git add src/lib/pipeline/ src/app/api/ubiqo/ingest/route.ts src/app/api/planogram/ingest/route.ts
  git commit -m "refactor(pipeline): extrae ingest a src/lib/pipeline"
  ```

### Tarea 4: Barrel + verificación de no-regresión

- [ ] **Step 1:** `src/lib/pipeline/index.ts` re-exporta `processUbiqoCapture`,
  `processIncidence`, `ingestUbiqoCaptures`, `ingestPlanogramCaptures`, tipos.
- [ ] **Step 2:** Suite completa: `npm test` — Expected: todos los tests previos
  del repo siguen verdes + los nuevos. Reportar conteo `N/N`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` exit 0.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/lib/pipeline/index.ts
  git commit -m "refactor(pipeline): barrel + verificación no-regresión"
  ```

### Tarea 5: Worker BullMQ (esqueleto en repo — deploy = operador)

> El worker corre en el VPS, no en Vercel. Esta tarea crea el código en el repo;
> el deploy, los secrets y el arranque del proceso son **pasos de operador**
> (sección "Pasos de operador"), NO se ejecutan en una delegación.

**Archivos:** `infra/vps/worker/` (package.json, src/queues.ts, src/worker.ts,
src/board.ts, ecosystem.config.js, README.md).

- [ ] **Step 1: `package.json`** del worker: deps `bullmq`, `ioredis`,
  `@bull-board/api`, `@bull-board/express`, `express`. Script `"start": "node
  --import tsx src/worker.ts"` (o build a JS). Workspace independiente del Next app
  (no contamina deps de Vercel). Node ≥ 20.

- [ ] **Step 2: `src/queues.ts`** — define 2 colas BullMQ:
  `ubiqo-process` y `planogram-process`, conexión a Redis vía
  `process.env.REDIS_URL`. Opciones por defecto: `attempts: 3`,
  `backoff: { type: 'exponential', delay: 5000 }`,
  `removeOnComplete: 1000`, `removeOnFail: 5000`.

- [ ] **Step 3: `src/worker.ts`** — un `Worker` por cola que:
  - importa los processors desde el repo Next (`../../src/lib/pipeline/`) o desde
    un paquete compartido — resolver el import path al integrar; documentarlo en
    README. Arma `deps` reales (supabase, gemini, ubiqo helpers) desde el env del
    VPS.
  - Por cada job: hace el pick atómico (las RPC `pick_pending_*` siguen vigentes
    hasta el cierre de WS1) y llama `processUbiqoCapture` / `processIncidence`.
  - Define un **repeatable job** de ingest: cada 5 min encola un job de ingest que
    llama `ingestUbiqoCaptures`/`ingestPlanogramCaptures` y luego encola un job de
    proceso por cada fila pendiente. Reemplaza el cron externo.
  - `concurrency` configurable por env (`WORKER_CONCURRENCY`, default 2) — el tope
    fino al cuota Gemini lo cierra WS-H (spec 05).

- [ ] **Step 4: `src/board.ts`** — Bull Board en Express, montado en
  `/admin/queues`, protegido por basic-auth (`BOARD_USER`/`BOARD_PASS` del env).

- [ ] **Step 5: `ecosystem.config.js`** — config pm2 (app `bbm-worker`,
  `instances: 1`, `autorestart: true`, `max_memory_restart: '512M'`).

- [ ] **Step 6: `README.md`** — runbook de deploy para el operador (Pasos de
  operador, sin secretos en el doc; referencia a dónde viven).

- [ ] **Step 7: tsc del worker** (su propio tsconfig): exit 0. Lint si aplica.

- [ ] **Step 8: Commit local.**
  ```bash
  git add infra/vps/worker
  git commit -m "feat(worker): esqueleto BullMQ worker para VPS (deploy = operador)"
  ```

## Pasos de operador (NO delegables — Gonzalo/Opus)

1. Provisionar Redis en el VPS (o servicio gestionado) y obtener `REDIS_URL`.
2. Inyectar al env del VPS (no a disco/chat): `GOOGLE_AI_API_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `UBIQO_API_TOKEN`,
   `BBM_FIRMA_ENCRYPTION_KEY`, `REDIS_URL`, `BOARD_USER`, `BOARD_PASS`.
3. `pm2 start ecosystem.config.js` + `pm2 save` + `pm2 startup` (supervisión).
4. Smoke test E2E real: encolar un job → fila en `bbm_ubiqo_captures` pasa a
   `completed` → job visible en Bull Board.
5. Apagar el cron externo (cron-job.org) solo cuando el repeatable job esté verde.
6. Cierre de WS1: retirar las RPC `pick_pending_*` si el worker ya hace el pick
   (migración aparte, post-smoke).

## Criterios de aceptación

- [ ] `npm test` verde (todos los previos + nuevos), reportar `N/N`.
- [ ] `npx tsc --noEmit` exit 0. `npm run lint` exit 0.
- [ ] Los 4 routes siguen respondiendo igual (cuerpo extraído, no cambiado).
- [ ] `src/lib/pipeline/` exporta las 4 funciones con deps inyectadas (sin imports
      duros de supabase/gemini dentro de las funciones puras).
- [ ] Worker compila (`tsc` propio exit 0). Deploy NO ejecutado en delegación.

## Comandos de verificación (para /accept)

```bash
npm test
npx tsc --noEmit
npm run lint
git log --oneline main..HEAD
git diff main..HEAD -- src/lib/pipeline src/app/api infra/vps/worker
git diff --name-only main..HEAD | grep -E '\.env|secrets|credentials' && echo "VIOLATION" || echo "OK"
# Confirmar que las funciones puras NO importan supabase/gemini directo:
grep -nE "import .* from '@/lib/(supabase|gemini|analyze)'" src/lib/pipeline/ubiqo.ts src/lib/pipeline/planogram.ts && echo "REVISAR: import duro en función pura" || echo "OK deps inyectadas"
```

## Safety rails

- **NO** tocar `.env`, `.env.local`, secrets, keys.
- **NO** `git push` (solo commit local).
- **NO** `git reset --hard` sobre commits ajenos, **NO** `rm -rf` directorios.
- **NO** ejecutar migraciones de DB (retirar `pick_pending_*` = paso de operador).
- **NO** deploy del worker ni arranque de pm2 (paso de operador).
- **NO** `WebFetch` ni llamadas a Evidence/Gemini reales en tests (todo mockeado).

## Notas para el worker (ejecutor de la spec)

- Si una ambigüedad no está resuelta acá, **detente y reporta** (`BLOCKED`), no adivines.
- Antes de crear un archivo que ya existe, leelo primero.
- La lógica de negocio NO cambia: extracción literal, deps inyectadas.
- Commit local después de cada tarea.
- Self-review antes de DONE: `npm test`, `npx tsc --noEmit`, `npm run lint` verdes.
