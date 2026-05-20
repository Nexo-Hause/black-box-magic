# Contexto de Retoma de Proyecto: Black Box Magic

Este documento sirve como el **punto de partida y alineación de contexto** para retomar el desarrollo del proyecto **Black Box Magic** (BBM). Mapea de forma exhaustiva las funcionalidades existentes contra el código real, detalla el estado actual de cada flujo y establece la hoja de ruta unificada conocida como el **Roadmap TP** (que abarca desde WS0 hasta WS6).

---

## 1. Introducción y Foco de Negocio

**Black Box Magic** es una API de análisis visual con IA para retail y QSR (Quick Service Restaurants). Recibe fotos de tiendas, restaurantes y puntos de venta, y retorna inteligencia estructurada mediante modelos de visión de Google Gemini.

### El Modelo B2B2B
El foco actual es un **MVP comercializable atado a Ubiqo Evidence**, diseñado para ser robusto en producción y comercializarse con clientes finales. El flujo comercial y técnico sigue una jerarquía de tres niveles:
1. **BBM (Super Admin):** Acceso global a todas las cuentas y datos.
2. **Reseller-Admin (Ubiqo/Enrique):** Administra su propia cuenta de distribuidor y puede ver los datos de todos sus clientes finales.
3. **Client-User (Fruit of the Loom / Carlos):** Acceso restringido exclusivamente a los datos de su empresa final.

---

## 2. Mapa Exhaustivo de Funcionalidades vs Código

A continuación se presenta el desglose de componentes del sistema, mapeado directamente a los archivos y directorios del repositorio.

### A. Core de Análisis de Visión (Gemini API)
Orquesta las llamadas directas a los modelos de visión de Google Gemini con mecanismos de reintento ante límites de cuota (429) o errores de servidor (500/503) y fallbacks automáticos de modelo.
* **Modelos Utilizados:** `gemini-3.1-flash-lite-preview` como primario y `gemini-3-flash-preview` como fallback.
* **Archivos Clave:**
  * [src/lib/gemini.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/gemini.ts): Cliente principal de visión. Contiene:
    * `analyzeImage`: Análisis de una sola imagen.
    * `analyzeWithReferences`: Comparación multi-imagen (imagen de campo vs imágenes de planograma de referencia) en un solo payload con lógica `withRetry` y exponencial backoff.
    * `extractJSON`: Limpieza y parseo de respuestas JSON robusto (incluyendo detección de markdown y llaves).

### B. Motor de Análisis Configurable (Engine v3)
Un motor altamente configurable que permite evaluar fotos bajo reglas o criterios específicos definidos para cada cliente, en lugar de usar un prompt estático.
* **Archivos Clave:**
  * [src/lib/engine/config.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/engine/config.ts): Validaciones mediante schemas Zod y CRUD de la configuración del cliente (`ClientConfig`).
  * [src/lib/engine/prompt-builder.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/engine/prompt-builder.ts): Construcción dinámica del prompt del sistema estructurado inyectando los criterios y áreas de evaluación de la configuración.
  * [src/lib/engine/analyzer.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/engine/analyzer.ts): Orquesta el análisis, parsea el JSON resultante de Gemini (`parseRawLLMResponse`), normaliza puntuaciones por tipo de criterio (binario, escala, presencia, conteo) de forma determinista y evalúa fallas críticas.
  * [src/lib/engine/escalation.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/engine/escalation.ts): Evalúa y dispara alertas o escalaciones basadas en umbrales de puntuación o fallas de criterios críticos.
  * [src/types/engine.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/types/engine.ts): Definiciones de TypeScript para configuraciones, criterios, resultados y escalaciones.

### C. Integración Ubiqo Evidence
El pipeline que conecta BBM con la plataforma Evidence de Ubiqo para ingestar capturas de fotos de campo de forma periódica y automática.
* **Archivos Clave:**
  * [src/lib/ubiqo/client.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/ubiqo/client.ts): Cliente API Ubiqo (`fetchCaptures`, `buildPhotoUrl`, `extractPhotos`) que consume los endpoints reales de `bi.ubiqo.net`.
  * [src/lib/ubiqo/types.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/ubiqo/types.ts): Schemas Zod e interfaces TypeScript que tipan estrictamente el payload de Ubiqo.
  * [src/lib/ubiqo/ssrf.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/ubiqo/ssrf.ts): Descarga segura de fotos de campo con protección SSRF y validación de allowlist de dominios mediante variables de entorno (`UBIQO_PHOTO_DOMAINS`).
  * **Endpoints del Pipeline:**
    * [src/app/api/ubiqo/ingest/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/ubiqo/ingest/route.ts): Descubrimiento e ingesta de capturas de Ubiqo de forma incremental. Registra fotos como `pending` en base de datos.
    * [src/app/api/ubiqo/process/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/ubiqo/process/route.ts): Descarga una foto pendiente, corre el análisis Gemini 2-pasadas (legacy) o Engine v3, y persiste los resultados estructurados.
    * [src/app/api/ubiqo/results/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/ubiqo/results/route.ts): Endpoint de consulta filtrada de resultados del pipeline.
    * [src/app/api/ubiqo/status/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/ubiqo/status/route.ts): Observabilidad (conteo de procesados, pendientes, fallidos y alertas).

### D. Pipeline de Comparación de Planogramas
Evaluación de fotos de campo contra imágenes de referencia autorizadas (planogramas) para identificar desvíos, faltantes o fallas de acomodo.
* **Archivos Clave:**
  * [src/app/api/planogram/ingest/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/planogram/ingest/route.ts): Descubre capturas de Ubiqo e inicia incidencias pendientes comparando las fotos del formulario contra los planogramas asignados.
  * [src/app/api/planogram/process/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/planogram/process/route.ts): Ejecuta la comparación real de la foto de campo vs planogramas mediante `analyzeWithReferences`, genera las incidencias y almacena el log.
  * [src/app/api/planogram/webhook/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/planogram/webhook/route.ts): Endpoint preparado para recibir webhooks de Ubiqo (actualmente esqueleto, el MVP usará procesamiento por cron/polling).

### E. Flujo de Onboarding Conversacional
Un chat interactivo guiado por IA que permite descubrir las necesidades del cliente, sintetizar automáticamente su configuración `ClientConfig` personalizada mediante Gemini Pro, probar fotos de muestra en vivo y activar su configuración final.
* **Archivos Clave:**
  * [src/app/onboarding/page.tsx](file:///c:/Users/gleon/Projects/black-box-magic/src/app/onboarding/page.tsx): Interfaz de usuario del chat y flujo de onboarding.
  * [src/hooks/useOnboardingChat.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/hooks/useOnboardingChat.ts): Máquina de estados de 7 fases que controla el flujo conversacional.
  * [src/hooks/useVoiceSession.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/hooks/useVoiceSession.ts): Integración de audio y WebSockets para interactuar por voz en tiempo real con la Live API de Gemini.
  * [src/lib/onboarding/synthesis.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/onboarding/synthesis.ts): Síntesis y estructuración de la configuración final del cliente basada en la transcripción de la conversación usando Gemini Pro.
  * [src/lib/onboarding/tools.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/onboarding/tools.ts): Definición de herramientas para Function Calling que la IA invoca durante el chat (crear criterio, modificar regla, correr pruebas).
  * [src/app/api/onboarding/session/route.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/app/api/onboarding/session/route.ts): Endpoint de intercambio de código de invitación por token JWT firmado.

### F. Administración, Cookies y Seguridad
* **Archivos Clave:**
  * [src/lib/auth.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/auth.ts): Validación de tokens de producción tipo Bearer (`BBM_API_KEYS`).
  * [src/lib/cookie.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/cookie.ts): Generación y validación de cookies HMAC-signed para acceso a la versión demo.
  * [src/lib/onboarding/auth.ts](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/onboarding/auth.ts): Firma y verificación de tokens JWT usando la librería `jose` y derivación de llave HKDF para la seguridad del flujo de onboarding.
  * [src/app/admin/page.tsx](file:///c:/Users/gleon/Projects/black-box-magic/src/app/admin/page.tsx): Dashboard de administración para generar códigos de invitación de onboarding de clientes.

### G. Exportadores
* **Archivos Clave:**
  * [src/lib/exports/](file:///c:/Users/gleon/Projects/black-box-magic/src/lib/exports/): Módulo para generación y descarga de reportes.
    * **Excel:** Exportador multi-hoja usando la librería `xlsx` (SheetJS).
    * **PDF:** Reportes con tablas autogeneradas usando `jspdf` y `jspdf-autotable`.

---

## 3. Estado del Proyecto (Abierto, En Proceso, Pendiente, Cerrado)

### 🟢 Cerrado (Completado y Verificado)
* **WS0 — Reconciliación de Git y Limpieza:** `main` reconciliada con el repositorio remoto. Se eliminaron 15 ramas locales obsoletas. Higiene de código y tests funcionando.
* **WS-D — specs de Planograma y Tenencia:** Definición formal del modelo de tenencia (en [docs/tenancy-model.md](file:///c:/Users/gleon/Projects/black-box-magic/docs/tenancy-model.md)) y resolución de decisiones de diseño en [spec/02-reference-comparison.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/02-reference-comparison.md) (como la asignación planograma-formulario, zonas horarias y estructura de retorno de incidencias).
* **Spec 00 — Integración base con Ubiqo Evidence:** Descubrimiento, descarga con protección SSRF y análisis incremental del pipeline de Evidence completamente implementados en `main`.
* **Spec 01 — Engine v3:** Motor multi-industria con configuración Zod, scoring determinista en servidor, triggers de escalación y UI/Voz de onboarding conversacional completada y funcional.
* **Spec 02 (Fase 0+1) — Comparación vs Planogramas:** Lógica central de comparación multi-imagen implementada en `main`. Base de datos e ingesta de incidencias estructurada.
* **Migraciones Supabase (001 a 008):** Todas las migraciones iniciales aplicadas de manera exitosa en Supabase, incluyendo tablas de capturas, planogramas, incidencias y códigos de onboarding.

### 🟡 En Proceso (Activo en esta sesión)
* **PR #21 en Conflicto (Branch `session/2026-05-18-ws0-reorder`):** Esta rama contiene los specs escritos y pre-auditados para las fases subsecuentes del MVP (BullMQ, Multi-tenant, Hardening, Dashboard, Export). Tiene conflictos git con `main` debido a un squash merge previo de la rama de reconciliación (PR #20). **La resolución de este conflicto y merge es el paso activo inmediato.**

### 🔵 Pendiente (Próximos Workstreams en el Roadmap TP)
La secuencia estricta de ejecución aprobada y auditada es:
1. **WS1 — Worker BullMQ en VPS ([spec/03-ws1-pipeline-bullmq.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/03-ws1-pipeline-bullmq.md)):**
   * Mover lógica de procesamiento de fotos a un pipeline compartido en `/src/lib/pipeline/`.
   * Montar un worker BullMQ independiente en el VPS con reintentos y jobs repetibles de ingest para eliminar las limitaciones de timeout de 60 segundos de Vercel.
2. **WS-MT — Fundación Multi-Tenant ([spec/04-ws-mt-multitenant.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/04-ws-mt-multitenant.md)):**
   * Crear la jerarquía formal en base de datos (`bbm_accounts`, `bbm_clients`, `bbm_users`).
   * Implementar control de accesos para 3 roles (BBM, reseller-admin, client-user).
   * Crear el helper centralizado de tenant-scoping en la capa de aplicación (necesario ya que la service-role key de Supabase ignora las políticas RLS).
3. **WS-H — Hardening de Producción ([spec/05-ws-h-hardening.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/05-ws-h-hardening.md)):**
   * Taxonomía y políticas de error específicas de Gemini Vision (distinguir fallos transitorios de definitivos o bloqueos por seguridad).
   * Límites de cuotas y tope de costo operativo. Runbook de rotación del token de Ubiqo.
4. **WS2 — Dashboard FOTL ([spec/02-ws2-dashboard.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/02-ws2-dashboard.md)):**
   * Endpoint de consulta de incidencias con scope de tenant.
   * Interfaz del Dashboard para visualización de cumplimiento de planogramas y selector de cliente según el rol del usuario.
5. **WS3 — Export Excel ([spec/02-ws3-export.md](file:///c:/Users/gleon/Projects/black-box-magic/spec/02-ws3-export.md)):**
   * Descarga de reporte Excel estructurado en 4 pestañas para incidencias filtradas por tenant.
6. **WS4 — Validación E2E:** Pruebas controladas del pipeline E2E completo con fotos reales de campo (dependiente de que Ubiqo/FOTL provea imágenes).
7. **WS5 — Webhook Ubiqo (Post-MVP):** Migración del pipeline de polling/cron a una arquitectura guiada por eventos vía webhook.

### 🔴 Abierto (Bloqueos o Impedimentos Activos)
* **Conflicto en PR #21:** Impide fusionar la documentación y planeación en `main`. Requiere resolver la divergencia de historia git.
* **Higiene en PR #18:** Requiere que Gonzalo cierre manualmente el PR en GitHub (cuenta `gonzalodev-ops` es de solo lectura).
* **Worker VPS y Redis no configurados:** El pipeline no se puede desplegar hasta aprovisionar Redis y pm2 en el VPS.
* **Falta de fotos reales de Fruit of the Loom:** Bloquea las pruebas de precisión del planograma (WS4), pero no impide el desarrollo de los módulos de software.
* **Payload del Webhook de Ubiqo no especificado:** Bloquea el desarrollo del webhook en tiempo real (WS5), pero no afecta al MVP gracias a que este corre mediante polling recurrentrente (cron).

---

## 3.5. Acuerdos de Alineación de Sesión (Roadmap TP)

En la sesión de alineación del 2026-05-19, se definieron los siguientes acuerdos de diseño y negocio que guiarán la ejecución del Roadmap TP:

1. **Resolución de Git:** Se aprueba la **Opción A** para resolver el conflicto del PR #21 de forma limpia y segura (creando un branch fresco desde `origin/main` y aplicando checkouts de la documentación de specs).
2. **Entorno de VPS:** El VPS actual está configurado y dedicado a tareas de Message Queue (MQ), por lo que cuenta con la infraestructura física lista para el despliegue del worker BullMQ y Redis.
3. **Seeding de Usuarios:** Se establece el correo **`gonzalo@integrador.pro`** como el correo principal del rol `bbm_admin`. Los usuarios adicionales de reseller y clientes se seedearán con placeholders estructurados de desarrollo, permitiendo su adición y edición posterior vía SQL (manual en base de datos para el MVP).
4. **Hardening de Costos (Gemini):** Se rechaza dejar el límite hardcoded en el código. Se establece que el umbral de control de presupuesto diario (ej. **$50 USD diarios** para el MVP) debe ser **totalmente configurable a través de variables de entorno** (ej. `GEMINI_DAILY_BUDGET_LIMIT` en el VPS / `.env.local`). Si el consumo calculado del día supera este umbral, el worker suspenderá el procesamiento y emitirá una alerta.
5. **Estructura del Reporte Excel MVP (WS3):** Para ofrecer valor rápido y sin sobreingeniería, el reporte Excel de 4 pestañas se estructurará de la siguiente forma:
   * **Pestaña 1: Resumen de Tiendas (KPIs):** Listado de sucursales, fechas de auditoría y porcentaje de cumplimiento.
   * **Pestaña 2: Incidencias de Acomodo:** Detalle de fallas encontradas en el punto de venta con niveles de severidad.
   * **Pestaña 3: Inventario vs Planograma:** Tabla comparativa que contrasta los productos detectados contra la referencia teórica.
   * **Pestaña 4: Fotos Auditadas (Calidad):** Bitácora de fotos procesadas y diagnóstico técnico de su calidad (si fue exitosa, borrosa o muy oscura).
6. **Mantenibilidad y Auto-onboarding:** El MVP debe ser autosustentable y escalable de forma masiva para clientes de Ubiqo sin necesidad de ajustes manuales continuos. Todo soporte y fine-tuning de planogramas específicos se facturará por separado. El motor de Engine v3 y multi-tenant debe minimizar drásticamente el tiempo de administración requerido por Gonzalo y Enrique.
7. **Modularidad Estética (Futuro):** Para preparar un rediseño de marca instantáneo a futuro sin reescribir la UI, se acuerda concentrar absolutamente todos los tokens visuales (paletas de colores, fuentes de Google Fonts, bordes glassmorphic y gradientes) como variables CSS nativas en `src/app/globals.css`. De esta forma, el cambio estético futuro se logrará reemplazando un único archivo centralizado.

### Análisis Operativo de Mantenibilidad y Auto-onboarding (Acuerdos 2026-05-19)

Para cumplir con la visión de Gonzalo de un producto masivo de auto-onboarding y bajo mantenimiento para Ubiqo, se analizan y acuerdan los siguientes lineamientos:

* **¿Cumple el Roadmap TP con el Auto-onboarding?**
  * **Sí, a nivel de arquitectura central:** El Engine v3 permite que el cliente defina su propia configuración conversando con el chat y la IA la sintetice. El multi-tenant (WS-MT) aislará los datos automáticamente sin intervención técnica de desarrollo.
  * **El riesgo operativo:** Si un cliente final sube planogramas muy complejos o si los auditores de campo suben fotos borrosas o mal encuadradas, Gemini arrojará falsos negativos que requerirán soporte técnico de tu parte. Para evitar que el mantenimiento te consuma tiempo, debemos blindar el flujo con *Quick Wins* de usabilidad.

* **Quick Wins Identificados para el MVP (Bajo esfuerzo, alto impacto en soporte):**
  * **Plantillas Preconfiguradas por Industria (WS-MT/Engine v3):** En lugar de que el chat de onboarding empiece de cero preguntando todo (lo que puede frustrar al cliente), programaremos **3 plantillas canónicas** (ej. "Retail Moda/Textil" para FOTL, "Abarrotes/Supermercados" y "Restaurantes/QSR"). Al iniciar, la IA sugerirá cargar una plantilla base, reduciendo el onboarding de 10 minutos a 2 minutos.
  * **Detector de Calidad en Carga de Fotos (WS1/WS-H):** En la UI de carga de fotos o en el inicio del pipeline, un pre-análisis ultra-rápido y económico con Gemini Flash Lite validará si la foto es legible. Si está muy oscura o borrosa, el sistema rechazará la foto en tiempo real indicándole al auditor: *"Foto borrosa. Por favor tómala de nuevo"*. Esto previene procesamientos costosos fallidos y reduce quejas de soporte por incidencias falsas.
  * **Guía Visual para Campo (UX):** Agregar un runbook visual de 3 pasos sencillos en la UI (ej. distancia correcta, ángulo frontal de 90° e iluminación) para que el auditor de campo sepa cómo capturar con éxito sin capacitación.

* **Áreas donde Evitaremos Sobreingeniería (Reducción de costos de desarrollo):**
  * **Cero UI Administrativa de Cuentas:** No crearemos pantallas de administración complejas para crear clientes, asignar tokens o dar de alta usuarios. Para el MVP, todo el aprovisionamiento de resellers y clientes se hará mediante inserts SQL directos o scripts de seed (lo cual toma menos de 1 minuto por cuenta nueva).
  * **Cero Billing Automático:** El control de consumo y facturación de la cuota por cliente final se manejará de forma offline y comercial. El worker solo se protegerá técnicamente con el límite de costo diario configurable en variables de entorno para evitar sorpresas.

---

---

## 4. Guía de Trabajo y Protocolos Críticos

Para garantizar el éxito y la continuidad sin fricciones entre nosotros, debemos seguir rigurosamente estas reglas contextuales definidas en el proyecto:

### Idioma — Español Mexicano (Estricto)
Gonzalo está en México. Toda la comunicación, comentarios de código nuevos, mensajes de commit, descripciones de PR y documentos técnicos deben ser escritos en **español mexicano**, empleando las conjugaciones de "tú" de forma correcta (ej: *tienes*, *puedes*, *haz*, *mira*, *verificas*) y **evitando a toda costa terminología rioplatense** (ej: *vos*, *che*, *pibe*, *boludo*, *decime*, *fijate*).

### Reglas Técnicas Inquebrantables
1. **Verificación Obligatoria:** No se puede declarar una tarea como "lista" o "exitosa" sin antes correr las pruebas o el comando correspondiente en la sesión activa y mostrar el output de terminal que lo respalde (ej: `N/N tests passed`, `exit 0` en compilación).
2. **Todo al Repo:** Specs, decisiones técnicas y estados nunca se quedan en la máquina local o temporal. Deben estar commiteados en sus respectivas carpetas (`/spec/`, `/docs/`, `.claude/STATUS.md`).
3. **No Fabricar Datos o Reglas:** Ante cualquier duda sobre constantes numéricas, tolerancias de precisión o límites de negocio, se debe buscar en los documentos del repositorio o preguntar directamente a Gonzalo.
4. **UX-First:** Si un cambio afecta la UI, primero se documenta el flujo paso a paso desde el punto de vista del usuario, se valida, y posteriormente se programa.
5. **No Destruir sin Autorización:** Operaciones destructivas como force-push, borrar ramas remotas, limpiar contenedores docker o migraciones con DROP en producción requieren validación y OK explícito.

### Comandos de Desarrollo del Proyecto
* **Levantar Servidor Local:** `npm run dev` (disponible en localhost:3000).
* **Compilar Proyecto:** `npm run build`.
* **Correr Suite de Pruebas (Vitest):** `npm test` o `npm run test:watch`.
* **Linting:** `npm run lint`.

---

¡Este documento está listo para ser guardado y servir como nuestra brújula en esta nueva etapa del proyecto!
