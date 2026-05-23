# Checklist de Ejecución — Onboarding Automático e Interactivo Self-Serve

Este checklist interactivo organiza las tareas técnicas necesarias para implementar la experiencia de onboarding autogestionado en BBM y Ubiqo bajo la familia **Gemini 3.5 Flash**.

---

## [x] Fase 1: Backend de Modelos y API (Gemini 3.5 Flash)
- [x] **Actualización de Constantes de Modelos en `gemini-chat.ts`**
  - [x] Redefinir `CHAT_MODEL` y `SYNTHESIS_MODEL` estrictamente a `'gemini-3.5-flash'` para depreciar la familia 2.5.
- [x] **Prevención de Prompt Injection en `synthesis.ts`**
  - [x] Modificar el prompt en `src/lib/onboarding/synthesis.ts` para enmarcar el dictado libre del usuario en etiquetas XML `<user_rules>...</user_rules>`.
  - [x] Instruir a Gemini para tratar este bloque únicamente de forma pasiva y como criterios de auditoría.
- [x] **Filtro de Relevancia Dinámico (Descarte de Paja) en Síntesis**
  - [x] Modificar el prompt del sintetizador para descartar facetas no relacionadas con lo que el cliente dictó, marcándolas como `"N/A"` en la configuración resultante.
- [x] **Creación del Endpoint `/api/onboarding/guide`**
  - [x] Crear `src/app/api/onboarding/guide/route.ts` para resolver el flujo dinámico de industrias personalizadas ("Otros").
  - [x] Realizar una llamada rápida y ligera a `gemini-3.5-flash` para retornar 4 preguntas guía específicas en formato JSON.
  - [x] Añadir try-catch blindado de robustez y control de fallas con respuestas de fallback estructuradas.

## [x] Fase 2: Componentes de Interfaz de Usuario y Estilos (Vanilla CSS)
- [x] **Creación de Estilos Modulares (`onboarding.css`)**
  - [x] Crear `src/app/onboarding/onboarding.css` usando Vanilla CSS y variables modulares heredadas de `globals.css`.
  - [x] Diseñar los botones interactivos del selector de industrias, el micrófono Neo-Brutalista y el panel lateral de calibración.
  - [x] Añadir micro-animaciones fluidas de parpadeo y pulso CSS para los estados del micrófono (`listening`, `processing`).
- [x] **Rediseño del Componente Principal de Onboarding (`page.tsx`)**
  - [x] Modificar `src/app/onboarding/page.tsx` para articular el **Flujo de 3 Pasos Premium**:
    - [x] **Paso 1:** Selector de industria con guías dinámicas basadas en los clusters del repo. Entrada de dictado por voz y texto con micrófono interactivo.
    - [x] **Paso 2:** Zona de carga drag-and-drop de fotos de prueba del Sandbox de 100 fotos. Barra de progreso en tiempo real con estados.
    - [x] **Paso 3:** Resultados ultra-limpios (sin paja genérica) con botones de acción rápida **"OK (Activar Motor)"** y **"Modificar (Ajustar)"**.
- [x] **Implementación de Panel de Calibración Lateral**
  - [x] Integrar el panel colapsable que se abre al dar clic en "Modificar" con los 3 inputs universales:
    - [x] Selector de Severidad (Estricto / Adecuado / Tolerante).
    - [x] Entrada de Omisiones (Texto libre).
    - [x] Checkboxes de Descarte de Paja (iluminación, teoría laboral, marcas competidoras).
  - [x] Integrar el trigger de re-síntesis asíncrona que actualice el reporte de prueba en caliente.

## [x] Fase 3: Pruebas y Robustez de Control (QA)
- [x] **Ajuste de Suites de Vitest Existentes**
  - [x] Analizar y reescribir aserciones rígidas en `synthesis.test.ts` que validen strings de modelos viejos, alineándolas al nuevo `'gemini-3.5-flash'`.
- [x] **Creación de Nuevos Tests de Cobertura**
  - [x] Añadir test unitario para validar que `synthesis.ts` encapsule correctamente el input libre dentro de los tags XML delimitados.
  - [x] Añadir test de integración para el endpoint `/api/onboarding/guide` con diferentes tipos de industrias personalizadas ("Otros").
- [x] **Verificación y Ejecución Completa de Pruebas**
  - [x] Correr la suite de Vitest localmente asegurando que todos los tests pasen (Exit 0):
    ```bash
    npx vitest run
    ```

## [/] Fase 4: Persistencia Sandbox, Inicio de Sesión por Correo e Historial de Prompts
- [ ] **Desarrollo de Nuevos Endpoints en Backend:**
  - [ ] Implementar `/api/onboarding/session/resume` para buscar y reanudar sesiones por correo.
  - [ ] Adaptar `/api/onboarding/session` para crear sesiones instantáneas al vuelo con `{ email, clientName }`.
  - [ ] Desarrollar `/api/onboarding/photos` para guardar el lote de fotos base64 y reportes en Supabase.
  - [ ] Desarrollar `/api/onboarding/session/history` para obtener la lista de versiones y prompts previos.
- [ ] **Sincronización Automática en `useOnboardingChat.ts`:**
  - [ ] Reconstruir la acción `SESSION_CREATED` del reducer para restaurar el chat transcript, el Sandbox de fotos, la fase del onboarding y el prompt de forma dinámica.
  - [ ] Integrar autoguardado en `addTestPhoto` y `rateTestResult` llamando al endpoint de fotos.
- [ ] **Actualización de Interfaz en `page.tsx`:**
  - [ ] Rediseñar la pantalla de entrada en `IdleView` con layout premium de pestañas: "Comenzar Nuevo Onboarding" (Correo + Empresa) y "Reanudar Onboarding" (Correo).
  - [ ] Añadir selector visual de sesiones para correos con múltiples registros.
  - [ ] Añadir sección/drawer de "Historial de Versiones" para listar las configuraciones históricas y permitir restaurar prompts antiguos.
- [ ] **Ejecución y Verificación:**
  - [ ] Crear tests de integración para reanudación e historial.
  - [ ] Asegurar que Vitest pase con 100% verde y no existan errores de compilación de TypeScript.
