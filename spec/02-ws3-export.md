# Spec 02-WS3 — Export Excel (Fase 3, tenant-scoped)

## Objetivo

`GET /api/planogram/export` que genera un Excel de 4 hojas con las mismas
incidencias que ve el usuario (mismos filtros, mismo aislamiento por tenant), y un
botón en `/dashboard` que lo descarga.

## Contexto

Carlos necesita llevarse las incidencias a Excel para accionarlas con promotores.
El contrato de filtros = el mismo de `GET /api/planogram/incidences` (cerrado en
`spec/02-reference-comparison.md` § WS-D O3); O6 decidió: export filtrable por
promotor/tienda en el mismo endpoint, no uno separado. El patrón de generación de
workbook ya existe en `src/lib/exports/excel.ts` (SheetJS `xlsx`, con `sanitize()`
anti-CSV-injection). El aislamiento usa `scopedQuery`/`resolveSession` de WS-MT.
Prereq: WS2 completo.

## Alcance

**Incluye:**
- `src/lib/exports/incidences-excel.ts`: builder de las 4 hojas.
- `GET /api/planogram/export`: auth + session + scoping + mismos filtros que
  `incidences` → workbook → respuesta `.xlsx`.
- Botón "Exportar Excel" en `/dashboard` que respeta los filtros activos.
- Actualizar `CLAUDE.md` y `.env.example`.

**No incluye:**
- No cambiar `src/lib/exports/excel.ts` (es molde, se reusa su patrón; no se edita).
- No PDF ni otros formatos.
- No tocar el pipeline, auth core, esquema, ni el endpoint `incidences` de WS2.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/lib/exports/incidences-excel.ts` | Crear |
| `src/lib/exports/__tests__/incidences-excel.test.ts` | Crear |
| `src/app/api/planogram/export/route.ts` | Crear |
| `src/app/api/planogram/__tests__/export.test.ts` | Crear |
| `src/app/dashboard/page.tsx` | Modificar (botón export) |
| `CLAUDE.md` | Modificar (documentar endpoint) |
| `.env.example` | Modificar (si aplica algún env nuevo; probablemente ninguno) |

## Molde de referencia (leer, no editar)

| Patrón | Archivo:línea |
|---|---|
| `aoa_to_sheet`, `book_new`, `book_append_sheet` | `src/lib/exports/excel.ts:20-96` |
| `sanitize()` anti CSV-injection (obligatorio en cada celda string) | `src/lib/exports/excel.ts:6-17` |
| Auth + session + scoping en route | `src/app/api/planogram/incidences/route.ts` (WS2) |
| Filtros (contract O3) | `spec/02-reference-comparison.md` § WS-D O3 |
| Tipos | `src/types/incidence.ts` (`IncidenceRecord:46-70`, `Incidence:20-30`) |
| Helper de scoping | `src/lib/tenant/scope.ts` (`scopedQuery`), WS-MT |

## Tareas

### Tarea 1: Builder de las 4 hojas (TDD)

Hojas (de `spec/02-reference-comparison.md:243-249`):
1. **Resumen** — 1 fila por comparación: fecha, promotor, tienda, críticas, altas,
   medias, bajas, resumen.
2. **Incidencias** — 1 fila por incidencia: comparación_id, categoría, severidad,
   producto, descripción, ubicación.
3. **Por Promotor** — pivot: promotor | total | críticas | altas | medias | bajas.
4. **Por Tienda** — pivot: tienda | total | críticas | altas | medias | bajas.

- [ ] **Step 1: Test que falle.** En
  `src/lib/exports/__tests__/incidences-excel.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import * as XLSX from 'xlsx';
  import { buildIncidencesWorkbook } from '@/lib/exports/incidences-excel';

  const rows = [
    { id: 'r1', photo_captured_at: '2026-05-01T10:00:00Z', promoter_name: 'Ana',
      store_name: 'Tienda A', severity_critical: 1, severity_high: 0,
      severity_medium: 2, severity_low: 0, summary: 'ok',
      incidences: [{ id: 'i1', category: 'missing_product', severity: 'critical',
        product: 'P1', description: 'falta', location: 'E2' }] },
    { id: 'r2', photo_captured_at: '2026-05-02T10:00:00Z', promoter_name: 'Ana',
      store_name: 'Tienda B', severity_critical: 0, severity_high: 1,
      severity_medium: 0, severity_low: 0, summary: 'x', incidences: [] },
  ];

  describe('buildIncidencesWorkbook', () => {
    it('genera 4 hojas con los nombres exactos', () => {
      const wb = buildIncidencesWorkbook(rows as any);
      expect(wb.SheetNames).toEqual(['Resumen', 'Incidencias', 'Por Promotor', 'Por Tienda']);
    });
    it('Por Promotor agrega por promotor (Ana: total 2)', () => {
      const wb = buildIncidencesWorkbook(rows as any);
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Por Promotor'], { header: 1 });
      const ana = (aoa as any[]).find(r => r[0] === 'Ana');
      expect(ana).toBeTruthy();
      expect(ana[1]).toBe(2); // total comparaciones de Ana
    });
    it('sanitiza celdas con prefijo peligroso', () => {
      const wb = buildIncidencesWorkbook([{ ...rows[0], promoter_name: '=cmd()' }] as any);
      // Acceder a la celda CRUDA del workbook (sin sheet_to_json, que
      // deserializa y puede ocultar el escape). 'Resumen' col B (promotor) fila 2:
      // ajustar la celda exacta a la posición real de promoter_name en la hoja
      // Resumen según el orden de columnas implementado.
      const ws = wb.Sheets['Resumen'];
      const promoterCell = Object.keys(ws)
        .filter(k => !k.startsWith('!'))
        .map(k => ws[k])
        .find((c: any) => typeof c.v === 'string' && c.v.includes('cmd()'));
      expect(promoterCell).toBeTruthy();
      expect((promoterCell.v as string).startsWith('=')).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Verificar FAIL.** `npm test src/lib/exports/__tests__/incidences-excel.test.ts`
- [ ] **Step 3a: Exportar `sanitize`.** En `src/lib/exports/excel.ts`, agregar
  `export` a la declaración de `sanitize` (hoy `function sanitize(` en `:6-17` →
  `export function sanitize(`). Es el ÚNICO cambio permitido en ese archivo. NO
  replicar la función en otro lado (dos copias se desincronizan).
- [ ] **Step 3b: Implementar `buildIncidencesWorkbook(rows): XLSX.WorkBook`** en
  `src/lib/exports/incidences-excel.ts`, reusando el patrón de
  `src/lib/exports/excel.ts:20-96`: `aoa_to_sheet([headers, ...rows])` por hoja,
  `book_new()` + `book_append_sheet` con los 4 nombres exactos en orden. **Cada
  celda string pasa por `sanitize`** (`import { sanitize } from
  '@/lib/exports/excel'`). Fechas formateadas `es-MX`/`America/Mexico_City`.
- [ ] **Step 4: Verificar PASS.** Reportar `N/N`.
- [ ] **Step 5: tsc + lint.** `npx tsc --noEmit && npm run lint`
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/lib/exports/incidences-excel.ts src/lib/exports/__tests__/incidences-excel.test.ts
  git commit -m "feat(export): builder workbook 4 hojas (sanitizado)"
  ```

### Tarea 2: `GET /api/planogram/export` (TDD)

- [ ] **Step 1: Test que falle.** En
  `src/app/api/planogram/__tests__/export.test.ts`:
  - `client_user` exporta SOLO su cliente aunque mande `clientId` ajeno.
  - Mismos filtros que `incidences` (dateFrom/dateTo/promoter/store/minSeverity/
    status) aplicados.
  - Response: `Content-Type:
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y
    `Content-Disposition: attachment; filename="incidencias-*.xlsx"`.
  - email sin fila `bbm_users` → 403.
- [ ] **Step 2: Verificar FAIL.**
- [ ] **Step 3: Implementar el route** (molde
  `incidences/route.ts` de WS2): misma auth+session+`scopedQuery`, **mismos
  filtros que el contrato O3 pero SIN paginación** (export = todo el set filtrado;
  cap defensivo fijo: `if (count > 5000) return 413` con mensaje "Demasiadas
  filas; aplicá más filtros" (5000 es el valor, no "p.ej."). Llamar
  `buildIncidencesWorkbook(rows)`,
  `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`, devolver el buffer con
  los headers de arriba.
- [ ] **Step 4: Verificar PASS.** Reportar `N/N`.
- [ ] **Step 5: tsc + lint.**
- [ ] **Step 6: Commit local.**
  ```bash
  git add src/app/api/planogram/export/route.ts src/app/api/planogram/__tests__/export.test.ts
  git commit -m "feat(export): GET /api/planogram/export tenant-scoped"
  ```

### Tarea 3: Botón en el dashboard

- [ ] **Step 1:** En `src/app/dashboard/page.tsx` agregar botón
  `.btn--secondary` "Exportar Excel" en la barra de filtros. Al click, construir
  la querystring **explícitamente con `URLSearchParams`** desde el estado del hook
  (NO depende de ninguna función "serializadora" — no existe tal export):
  ```typescript
  const qs = new URLSearchParams();
  const f = filters; // IncidenceFilters del hook useDashboard
  if (f.dateFrom) qs.set('dateFrom', f.dateFrom);
  if (f.dateTo) qs.set('dateTo', f.dateTo);
  if (f.promoter) qs.set('promoter', f.promoter);
  if (f.store) qs.set('store', f.store);
  if (f.minSeverity) qs.set('minSeverity', f.minSeverity);
  if (f.status) qs.set('status', f.status);
  if (f.sort) qs.set('sort', f.sort);
  if (selectedClientId) qs.set('clientId', selectedClientId);
  window.location.href = `/api/planogram/export?${qs.toString()}`;
  ```
  (Los mismos campos del contrato O3 que usa `incidences`; el endpoint export
  los parsea idéntico.)
- [ ] **Step 2: Navegador (obligatorio):** levantar `npm run dev`, aplicar un
  filtro, click "Exportar Excel", confirmar que descarga un `.xlsx` y que el
  archivo abre con 4 hojas. Screenshot. Si no testeable, declararlo (no afirmar
  "funciona" sin prueba).
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint`.
- [ ] **Step 4: Commit local.**
  ```bash
  git add src/app/dashboard/page.tsx
  git commit -m "feat(export): botón Exportar Excel respeta filtros activos"
  ```

### Tarea 4: Documentación

- [ ] **Step 1:** `CLAUDE.md`: en la tabla de Archivos Clave / arquitectura,
  agregar `src/app/api/planogram/export/route.ts` y
  `src/lib/exports/incidences-excel.ts` con su responsabilidad (1 línea c/u).
- [ ] **Step 2:** `.env.example`: revisar si el export introduce algún env (lo
  normal: ninguno). Si no, no tocar. Si sí, documentarlo con comentario.
- [ ] **Step 3: Commit local.**
  ```bash
  git add CLAUDE.md .env.example
  git commit -m "docs(export): documenta endpoint export en CLAUDE.md"
  ```

## Criterios de aceptación

- [ ] Excel con 4 hojas exactas: `Resumen`, `Incidencias`, `Por Promotor`,
      `Por Tienda`.
- [ ] Export respeta los mismos filtros y el mismo aislamiento que `incidences`
      (sin fuga cross-cliente — verificado por test).
- [ ] Toda celda string sanitizada (CSV/DDE injection bloqueada).
- [ ] Botón en `/dashboard` descarga con los filtros activos.
- [ ] `npm test` `N/N`, `npx tsc --noEmit` exit 0, `npm run lint` exit 0.
- [ ] Verificado en navegador (screenshot) o ausencia de verificación declarada.
- [ ] `src/lib/exports/excel.ts` no modificado salvo, a lo sumo, exportar
      `sanitize`.

## Comandos de verificación (para /accept)

```bash
npm test
npx tsc --noEmit
npm run lint
git log --oneline main..HEAD
git diff main..HEAD -- src/lib/exports src/app/api/planogram/export src/app/dashboard/page.tsx CLAUDE.md
grep -n "scopedQuery" src/app/api/planogram/export/route.ts || echo "VIOLATION: export sin scoping"
git diff main..HEAD -- src/lib/exports/excel.ts   # debe ser vacío o solo 'export'
git diff --name-only main..HEAD | grep -E '\.env$|\.env\.local|secrets|credentials' && echo "VIOLATION" || echo "OK"
```

## Safety rails

- **NO** modificar `src/lib/exports/excel.ts` (salvo agregar `export` a `sanitize`).
- **NO** export sin `scopedQuery` (fuga cross-cliente = bug bloqueante).
- **NO** celdas sin `sanitize()`.
- **NO** `git push`, **NO** `rm -rf`, **NO** `git reset --hard` ajeno.
- **NO** tocar `.env`/secrets; **NO** llamadas externas reales en tests (mock).

## Notas para el worker (ejecutor de la spec)

- Filtros y aislamiento = idénticos al endpoint `incidences` de WS2; los params
  se construyen con el `URLSearchParams` literal del Step 1 (no hay función
  serializadora compartida — no la busques ni la inventes).
- `sanitize()` en cada celda string — es defensa contra CSV/DDE injection, no
  opcional.
- Verificación en navegador obligatoria para el botón; si no podés, declaralo.
- Commit local por tarea. Self-review: `npm test` + `tsc` + `lint` verdes.

---

## Auditoría pre-implementación

**Fecha:** 2026-05-18
**Resultado global:** Aprobado con cambios — críticos resueltos.

### Hallazgos críticos (resueltos)

1. **`sanitize` no exportada + dos caminos (exportar vs replicar).** Resuelto:
   Step 3a imperativo — agregar `export` a `sanitize` en `excel.ts` (único cambio
   permitido); rama "replicar" eliminada.
2. **"Serializador de `useDashboard`" no existe.** Resuelto: Step 1 ahora da el
   bloque `URLSearchParams` literal con los campos exactos de O3.

### Observaciones (decisión)

- Cap export → fijado `5000` imperativo (no "p.ej.").
- Test de sanitización → accede a la celda cruda del workbook
  (`ws[k].v`) en vez de `sheet_to_json` (evita deserialización que oculta el
  escape).
- Dependencia de WS2 (`incidences/route.ts`, `useDashboard`) bien declarada como
  prereq; el archivo no existe hasta WS2 — el ejecutor lee el prereq.

### Tests requeridos

| Tipo | Qué verificar | Prioridad |
|------|--------------|-----------|
| Unit | `buildIncidencesWorkbook`: 4 hojas, nombres exactos, pivots | Alta |
| Unit | sanitización de celda con prefijo peligroso (celda cruda) | Alta |
| Unit | `export` route: leak por rol, mismos filtros, headers xlsx, 413 | **Máxima** |
| Visibilidad | navegador: descarga `.xlsx`, abre con 4 hojas | Alta |

### Criterios de aceptación

Los de la sección arriba. `git diff src/lib/exports/excel.ts` = solo el `export`
agregado a `sanitize`. `grep scopedQuery` en el route export = presente.

### Riesgos residuales

- Cap 5000 sin fuente de requisito (es defensivo, no de negocio) — si Carlos
  necesita exportar más, se ajusta tras WS4. Bajo riesgo (memoria ~2MB OK en
  Vercel 1GB).
- Verificación en navegador depende de WS2 desplegado con datos; si no, declarar
  ausencia de verificación (no afirmar "funciona").
