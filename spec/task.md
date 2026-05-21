# Task Checklist — WS2 (Dashboard Frontend) y WS3 (Export Excel)

## Fase 1: Configuración y Modelos de Datos (WS2)
- [x] **Tarea 0b:** Modificar `src/app/api/planogram/upload/route.ts` para resolver, validar y estampar `client_id` de tenencia en `bbm_planograms`.
- [x] **Tarea 0:** Extender `IncidenceFilters` e `IncidenceRecord` en `src/types/incidence.ts`.
  - [x] Paso 1: Agregar `clientId?: string` y `sort?: 'captured_desc' | 'captured_asc'` a `IncidenceFilters`.
  - [x] Paso 2: Agregar `client_id?: string | null` a `IncidenceRecord`.
  - [x] Paso 3: Validar que `npx tsc --noEmit` pase.
  - [x] Paso 4: Hacer commit local de la Tarea 0.

## Fase 2: APIs de Backend y Cobertura TDD (WS2)
- [x] **Tarea 1:** `GET /api/planogram/clients` + tests.
  - [x] Paso 1: Crear tests unitarios en `src/app/api/planogram/__tests__/clients.test.ts`.
  - [x] Paso 2: Ejecutar y verificar que los tests fallen.
  - [x] Paso 3: Crear el endpoint en `src/app/api/planogram/clients/route.ts` con `resolveSession` y `scopedQuery`.
  - [x] Paso 4: Ejecutar tests y verificar que pasen.
  - [x] Paso 5: Validar con `tsc` y linter.
  - [x] Paso 6: Hacer commit local.
- [x] **Tarea 2a:** `GET /api/planogram/incidences` + tests.
  - [x] Paso 1: Crear tests unitarios en `src/app/api/planogram/__tests__/incidences.test.ts` (paginación, clamping, tenant-scoping).
  - [x] Paso 2: Ejecutar y verificar que los tests fallen.
  - [x] Paso 3: Crear el endpoint en `src/app/api/planogram/incidences/route.ts` aplicando `scopedQuery` y paginación.
  - [x] Paso 4: Ejecutar tests y verificar que pasen.
  - [x] Paso 5: Validar con `tsc` y linter.
  - [x] Paso 6: Hacer commit local.
- [x] **Tarea 2b:** `GET /api/planogram/incidences/[id]` + tests.
  - [x] Paso 1: Añadir tests para el detalle de incidencia (signed URLs y **HTTP 404** ante acceso cruzado).
  - [x] Paso 2: Verificar que fallen.
  - [x] Paso 3: Crear el endpoint en `src/app/api/planogram/incidences/[id]/route.ts`.
  - [x] Paso 4: Verificar que pasen.
  - [x] Paso 5: Validar con `tsc` y linter.
  - [x] Paso 6: Hacer commit local.
- [x] **Tarea 3:** `POST /api/planogram/assign` + tests.
  - [x] Paso 1: Crear tests unitarios en `src/app/api/planogram/__tests__/assign.test.ts` (asignación 1:1, duplicados HTTP 409, cross-tenant HTTP 404).
  - [x] Paso 2: Verificar que fallen.
  - [x] Paso 3: Crear el endpoint en `src/app/api/planogram/assign/route.ts`.
  - [x] Paso 4: Verificar que pasen.
  - [x] Paso 5: Validar con `tsc` y linter.
  - [x] Paso 6: Hacer commit local.

## Fase 3: Lógica y UI del Cliente (WS2 Frontend)
- [x] **Tarea 4:** Hook de React `useDashboard.ts` + tests.
  - [x] Paso 1: Crear hook `src/hooks/useDashboard.ts`.
  - [x] Paso 2: Crear suite de tests `src/hooks/__tests__/useDashboard.test.ts` con fetch mockeado.
  - [x] Paso 3: Validar que `npm test` y `tsc` compilen al 100%.
  - [x] Paso 4: Hacer commit local.
- [ ] **Tarea 5:** Vista principal `/dashboard` (gate de login, selector de clientes por rol, tabla con row-hover, modal detalle, 3 empty states y paginación).
- [ ] **Tarea 6:** Vista `/dashboard/planograms` (grid de planogramas con thumbnails seguros, drag&drop de subida, y formulario de asignación de `form_id`).
- [ ] **Tarea 7:** Estilos CSS avanzados (sticky headers, table row hover) en `src/app/globals.css`.

## Fase 4: Exportación de Reportes a Excel (WS3)
- [ ] **Tarea 8:** Builder de Excel con 4 hojas (`src/lib/exports/incidences-excel.ts`) + tests.
  - [ ] Paso 1: Crear suite de pruebas `src/lib/exports/__tests__/incidences-excel.test.ts` (nombres de hojas, pivotes y sanitización de celdas).
  - [ ] Paso 2: Exportar la función `sanitize` en `src/lib/exports/excel.ts`.
  - [ ] Paso 3: Codificar el generador de libro `buildIncidencesWorkbook` importando y sanitizando celdas de texto.
  - [ ] Paso 4: Ejecutar tests y validar exit 0.
- [ ] **Tarea 9:** Endpoint `GET /api/planogram/export` + tests.
  - [ ] Paso 1: Crear suite de pruebas `src/app/api/planogram/__tests__/export.test.ts` (restricción por tenant, tope de 5,000 registros, cabeceras del archivo).
  - [ ] Paso 2: Implementar la ruta `/api/planogram/export/route.ts` con `resolveSession` y `scopedQuery`.
  - [ ] Paso 3: Ejecutar y verificar pruebas.
- [ ] **Tarea 10:** Integración de descarga en la UI del Dashboard.
  - [ ] Paso 1: Añadir el botón "Exportar Excel" en la barra de filtros de `/dashboard/page.tsx`.
  - [ ] Paso 2: Construir los query params en el click usando `URLSearchParams` y redirigir el href de descarga.
  - [ ] Paso 3: Probar manual de extremo a extremo en el navegador y adjuntar evidencias.
