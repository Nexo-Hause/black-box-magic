# Spec 02-WS2 — Dashboard FOTL (Fase 2, tenant-scoped)

## Objetivo

Construir el dashboard que Carlos (y Enrique, y BBM) usan para ver incidencias:
endpoints `incidences` + `incidences/[id]` + `assign`, UI `/dashboard` y
`/dashboard/planograms` con selector de cliente por rol, todo aislado por tenant
vía el helper de WS-MT.

## Contexto

Spec 02 (`spec/02-reference-comparison.md`) tiene el problema/solución. El contrato
de endpoints, paginación, timezone, empty states y design system está **cerrado**
en `spec/02-reference-comparison.md` sección "WS-D — Cierre de decisiones
(2026-05-18)" — esa sección es la fuente de verdad de esta spec. La tenencia y los
3 roles están en `docs/tenancy-model.md`; el aislamiento se aplica con
`scopedQuery` + `resolveSession` de WS-MT (`spec/04-ws-mt-multitenant.md`). Prereq:
WS-D + WS-MT + WS-H completos. La UI replica los patrones de
`src/app/demo/page.tsx` (inline styles + CSS vars, **NO Tailwind**).

## Alcance

**Incluye:**
- `GET /api/planogram/incidences` (lista filtrada, paginada, tenant-scoped).
- `GET /api/planogram/incidences/[id]` (detalle + signed URLs on-the-fly).
- `POST /api/planogram/assign` (C11: asignar form_id a planograma, 1:1).
- UI `/dashboard` (filtros + 4 tarjetas resumen + tabla + detalle + selector de
  cliente por rol + 3 empty states).
- UI `/dashboard/planograms` (grid + upload + asignación de form_id).
- Hook `src/hooks/useDashboard.ts`.
- CSS: `globals.css` table hover + sticky header (O5).

**No incluye:**
- No export Excel (es WS3, `spec/02-ws3-export.md`).
- No tocar el pipeline, auth core (`cookie.ts`), ni el esquema (WS-MT ya lo hizo).
- No Tailwind, no librerías de UI nuevas, no state manager externo.
- No modificar `src/app/demo/page.tsx` (es molde de lectura, no se edita).

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/app/api/planogram/incidences/route.ts` | Crear |
| `src/app/api/planogram/incidences/[id]/route.ts` | Crear |
| `src/app/api/planogram/assign/route.ts` | Crear |
| `src/app/api/planogram/__tests__/incidences.test.ts` | Crear |
| `src/app/api/planogram/__tests__/assign.test.ts` | Crear |
| `src/hooks/useDashboard.ts` | Crear |
| `src/app/dashboard/page.tsx` | Crear |
| `src/app/dashboard/planograms/page.tsx` | Crear |
| `src/app/globals.css` | Modificar (agregar hover + sticky header) |

## Molde de referencia (leer, no editar)

| Patrón | Archivo:línea |
|---|---|
| Auth de route (cookie → 401 → session → 403 → !supabase → 503) | `src/app/api/planogram/list/route.ts:17` y `status/route.ts:17` |
| Resolución de rol+scope | `src/lib/auth/session.ts` (`resolveSession`), WS-MT |
| Filtrado tenant-scoped | `src/lib/tenant/scope.ts` (`scopedQuery`), WS-MT |
| Signed URLs | `src/lib/planogram/storage.ts:44-74` (`getSignedUrl`, `getSignedUrls`, TTL 1800) |
| Tipos | `src/types/incidence.ts` (`IncidenceFilters:80-89`, `IncidenceRecord:46-70`, `Incidence:20-30`) |
| Gate + loading + GateScreen | `src/app/demo/page.tsx:133-143` |
| Layout raíz + header + user-bar | `src/app/demo/page.tsx:150-273` |
| Spinner / error card / StatusDot | `src/app/demo/page.tsx:207-213`, `:258-262`, `:276-279` |
| Tabla (`.table thead/tbody`) | `src/app/demo/page.tsx:466-483` |
| Hook de auth | `src/hooks/useEmailGate.ts:12-63` (expone `loading,email,error,submitEmail,clearSession`) |
| Clases CSS disponibles | `src/app/globals.css:27-99` (`.card .btn .btn--primary/secondary/small .badge .badge--red/yellow/blue/green/neutral .table .spinner .drop-zone`) |
| Upload de planograma (patrón) | `src/app/api/planogram/upload/route.ts` |

## Tareas

### Tarea 1: `GET /api/planogram/incidences` (TDD)

Contract exacto = `spec/02-reference-comparison.md` § "WS-D … O3".

- [ ] **Step 1: Test que falle.** En
  `src/app/api/planogram/__tests__/incidences.test.ts` — casos:
  - `client_user`: filas devueltas SOLO de su `client_id` aunque el query mande
    `clientId=OTRO` (assert no leak).
  - `reseller_admin` con `clientId=X`: filas de su cuenta filtradas a X.
  - `bbm_admin` sin scope: todas.
  - paginación: `total` refleja count sin limit/offset; `limit` clamp a `[1,200]`.
  - email sin fila en `bbm_users` → 403.
  Mockear `resolveSession`, `scopedQuery` (verificar que se llama con la sesión) y
  el query builder de supabase (fake builder que registra `.eq` como en
  `src/lib/tenant/__tests__/scope.test.ts`).

- [ ] **Step 2: Verificar FAIL.** `npm test src/app/api/planogram/__tests__/incidences.test.ts`

- [ ] **Step 3: Implementar el route.** Estructura (molde
  `list/route.ts:17`): leer cookie → `verifyCookie` (401) →
  `resolveSession(email, supabase)` (null → 403) → `!supabase` 503. Parsear y
  clampear los query params del contrato O3. Construir la query a `bbm_incidences`
  (select de las columnas proyectadas del contrato), aplicar filtros, **pasar el
  builder por `scopedQuery(builder, session, { requestedClientId })`**, aplicar
  `range(offset, offset+limit-1)` y `order('photo_captured_at', sort)`. Calcular
  `total` con un segundo query `count: 'exact', head: true` igualmente scopeado.
  Responder `{ rows, total, limit, offset }`.

- [ ] **Step 4: Verificar PASS.** Reportar `N/N`.
- [ ] **Step 5: tsc + lint.** `npx tsc --noEmit && npm run lint`
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/app/api/planogram/incidences/route.ts src/app/api/planogram/__tests__/incidences.test.ts
  git commit -m "feat(dashboard): GET incidences tenant-scoped + paginación"
  ```

### Tarea 2: `GET /api/planogram/incidences/[id]` (TDD)

- [ ] **Step 1: Test que falle:** id de otro tenant → **404** (no 403, no revelar
  existencia); id propio → `IncidenceRecord` completo + `incidences[]` + arrays
  `fieldPhotoUrls`/`planogramUrl` (signed). Mock `getSignedUrls`.
- [ ] **Step 2: Verificar FAIL.**
- [ ] **Step 3: Implementar:** misma auth+session. Fetch fila por id **scopeada**
  (si `scopedQuery` la excluye → 404). Generar signed URLs con
  `getSignedUrls(field_photo_paths, 1800)` + `getSignedUrl(planogram.storage_path,
  1800)`. Nunca devolver paths crudos ni URLs persistidas.
- [ ] **Step 4: Verificar PASS.**
- [ ] **Step 5: tsc + lint.**
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/app/api/planogram/incidences/[id]/route.ts src/app/api/planogram/__tests__/incidences.test.ts
  git commit -m "feat(dashboard): GET incidence detail + signed URLs, 404 cross-tenant"
  ```

### Tarea 3: `POST /api/planogram/assign` (C11) (TDD)

- [ ] **Step 1: Test que falle:** body `{ planogram_id, form_id }`. Casos:
  asignación nueva → upsert `onConflict:'planogram_id'`; `form_id` ya usado por
  otro planograma → **409** con mensaje del contrato C11; planograma de otro
  tenant → 404; sin sesión válida → 403.
- [ ] **Step 2: Verificar FAIL.**
- [ ] **Step 3: Implementar** en `src/app/api/planogram/assign/route.ts`: auth +
  session; verificar que el `planogram_id` pertenece al tenant (scopeado, si no →
  404); chequear `bbm_planogram_assignments` por `form_id` existente en otro
  planograma → 409; upsert `{ planogram_id, form_id }` con
  `onConflict:'planogram_id'`.
- [ ] **Step 4: Verificar PASS.**
- [ ] **Step 5: tsc + lint.**
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/app/api/planogram/assign/route.ts src/app/api/planogram/__tests__/assign.test.ts
  git commit -m "feat(dashboard): POST assign form_id↔planograma (1:1, C11)"
  ```

### Tarea 4: Hook `useDashboard.ts`

- [ ] **Step 1:** Crear `src/hooks/useDashboard.ts` (patrón
  `src/hooks/useEmailGate.ts:12-63`). Expone:
  `{ rows, total, loading, error, filters, setFilters, page, setPage, selectedClientId, setSelectedClientId, detail, openDetail, closeDetail }`.
  - `filters` = forma de `IncidenceFilters`. `setFilters` re-fetchea
    `GET /api/planogram/incidences` con los params del contrato O3.
  - `openDetail(id)` → `GET /api/planogram/incidences/[id]`.
  - Maneja loading/error como `useEmailGate` (no lanzar; exponer `error` string).
- [ ] **Step 2: Test:** `src/hooks/__tests__/useDashboard.test.ts` con `fetch`
  mockeado: setFilters dispara fetch con los params correctos; error de red →
  `error` set, no throw.
- [ ] **Step 3:** `npm test` + `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/hooks/useDashboard.ts src/hooks/__tests__/useDashboard.test.ts
  git commit -m "feat(dashboard): hook useDashboard (filtros, paginación, detalle)"
  ```

### Tarea 5: UI `/dashboard`

> Replica el patrón visual de `src/app/demo/page.tsx` (inline styles + CSS vars,
> `"use client"`, gate con `useEmailGate`). NO Tailwind.

- [ ] **Step 1:** `src/app/dashboard/page.tsx` (`"use client"`):
  - Gate: igual que `demo/page.tsx:133-143` (`useEmailGate`); si `!email` →
    `GateScreen`.
  - **Selector de cliente por rol:** el endpoint o un `GET /api/planogram/list`
    informan el rol; si `reseller_admin`/`bbm_admin` renderizar un `<select>` de
    clientes (alimenta `selectedClientId` → param `clientId`); si `client_user`
    NO renderizar selector.
  - **Barra de filtros:** rango de fechas, promotor, tienda (inputs/select),
    severidad mínima, estado. Cambios → `setFilters`.
  - **4 tarjetas resumen** (`.card`): total incidencias, críticas, altas,
    pendientes (derivadas de `rows`/`total`).
  - **Tabla** (molde `demo/page.tsx:466-483`, clases `.table`): columnas EXACTAS
    del contrato design-system (Fecha · [Cliente si rol≠client_user] · Promotor ·
    Tienda · Críticas · Altas · Medias · Bajas · Estado · Resumen). Severidad →
    badge según mapeo cerrado (`critical→.badge--red`, `high→.badge--yellow`,
    `medium→.badge--blue`, `low→.badge--neutral`, 0→`—` muted). Estado → badge
    (`completed→green`, `processing→yellow`, `pending→neutral`, `failed→red`).
    Fecha formateada con `Intl.DateTimeFormat('es-MX',{ timeZone:
    'America/Mexico_City', dateStyle:'medium', timeStyle:'short' })` (O1).
  - **Click en fila → detalle:** panel/modal con planograma + fotos (signed URLs
    del endpoint detail) + `incidences[]` con badges de severidad.
  - **3 empty states** exactamente como el contrato O4 (sin planograma /
    sin incidencias procesadas / filtros sin match), con sus CTAs.
  - **Paginación:** botones prev/next usando `total`/`limit`/`offset`.
  - Loading → `.spinner` (molde `:207-213`); error → `.card` con
    `borderColor: var(--accent-red)` (molde `:258-262`).
- [ ] **Step 2: Verificación en navegador (obligatoria, no claim sin prueba).**
  Levantar `npm run dev`, abrir `/dashboard`, verificar con el flujo de
  `preview_*`: render sin errores de consola, tabla con datos mock o empty state
  correcto, filtros disparan fetch, detalle abre con imágenes. Adjuntar screenshot.
  Si no se puede testear en navegador, **decirlo explícitamente** (no afirmar
  "funciona").
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/app/dashboard/page.tsx
  git commit -m "feat(dashboard): UI /dashboard (filtros, tabla, detalle, empty states)"
  ```

### Tarea 6: UI `/dashboard/planograms` + CSS

- [ ] **Step 1:** `src/app/dashboard/planograms/page.tsx`: grid de planogramas
  activos (thumbnail vía signed URL + nombre + fecha), zona drag&drop de upload
  (molde `demo/page.tsx:164-203`, reusa `POST /api/planogram/upload`), y por cada
  planograma el bloque de **asignación de form_id** del contrato C11 (input +
  "Guardar asignación" → `POST /api/planogram/assign`; badges "Sin formulario"
  `.badge--yellow` / "form: <id>" `.badge--green`; 409 inline).
- [ ] **Step 2:** `src/app/globals.css`: agregar (O5) — `.table tbody tr:hover {
  background: var(--bg-subtle, …) }` y `.table thead th { position: sticky; top:
  0; background: … }`. NO romper las clases existentes (`:81-83`).
- [ ] **Step 3: Navegador:** verificar upload + asignación + 409 visible.
  Screenshot. Si no testeable, decirlo.
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint`.
- [ ] **Step 5: Commit local.**
  ```bash
  git add src/app/dashboard/planograms/page.tsx src/app/globals.css
  git commit -m "feat(dashboard): /dashboard/planograms (upload + asignación form) + CSS"
  ```

## Criterios de aceptación

- [ ] `client_user` ve SOLO su cliente; `reseller_admin` ve los de su cuenta
      (con selector); `bbm_admin` ve todo — verificado por tests de los endpoints.
- [ ] id de otra tenencia → 404 (no revela existencia).
- [ ] Paginación offset/limit funciona; `total` correcto; `limit` clamp `[1,200]`.
- [ ] Fechas renderizadas en `America/Mexico_City`.
- [ ] Badges y columnas exactamente según contrato design-system; 3 empty states.
- [ ] Signed URLs on-the-fly (TTL 1800), nunca paths crudos ni URLs persistidas.
- [ ] `npm test` `N/N`, `npx tsc --noEmit` exit 0, `npm run lint` exit 0.
- [ ] Dashboard verificado en navegador (screenshot) o ausencia de verificación
      declarada explícitamente.
- [ ] Demo/onboarding/API producción siguen funcionando (no breaking).

## Comandos de verificación (para /accept)

```bash
npm test
npx tsc --noEmit
npm run lint
git log --oneline main..HEAD
git diff main..HEAD -- src/app/dashboard src/app/api/planogram src/hooks src/app/globals.css
grep -n "tailwind" src/app/dashboard/page.tsx src/app/dashboard/planograms/page.tsx && echo "VIOLATION: Tailwind" || echo "OK sin Tailwind"
grep -n "scopedQuery" src/app/api/planogram/incidences/route.ts || echo "VIOLATION: endpoint sin scoping"
git diff --name-only main..HEAD | grep -E '\.env|secrets|credentials' && echo "VIOLATION" || echo "OK"
```

## Safety rails

- **NO** Tailwind ni librerías UI/estado nuevas.
- **NO** modificar `src/app/demo/page.tsx`, `src/lib/cookie.ts`, el pipeline ni el
  esquema.
- **NO** devolver paths de Storage crudos ni persistir signed URLs.
- **NO** `git push`, **NO** `rm -rf`, **NO** `git reset --hard` ajeno.
- **NO** tocar `.env`/secrets; **NO** llamadas externas reales en tests (mock).

## Notas para el worker (ejecutor de la spec)

- El contrato de endpoints/timezone/badges/empty-states está cerrado en
  `spec/02-reference-comparison.md` § WS-D — seguilo literal, no reinterpretes.
- TODA query de datos pasa por `scopedQuery`. Un endpoint sin scoping es bug
  bloqueante (es la superficie de leak).
- UI: replicá el patrón de `demo/page.tsx`, no inventes estética nueva.
- Verificación en navegador obligatoria para la UI; si no podés, declaralo — no
  afirmes "funciona" sin prueba.
- Commit local por tarea. Self-review: `npm test` + `tsc` + `lint` verdes.
