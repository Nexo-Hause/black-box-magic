# Plan de Implementación — WS2 (Dashboard Frontend) y WS3 (Export Excel)

Este plan unificado describe la estrategia de implementación para construir el Dashboard de Incidencias de Planogramas de Fruit of the Loom (FOTL) y el endpoint de exportación a Excel. Ambos componentes están estrictamente protegidos y aislados por tenencia a nivel de aplicación (`resolveSession` + `scopedQuery`), garantizando que Carlos (FOTL), Enrique (Ubiqo) y BBM Admins puedan operar de manera segura.

---

## 1. Contexto y Estado Actual

* **Backend WS2 (Dashboard API) [100% COMPLETADO]:** Los endpoints de backend para el listado de clientes (`clients/route.ts`), listado de incidencias paginado (`incidences/route.ts`), detalle de incidencia con URLs firmadas (`incidences/[id]/route.ts`) y asignación de planograma (`assign/route.ts`) ya están completamente codificados y cubiertos por pruebas unitarias robustas en Vitest. `npx tsc --noEmit` y `npm test` están al 100% en verde.
* **Fase 2: Frontend del Dashboard [PENDIENTE]:** Falta crear la UI del Dashboard principal (`/dashboard`), el grid y controles de planogramas (`/dashboard/planograms`), el hook de React (`useDashboard.ts`) y las mejoras de estilo globales en `globals.css` (cero Tailwind CSS).
* **Fase 3: Export Excel (WS3) [PENDIENTE]:** Falta implementar el generador de Excel de 4 hojas sanitizado contra CSV Injection (`src/lib/exports/incidences-excel.ts`), el endpoint de backend `GET /api/planogram/export` y el botón de descarga en la barra de filtros del Dashboard.

---

## 2. User Review Required

> [!IMPORTANT]
> **Integración Unificada de Fase 2 (Dashboard) y Fase 3 (Export Excel):**
> Para entregar un producto completamente funcional y listo para que Carlos (FOTL) lo accione con sus promotores, integraremos el desarrollo del **Frontend del Dashboard (WS2)** y la **Exportación a Excel (WS3)** de forma conjunta. Esto evita duplicación de flujos de prueba en el navegador.

> [!WARNING]
> **Defensa Defensiva contra Inyección de Fórmulas y Abuso de Memoria en Exportación (WS3):**
> 1. **Tope de Registros:** Para proteger la memoria del entorno serverless de Vercel (límite de 1GB), implementaremos un límite defensivo estricto de **5,000 registros**. Si una consulta excede este límite, el API retornará de forma elegante un **HTTP 413 Payload Too Large** con el mensaje `"Demasiadas filas; aplicá más filtros"`.
> 2. **Sanitización de Celdas:** Todas las celdas de tipo texto generadas en el Excel pasarán por la función `sanitize` de `excel.ts` que escapa con una comilla simple (`'`) cualquier celda que comience con caracteres de control de fórmulas (`=`, `+`, `-`, `@`, `\t`, `\r`) para evitar ataques de CSV Injection / DDE en Microsoft Excel.

---

## 3. Open Questions

Actualmente **no hay preguntas abiertas**. Todas las decisiones críticas de negocio y diseño (Husos horarios en `America/Mexico_City`, la relación de asignación 1:1 de planograma ↔ formulario y los 3 Empty States de la interfaz) se encuentran completamente resueltas.

---

## 4. Cambios Propuestos

### A. Capa de Frontend (Fase 2 - Dashboard)

#### [NEW] [useDashboard.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/hooks/useDashboard.ts)
* Hook personalizado de React para coordinar el estado del dashboard:
  * Estados: `rows`, `total`, `loading`, `error`, `filters` (tipo `IncidenceFilters`), `page`, `clients`, `selectedClientId`, `detail`.
  * Acciones: `setFilters`, `setPage`, `openDetail(id)` (fetch del detalle de incidencia), `closeDetail()`.
  * Inicialización: Carga los clientes en el montaje (`GET /api/planogram/clients`). Si es un `client_user` (FOTL, 1 solo cliente retornado), inicializa `selectedClientId` con su ID y no requiere dropdown en la UI.

#### [NEW] [useDashboard.test.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/hooks/__tests__/useDashboard.test.ts)
* Suite de pruebas para `useDashboard` con mocks de `fetch` para asegurar que el cambio de filtros y página dispare las llamadas correspondientes con los parámetros sanitizados del contrato O3.

#### [NEW] [page.tsx](file:///c:/Users/gleon/Projects/black-box-magic/src/app/dashboard/page.tsx)
* Vista principal `/dashboard` (usando `"use client"`):
  * **Gate de Autenticación:** Incorporar `useEmailGate` y un componente local `GateScreen` que replique exactamente la estética, variables CSS y el markup de `.gate-*` del login seguro de `/demo`.
  * **Selector de Clientes:** Renderizar dropdown sólo si `clients.length > 1` (reseller/bbm_admin).
  * **Barra de Filtros:** Inputs interactivos para rango de fechas, promotor, tienda, severidad mínima y estado. Añade el botón `.btn--secondary` para "Exportar Excel" (Fase 3).
  * **Tarjetas Resumen:** 4 cards mostrando el total de incidencias, críticas, altas y pendientes.
  * **Tabla de Resultados:** Columnas canónicas (Fecha, [Cliente si es admin/reseller], Promotor, Tienda, Críticas, Altas, Medias, Bajas, Estado, Resumen) con row-hover. Fechas en zona horaria `America/Mexico_City`.
  * **Empty States (O4):** Renderizado condicional para:
    1. Sin planogramas cargados (con botón/CTA de redirección).
    2. Sin incidencias procesadas (espera silenciosa).
    3. Sin resultados para filtros actuales (con botón de restablecer filtros).
  * **Modal de Detalle:** Panel que se abre al dar click en una fila, cargando fotos firmadas on-the-fly de la incidencia y la imagen del planograma de referencia.

#### [NEW] [page.tsx](file:///c:/Users/gleon/Projects/black-box-magic/src/app/dashboard/planograms/page.tsx)
* Vista `/dashboard/planograms` (usando `"use client"`):
  * Grid de planogramas cargados mostrando sus nombres, fecha de subida y miniatura segura.
  * Zona drag&drop reutilizando el endpoint de subida `POST /api/planogram/upload`.
  * Sección de asignación interactiva por planograma: `<input>` para el `form_id` y botón para enviar a `/api/planogram/assign` con badges de estado y manejo elegante de error 409 (duplicados de asignación).

#### [MODIFY] [globals.css](file:///c:/Users/gleon/Projects/black-box-magic/src/app/globals.css)
* Agregar clases avanzadas de tabla (cero Tailwind CSS):
  * `.table tbody tr:hover` para retroalimentación de hover.
  * Sticky headers (`position: sticky`, `top: 0`) para las cabeceras de la tabla al realizar scroll vertical, heredando el color de fondo canónico de `:root`.

---

### B. Capa de Exportación (Fase 3 - Export Excel)

#### [MODIFY] [excel.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/exports/excel.ts)
* Agregar el modificador `export` a la función `sanitize(value: unknown)` para que pueda ser importada de forma centralizada por el generador de incidencias. Ningún otro cambio está permitido en este archivo molde.

#### [NEW] [incidences-excel.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/exports/incidences-excel.ts)
* Implementar `buildIncidencesWorkbook(rows: IncidenceRecord[]): XLSX.WorkBook` usando SheetJS (`xlsx`).
* Genera un libro de Excel con 4 hojas exactas:
  1. **Resumen:** 1 fila por comparación (Fecha `es-MX`, Promotor, Tienda, Críticas, Altas, Medias, Bajas, Resumen).
  2. **Incidencias:** 1 fila por incidencia encontrada (Comparación ID, Categoría, Severidad, Producto, Descripción, Ubicación).
  3. **Por Promotor:** Pivot agregando total de comparaciones y recuento de severidades por promotor.
  4. **Por Tienda:** Pivot agregando total de comparaciones y recuento de severidades por tienda.
* **Obligatorio:** Cada celda de tipo string pasa por la función `sanitize` importada de `@/lib/exports/excel`.

#### [NEW] [incidences-excel.test.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/exports/__tests__/incidences-excel.test.ts)
* Suite de pruebas unitarias para `buildIncidencesWorkbook`:
  * Validar nombres exactos de las 4 hojas.
  * Validar agregación correcta de promotores y tiendas.
  * Validar la sanitización de celdas con fórmulas peligrosas analizando la estructura cruda de la celda en el objeto `WorkSheet` (ej: `ws['B2'].v`).

#### [NEW] [route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/planogram/export/route.ts)
* Endpoint `GET /api/planogram/export` tenant-scoped.
* **Seguridad y Tenencia:** Valida sesión con `verifyCookie` y `resolveSession`. Ejecuta query a `bbm_incidences` scopeado obligatoriamente por `scopedQuery` usando el tenant del usuario.
* **Filtros:** Aplica los mismos filtros que `/api/planogram/incidences` (fecha, promotor, tienda, severidad, estado).
* **Control de Carga:** Si la query arroja más de 5,000 registros, retorna de inmediato **HTTP 413**.
* **Generación:** Escribe el libro con `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })` y responde con cabeceras `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment; filename="incidencias-*.xlsx"`.

#### [NEW] [export.test.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/planogram/__tests__/export.test.ts)
* Suite de pruebas de integración para el API de exportación:
  * Validar que un `client_user` no pueda exportar datos de otra tenencia (prevención de leaks).
  * Validar retorno de HTTP 413 si excede los 5,000 registros.
  * Validar cabeceras y tipo de archivo correcto.
  * Validar respuesta HTTP 403 para email no registrado.

---

## 5. Plan de Verificación y QA

### Pruebas Automatizadas (Vitest)
Correremos toda la suite de pruebas del proyecto para asegurar cero regresiones:
```bash
# Pruebas de API y Backend
npm test src/app/api/planogram/__tests__/

# Pruebas del Builder de Excel (WS3)
npm test src/lib/exports/__tests__/

# Pruebas del Hook de Dashboard (WS2)
npm test src/hooks/__tests__/useDashboard.test.ts
```

### Aseguramiento del Tipado y Calidad
```bash
# Compilación sin errores
npx tsc --noEmit

# Linter limpio
npm run lint
```

### Verificación Manual en Navegador (Paso a Paso)
1. Levantar servidor local: `npm run dev`.
2. Acceder a `/dashboard` y loguearse con `carlos@fotl.com` (client_user).
3. Verificar que no haya selector de clientes (sólo FOTL está visible).
4. Comprobar que los empty states funcionen si no hay registros.
5. Aplicar filtros de tienda/promotor, presionar "Exportar Excel" y comprobar la descarga del archivo.
6. Abrir el archivo `.xlsx` en Microsoft Excel o visor web y verificar las 4 hojas sanitizadas.
7. Loguearse como `enrique@ubiqo.com` (reseller_admin) y verificar que se muestre el selector de clientes con las opciones de tenencia correctas.
8. Acceder a `/dashboard/planograms` y validar subida de planograma y asignación de `form_id` con badges.

---

## 6. Auditoría Pre-Implementación (Fase 3 de la Auditoría)

**Fecha:** 2026-05-21
**Resultado global:** ✅ Aprobado con Cambios (Plan integrado y mitigaciones de seguridad incorporadas al diseño)

### Hallazgos Críticos Resueltos en Diseño (🔴)
1. **Riesgo de Cross-Tenant Leakage en la Exportación:** Un atacante astuto podría cambiar los parámetros de consulta `clientId` en la ruta `/api/planogram/export` para descargar los datos de otro cliente.
   * *Mitigación:* Se obliga a que el endpoint de exportación utilice exactamente el helper `scopedQuery` pasándole la sesión del usuario resuelta en el backend. Los `client_user` tienen prohibido solicitar otro cliente, y los `reseller_admin` quedan restringidos al scope de su `account_id`.
2. **Abuso de Memoria por Data Set Masivo:** Generar archivos de Excel masivos en memoria dentro de funciones serverless de Vercel puede causar caídas OOM (Out Of Memory).
   * *Mitigación:* Establecemos un límite técnico riguroso de 5,000 registros en la base de datos para la exportación. Si se excede, el servidor no procesa y retorna HTTP 413.
3. **Inyección CSV/DDE en Excel:** Si un promotor ingresa un nombre malicioso como `=cmd|' /C calc'!A1`, al abrir el Excel se podría ejecutar código arbitrario en la máquina del cliente.
   * *Mitigación:* Se implementa mandatoriamente el paso por la función `sanitize` en toda celda de tipo string de las 4 hojas generadas.

### Observaciones (⚠️)
1. **Exportación de Fórmulas y Fechas:** El huso horario para el formateo de las fechas de exportación debe alinearse canónicamente con la decisión de negocio de usar `America/Mexico_City`. Se implementará con `Intl.DateTimeFormat` forzando ese timezone.

### Riesgos Residuales
* **Volumen intermedio de registros (1,000 a 4,999):** La generación de hasta 5,000 registros de 4 hojas consume aproximadamente ~5-15MB de memoria RAM, lo cual es perfectamente seguro para el límite de 1,024MB de Vercel. No hay riesgos residuales de memoria ni de seguridad detectados.
