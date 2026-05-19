# Spec 05 — WS-H: Endurecimiento de producción ("no reventar")

## Objetivo

Cerrar lo que BullMQ (WS1) no cubre nativo: una taxonomía explícita de errores
Gemini (transitorio / permanente / safety-block) con política de retry vs fail,
surfacing diferenciado del fallo de token/API Ubiqo con runbook de rotación, y un
espejo de estado en Supabase que no diverja del estado real de la cola, con
concurrency+rate-limit topados al cuota Gemini.

## Contexto

Decisión del roadmap (`docs/roadmap-2026-05.md` WS-H): con el worker BullMQ (spec
03) los reintentos, backoff, dead-letter, job-timeout, stalled-recovery y
observabilidad (Bull Board) son **nativos de BullMQ**. Lo que NO resuelve la cola:
distinguir un error de Gemini que vale reintentar (429/5xx) de uno que NO
(safety-block, 400) — hoy `withRetry` (`src/lib/gemini.ts:127-150`) decide por
substring del mensaje y los safety-block (`:194-196`, "No response text") se
reintentan inútilmente 3 veces. Tampoco surfacea distinto un 401 de Ubiqo
(`src/lib/ubiqo/client.ts:41`) ni garantiza que `bbm_*.status` refleje el estado de
la cola. Prereq: WS-MT (spec 04). LOCKED antes de WS2/WS3.

## Alcance

**Incluye:**
- `src/lib/pipeline/errors.ts`: clasificador de errores → `transient` |
  `permanent` | `safety_block`.
- Política de retry en el worker basada en la clasificación (no en substring).
- Surfacing del fallo de token Ubiqo distinto (error tipado + runbook).
- Reconciliación de estado: el worker es la autoridad; `bbm_*.status` se sincroniza
  con el resultado del job (sin filas `processing` huérfanas eternas).
- Concurrency + rate-limit del worker topados a cuota Gemini (tope de costo).

**No incluye:**
- No reimplementar retries/backoff/dead-letter (BullMQ los da — solo se configura).
- No cambiar la lógica de análisis de `gemini.ts` (solo se **clasifica** su error;
  se puede exponer un helper sin alterar el camino feliz).
- No tocar auth/tenencia (WS-MT) ni el dashboard (WS2).
- No rotar tokens ni desplegar (pasos de operador).

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/lib/pipeline/errors.ts` | Crear |
| `src/lib/pipeline/__tests__/errors.test.ts` | Crear |
| `src/lib/gemini.ts` | Modificar (exportar causa tipada en el throw; sin cambiar camino feliz) |
| `src/lib/pipeline/ubiqo.ts` | Modificar (usar clasificador) |
| `src/lib/pipeline/planogram.ts` | Modificar (usar clasificador) |
| `infra/vps/worker/src/worker.ts` | Modificar (política retry por clasificación + concurrency/rate-limit) |
| `infra/vps/worker/src/reconcile.ts` | Crear (job de reconciliación de estado) |
| `infra/vps/worker/README.md` | Modificar (runbook rotación token Ubiqo) |
| `docs/runbook-produccion.md` | Crear (qué hacer cuando algo falla) |

## Tareas

### Tarea 1: Clasificador de errores (TDD)

**Archivos:** Crear `src/lib/pipeline/errors.ts`, `src/lib/pipeline/__tests__/errors.test.ts`.

**Taxonomía (derivada del comportamiento actual de `gemini.ts`, no inventada):**

| Clase | Qué la dispara | Acción del worker |
|---|---|---|
| `transient` | HTTP 429, 500, 503 de Gemini; AbortError/timeout; error de red | Reintentar (BullMQ attempts/backoff) |
| `permanent` | HTTP 400/401/403 de Gemini; JSON inválido irrecuperable de `extractJSON` | Fail definitivo (no reintentar) |
| `safety_block` | `finish_reason: SAFETY` / sin candidates / "No response text from Gemini" (`gemini.ts:194-196`) | Fail definitivo + marca distinta (`safety_block`) — no es bug del sistema, es la foto |

- [ ] **Step 1: Test que falle.** En `src/lib/pipeline/__tests__/errors.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { classifyError } from '@/lib/pipeline/errors';

  describe('classifyError', () => {
    it('429 → transient', () => {
      expect(classifyError(new Error('Gemini API error (429): rate')).kind).toBe('transient');
    });
    it('503 y 500 → transient', () => {
      expect(classifyError(new Error('Gemini API error (503): x')).kind).toBe('transient');
      expect(classifyError(new Error('Gemini API error (500): x')).kind).toBe('transient');
    });
    it('400 y 403 → permanent', () => {
      expect(classifyError(new Error('Gemini API error (400): bad')).kind).toBe('permanent');
      expect(classifyError(new Error('Gemini API error (403): denied')).kind).toBe('permanent');
    });
    it('no response text → safety_block', () => {
      expect(classifyError(new Error('No response text from Gemini')).kind).toBe('safety_block');
    });
    it('timeout/abort → transient', () => {
      const e = new Error('aborted'); e.name = 'AbortError';
      expect(classifyError(e).kind).toBe('transient');
    });
    it('error desconocido → permanent (no reintentar a ciegas)', () => {
      expect(classifyError(new Error('algo raro')).kind).toBe('permanent');
    });
  });
  ```

- [ ] **Step 2: Verificar FAIL.** `npm test src/lib/pipeline/__tests__/errors.test.ts`
- [ ] **Step 3: Implementar `classifyError(err): { kind: 'transient' |
  'permanent' | 'safety_block'; reason: string }`** en
  `src/lib/pipeline/errors.ts`. Reglas exactas según la tabla. Default
  desconocido = `permanent` (un error no clasificado NO se reintenta a ciegas:
  evita loops de gasto).
- [ ] **Step 4: Verificar PASS.** Reportar `6/6`.
- [ ] **Step 5: tsc + lint.** `npx tsc --noEmit && npm run lint`
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/lib/pipeline/errors.ts src/lib/pipeline/__tests__/errors.test.ts
  git commit -m "feat(hardening): classifyError (transient/permanent/safety_block)"
  ```

### Tarea 2: Política de retry por clasificación en el worker

- [ ] **Step 1:** En `infra/vps/worker/src/worker.ts`, envolver la llamada al
  processor: si lanza, `classifyError(err)`:
  - `transient` → re-lanzar para que BullMQ reintente (respeta `attempts:3` +
    backoff exponencial).
  - `permanent` / `safety_block` → marcar el job como fallido **sin reintentos**
    (BullMQ: lanzar `UnrecoverableError` de `bullmq`), y persistir en
    `bbm_*.status='failed'` con `error_kind` (`permanent`|`safety_block`) y
    `error_message`.
- [ ] **Step 2:** En `src/lib/pipeline/ubiqo.ts` y `planogram.ts`: al escribir
  `status='failed'`, incluir columna/campo `error_kind` (agregar la columna en la
  migración 009 si no existe: `ALTER TABLE ... ADD COLUMN error_kind TEXT` —
  coordinar con spec 04; si 009 ya está, crear `010_add_error_kind.sql`).
- [ ] **Step 3: Test:** unit en `__tests__/` del pipeline que verifica que un
  `safety_block` NO se reintenta (processor llamado 1 vez) y que un `transient` sí
  re-lanza. (Mockear `classifyError` o inyectar errores).
- [ ] **Step 4:** `npm test` + `npx tsc --noEmit && npm run lint`.
- [ ] **Step 5: Commit local.**
  ```bash
  git add infra/vps/worker/src/worker.ts src/lib/pipeline supabase/migrations
  git commit -m "feat(hardening): retry por clasificación; safety_block no reintenta"
  ```

### Tarea 3: Surfacing del fallo de token Ubiqo

- [ ] **Step 1:** En `src/lib/ubiqo/client.ts`: cuando la respuesta sea 401/403
  (`:41` fetchWithRetry hoy NO lo distingue), lanzar un error tipado
  `UbiqoAuthError` (clase exportada) con mensaje claro `Ubiqo token inválido o
  expirado (HTTP <status>)`. Un 401 NO se reintenta (es permanente hasta rotar el
  token). Otros 5xx siguen igual.
- [ ] **Step 2:** En `classifyError` (Tarea 1): `UbiqoAuthError` → `permanent` con
  `reason: 'ubiqo_auth'`. Agregar test al archivo de errores.
- [ ] **Step 3:** El worker, ante `reason: 'ubiqo_auth'`, además de fallar el job,
  loggea a nivel `error` un mensaje distinguible (`UBIQO_AUTH_FAILURE`) — es la
  señal de "hay que rotar el token", no un fallo de una foto puntual.
- [ ] **Step 4:** `infra/vps/worker/README.md`: agregar sección **Runbook —
  rotación de token Ubiqo** (sin secretos en el doc): cómo detectar
  (`UBIQO_AUTH_FAILURE` en logs), dónde vive el token (referencia a 1Password /
  env del VPS, no el valor), cómo recargarlo en el env del VPS y reiniciar pm2.
- [ ] **Step 5:** `npm test` + `npx tsc --noEmit && npm run lint`.
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/lib/ubiqo/client.ts src/lib/pipeline/errors.ts src/lib/pipeline/__tests__/errors.test.ts infra/vps/worker
  git commit -m "feat(hardening): UbiqoAuthError surfaceado + runbook rotación"
  ```

### Tarea 4: Reconciliación de estado cola ↔ Supabase

> Problema: si el worker muere a mitad de un job, la fila puede quedar en
> `processing` para siempre. Las RPC `pick_pending_*` ya recuperan orphans >5min
> (`008:84`), pero al retirarlas (cierre WS1) el worker debe garantizar la
> coherencia él mismo.

- [ ] **Step 1:** Crear `infra/vps/worker/src/reconcile.ts`: un repeatable job
  (cada 10 min) que:
  - Busca filas `bbm_ubiqo_captures`/`bbm_incidences` en `processing` con
    `updated_at` (o `processed_at` null) > 15 min y sin job activo/encolado en
    BullMQ correspondiente → las regresa a `pending` (o `failed` si superaron
    `attempts`).
  - Loggea cuántas reconcilió (`RECONCILE_REQUEUED=<n>`).
- [ ] **Step 2:** Registrar el job en `worker.ts` (repeatable). Concurrency 1.
- [ ] **Step 3: Test:** unit de la función de decisión de reconcile (dado un set de
  filas + estado de cola simulado, decide cuáles re-encolar) — sin Redis real.
- [ ] **Step 4:** `npm test` + tsc del worker.
- [ ] **Step 5: Commit local.**
  ```bash
  git add infra/vps/worker/src/reconcile.ts infra/vps/worker/src/worker.ts
  git commit -m "feat(hardening): reconciliación estado cola↔Supabase"
  ```

### Tarea 5: Tope de costo (concurrency + rate-limit)

- [ ] **Step 1:** En `infra/vps/worker/src/worker.ts`: configurar el `Worker` de
  cada cola con `concurrency` desde `WORKER_CONCURRENCY` (default 2) y
  `limiter: { max: Number(process.env.GEMINI_MAX_PER_MIN ?? 30), duration: 60000 }`
  (rate-limit nativo de BullMQ). Valores por env — el número exacto al cuota real
  de Gemini lo fija el operador (NO inventar el límite del plan; el default 30 es
  conservador y se documenta como ajustable).
- [ ] **Step 2:** `infra/vps/worker/README.md` + `docs/runbook-produccion.md`:
  documentar que `GEMINI_MAX_PER_MIN`/`WORKER_CONCURRENCY` son el tope de costo y
  cómo derivarlos del cuota real (no hay un número fabricado en el código).
- [ ] **Step 3:** `docs/runbook-produccion.md` (crear): tabla de "síntoma →
  causa probable → acción": job stuck, `UBIQO_AUTH_FAILURE`, `safety_block` masivo,
  gasto Gemini disparado, Redis caído. Cada fila apunta a Bull Board / logs.
- [ ] **Step 4: Commit local.**
  ```bash
  git add infra/vps/worker docs/runbook-produccion.md
  git commit -m "docs(hardening): tope de costo configurable + runbook producción"
  ```

## Pasos de operador (NO delegables)

- Fijar `GEMINI_MAX_PER_MIN`/`WORKER_CONCURRENCY` al cuota real del plan Gemini.
- Aplicar la migración de `error_kind` a la DB.
- Probar fallo simulado (token Ubiqo inválido, timeout, safety-block) en staging y
  confirmar: sin filas stuck, sin gasto sin tope, evento visible en Bull Board.

## Criterios de aceptación

- [ ] `classifyError` cubre transient/permanent/safety_block + `ubiqo_auth`; tests
      `N/N`.
- [ ] safety-block NO se reintenta (verificado por test).
- [ ] 401 Ubiqo lanza `UbiqoAuthError`, no se reintenta, loggea `UBIQO_AUTH_FAILURE`.
- [ ] Job de reconciliación re-encola filas `processing` huérfanas.
- [ ] concurrency/rate-limit configurables por env; ningún número de cuota
      fabricado en código.
- [ ] `npm test` `N/N`, `npx tsc --noEmit` exit 0, `npm run lint` exit 0.
- [ ] Camino feliz de `gemini.ts` sin cambios de comportamiento.

## Comandos de verificación (para /accept)

```bash
npm test
npx tsc --noEmit
npm run lint
git log --oneline main..HEAD
git diff main..HEAD -- src/lib/pipeline src/lib/ubiqo/client.ts infra/vps/worker docs
# camino feliz de gemini.ts no debe cambiar de comportamiento (solo throw tipado):
git diff main..HEAD -- src/lib/gemini.ts
git diff --name-only main..HEAD | grep -E '\.env$|\.env\.local|secrets|credentials' && echo "VIOLATION" || echo "OK"
```

## Safety rails

- **NO** aplicar migraciones a la DB.
- **NO** inventar el límite de cuota de Gemini ni el costo por imagen → env +
  documentación, valor real lo pone el operador.
- **NO** cambiar el camino feliz de `gemini.ts` (solo tipar el error que ya lanza).
- **NO** `git push`, **NO** `rm -rf`, **NO** `git reset --hard` ajeno.
- **NO** tocar `.env`/secrets; **NO** `WebFetch` ni Gemini/Ubiqo reales en tests.

## Notas para el worker (ejecutor de la spec)

- La taxonomía está cerrada en la tabla de Tarea 1 — no agregar clases nuevas.
- Si un comportamiento de `gemini.ts` no encaja en la tabla, reportá `BLOCKED` con
  el caso, no inventes una clase.
- Commit local por tarea. Self-review: `npm test` + `tsc` + `lint` verdes.
