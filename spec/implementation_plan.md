# Plan de Implementación — Onboarding Persistente, Multi-Tenant y sin Fricción

Este plan define el diseño técnico y de producto para el nuevo **Onboarding Automático e Interactivo** de Black Box Magic (BBM) y Ubiqo, adaptándose a los requerimientos de persistencia de datos, inicio de sesión sin fricción por correo, multi-tenancy aislado y recuperación del historial de prompts/versiones.

El sistema se unifica bajo el modelo de última generación **Gemini 3.5 Flash** para garantizar la máxima capacidad cognitiva de razonamiento y visión avanzada, manteniendo la latencia y los costos extremadamente bajos.

---

## User Review Required

> [!IMPORTANT]
> **Resumen de Cambios Críticos de Arquitectura:**
> 1. **Acceso sin Fricción (Eliminación de la dependencia exclusiva de Códigos):** Los clientes podrán crear nuevas sesiones de onboarding al vuelo ingresando su **Nombre/Empresa** y **Correo**, o reanudar sesiones previas ingresando únicamente su **Correo**, eliminando la necesidad de que un administrador genere un código en el panel de `/admin`.
> 2. **Persistencia Total del Sandbox:** Las fotos de prueba del sandbox de 100 fotos (incluyendo base64, estado de análisis, calificaciones de OK/NO y comentarios) se guardarán de manera incremental en Supabase dentro de `partial_config.sandbox_photos` en la tabla `bbm_client_configs`. Si el usuario cierra el navegador o refresca la página, recuperará su lote completo de fotos de prueba al reanudar sesión.
> 3. **Historial y Recuperación de Prompts (Control de Versiones):** Añadiremos un endpoint de historial y un componente visual en la pantalla de revisión que lista todas las configuraciones y versiones previas del cliente. Esto le permitirá cargar y restaurar las reglas de prompts de versiones anteriores para seguir calibrándolas.

---

## Proposed Changes

Separamos los cambios por capas (backend de modelos, endpoints API, interfaces de usuario y estilos).

---

### 1. Backend y Endpoints API de Sesiones y Persistencia

#### [MODIFY] [auth.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/onboarding/auth.ts)
*   Asegurar que las funciones de JWT admitan la creación de tokens con el payload `{ clientId, clientName, email }` para sesiones creadas al vuelo.
*   En `requireOnboardingAuth`, mantener la autenticación por token Bearer idéntica para proteger los endpoints.

#### [MODIFY] [session/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/onboarding/session/route.ts)
*   **Creación Directa de Sesiones (Zero-Friction):**
    *   Si se recibe `{ email, clientName }` en lugar de un `code` UUID:
        *   Generar un `clientId` único: `cli-<random_suffix>`.
        *   Insertar una nueva fila en `bbm_client_configs` con `client_id: clientId`, `client_name: clientName`, `created_by: email` y `status: 'draft'`.
        *   Firmar y retornar un JWT token válido de onboarding, `sessionId`, `clientId` y `clientName`.
    *   Si se recibe un `code` o el `DEMO_UUID` tradicional:
        *   Continuar con la lógica existente de intercambio, pero poblar el campo `created_by` con el correo del token.
    *   **Carga Completa de Estado:**
        *   Al reanudar o crear, si ya existe un draft en Supabase para el `client_id`, hacer un select de `id, transcript, partial_config, config, status` y retornar todo el estado estructurado al frontend para restaurar la sesión perfectamente.

#### [NEW] [resume/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/onboarding/session/resume/route.ts)
*   Crear el endpoint `/api/onboarding/session/resume` para buscar y reanudar sesiones por correo:
    *   `POST /api/onboarding/session/resume` con `{ email }`:
        *   Busca todas las filas en `bbm_client_configs` donde `created_by = email` u ocurra coincidencia de correo, ordenadas por fecha de actualización descendente.
        *   Retorna una lista simplificada de sesiones del usuario para que elija cuál reanudar (id, clientName, status, industry, updated_at).
    *   `POST /api/onboarding/session/resume` con `{ sessionId }`:
        *   Valida la existencia de la sesión.
        *   Genera un token JWT de onboarding válido para esa sesión.
        *   Retorna el estado de sesión completo (sessionId, token, clientId, clientName, transcript, partialConfig, synthesizedConfig, status) para inicializar el cliente al 100%.

#### [NEW] [photos/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/onboarding/photos/route.ts)
*   Crear el endpoint `/api/onboarding/photos` para persistir fotos del Sandbox de forma incremental:
    *   `POST /api/onboarding/photos` con `{ sessionId, photos }`:
        *   Guarda el arreglo de fotos directamente en `bbm_client_configs.partial_config.sandbox_photos` en Supabase.
        *   Retorna `{ success: true }`.

#### [NEW] [history/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/onboarding/session/history/route.ts)
*   Crear el endpoint `/api/onboarding/session/history` para listar versiones previas de prompts:
    *   `GET /api/onboarding/session/history`:
        *   Valida el Bearer Token del cliente.
        *   Realiza un query en Supabase de todas las filas en `bbm_client_configs` para el `client_id` actual, ordenadas por `version` descendente.
        *   Retorna el historial completo de configuraciones para visualización y restauración.

---

### 2. Estado de UI y Sincronización Incremental

#### [MODIFY] [useOnboardingChat.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/hooks/useOnboardingChat.ts)
*   **Carga de Estado en Reducer (`SESSION_CREATED`):**
    *   Aceptar transcript, partialConfig, synthesizedConfig y status en el payload de la sesión.
    *   Calcular de forma dinámica el `phase` de inicio:
        *   `approved` si status es `active` o `approved`.
        *   `testing` o `reviewing` si ya hay un `synthesizedConfig`.
        *   `chatting` de lo contrario.
    *   Restaurar `testPhotos` del sandbox leyendo `partialConfig.sandbox_photos`.
    *   Restaurar `iterationCount` de `partialConfig.iteration_count`.
    *   Mapear el transcript de base de datos (`ChatMessage[]` con formato Gemini) al formato de chat local.
*   **Sincronización Incremental del Sandbox:**
    *   Añadir el método `saveSandboxPhotos(sessionId, token, photos)`.
    *   Modificar `addTestPhoto` para que, al finalizar el procesamiento (éxito o error), llame a `saveSandboxPhotos` para persistir la foto base64 y el resultado en Supabase.
    *   Modificar `rateTestResult` para que actualice la calificación (OK/NO) y el comentario en el servidor.
    *   Modificar `requestAdjustment` para limpiar las fotos del sandbox en el servidor al re-calibrar.

---

### 3. Interfaz de Usuario Premium Neo-Brutalista

#### [MODIFY] [page.tsx](file:///c:/Users/gleon/Projects/black-box-magic/src/app/onboarding/page.tsx)
*   **Rediseño de `IdleView` (Puerta de Entrada):**
    *   Presentar un layout Neo-Brutalista sumamente premium con dos secciones animadas mediante pestañas o acordeones:
        1.  **"Comenzar Nuevo Onboarding" (Cero Fricción):** Campos de input `Nombre de tu Empresa` y `Tu Correo Electrónico`, con botón de acción premium que crea la sesión al vuelo.
        2.  **"Reanudar Onboarding Activo":** Campo de input `Tu Correo Electrónico` para buscar sesiones previas.
        3.  *Bypass tradicional:* Seguir admitiendo códigos UUID si vienen en la URL `?code=UUID`.
    *   **Selector de Sesiones:** Si el correo de reanudación tiene múltiples registros, pintar una cuadrícula Neo-Brutalista premium listando los clientes creados con su estado (ej. "Moda Outlet (Borrador) - Modificado hace 2 horas") y botón **"Ingresar"**.
*   **Historial de Prompts y Versiones:**
    *   Añadir un componente **"Historial de Versiones"** en la pantalla de Sandbox y Calibración (por ejemplo, en una sección colapsable o en el Calibration Drawer).
    *   Mostrar una línea del tiempo de versiones (`Versión 2 (Activa)`, `Versión 1 (Archivada)`).
    *   Al hacer clic en una versión, permitir **"Cargar Prompt"** para restaurar las reglas personalizadas en la caja de edición y realizar nuevos ajustes, o visualizar la configuración estructurada de esa iteración.

---

## Verification Plan

### Automated Tests
- Ejecutar la suite de tests en Vitest:
  ```bash
  npm test
  ```
- Crear e integrar un nuevo archivo de integración `history.test.ts` y `resume.test.ts` para verificar la robustez de los endpoints.

### Manual Verification
1.  **Simular Flujo Nuevo:** Navegar a `/onboarding`, ingresar "Retail FOTL" y "rene@fruit.com" en "Comenzar Nuevo", y verificar que nos lleve directo al chat y sandbox sin códigos.
2.  **Verificar Persistencia del Sandbox:** Subir 2 fotos en la fase de pruebas, refrescar la pantalla por completo, ingresar a "Reanudar Onboarding", escribir "rene@fruit.com" y constatar que las fotos y sus reportes de análisis reaparezcan mágicamente en pantalla.
3.  **Probar Historial de Prompts:** Realizar una modificación, guardar versión y verificar que la línea del tiempo liste las versiones y permita cargar el prompt de la Versión 1 de vuelta.
