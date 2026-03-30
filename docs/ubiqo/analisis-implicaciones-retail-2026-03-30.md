# Análisis de Implicaciones — Reunión Retail 30-Mar-2026

> Este no es un plan de implementación. Es un análisis de implicaciones de primer y segundo orden
> de lo que descubrimos en la reunión con René y Carlos, y cómo afecta al producto y a otros clientes.

---

## Contexto

La reunión con René y Carlos (distribuidora Fruit of the Loom) reveló una necesidad concreta:
**comparar fotos de anaquel contra un planograma de referencia**. Carlos revisa 400-500 carpetas
de evidencia por semana manualmente, generando incidencias en Excel.

El Engine v3 actual evalúa fotos en aislamiento — no tiene concepto de "referencia" contra la cual comparar.

---

## Implicaciones de Primer Orden (consecuencias directas)

### 1. Comparación contra referencia es una capacidad nueva

El Engine v3 tiene `evaluationAreas` con `criteria` (binary, scale, count, presence), pero todas
evalúan la foto en sí misma. No existe un mecanismo para decir "compara esta foto contra ESTE
estándar visual."

El campo `referenceImages` en `ClientConfig` existe, pero es para ejemplos etiquetados
(correcto/incorrecto), no para un planograma estructurado con SKUs, posiciones y precios esperados.

**Gap concreto:** Falta un tipo de evaluación "match against reference" en el modelo de datos.

### 2. El planograma es datos estructurados, no solo una imagen

El planograma de FOTL tiene: 19 modelos × 6 tallas = ~114 SKUs, con precios ($169-$249),
categorías (Atlética, Trusa, Boxer Brief, Boxer Trunk, Boxer Moda), y posición espacial
(filas = tallas, columnas = modelos).

Esto no es "una foto de referencia" — es una TABLA de datos. El análisis necesita:
- Ingestar el planograma como datos estructurados (no solo como imagen)
- Cruzar lo detectado en la foto contra la tabla de referencia
- Reportar discrepancias: producto faltante, producto fuera de posición, precio incorrecto

### 3. El prompt necesita contexto de referencia

`prompt-builder.ts` construye prompts desde `evaluationAreas` + `criteria`. Para comparación
contra planograma, el prompt necesita INCLUIR los datos del planograma como contexto:
"Estos son los productos esperados en este anaquel: [tabla]. Compara la foto contra esta referencia."

### 4. El volumen es real y viable económicamente

- 400-500 fotos/semana = ~2,000 análisis/mes
- Costo Gemini: ~$8 USD/mes (a $0.004/imagen)
- Si planograma requiere 2 pasadas: ~$16 USD/mes
- Margen: >95% incluso con suscripción conservadora

---

## Implicaciones de Segundo Orden (consecuencias de las consecuencias)

### 5. "Comparar contra referencia" NO es un feature de retail — es un PATRÓN transversal

Este patrón aplica a TODOS los clusters de clientes identificados:

| Cluster | Referencia | Foto de campo |
|---------|-----------|---------------|
| **Retail/BTL** (René, Métrica BTL, Auto Todo) | Planograma de productos | Foto de anaquel |
| **Franquicias QSR** (Guillermo) | Manual de marca / estándar de sucursal | Foto de fachada, cocina, baños |
| **Construcción** (Construcción SB, GTAC) | Plano / blueprint / avance esperado | Foto de obra |
| **Farmacéutica** (Menarini) | Planograma regulatorio | Foto de exhibición |
| **Servicios regulados** (Urbaser, Banco Itau) | Checklist normativo | Foto de evidencia |

**Implicación:** Si resolvemos "referencia vs. campo" para retail, lo resolvemos para todos.
Esta es la feature horizontal más importante del producto.

### 6. El onboarding necesita una fase de "carga de referencia"

El onboarding actual (7 fases) descubre el mundo del cliente por conversación y sintetiza un
`ClientConfig`. Pero NO tiene un mecanismo para que el cliente suba su planograma, manual de marca,
o estándar visual.

Las 5 fases del discovery (`system-prompt.ts`) serían:
1. Su Mundo — OK, no cambia
2. Las Fotos — **Aquí entra:** "¿Tienen un planograma o estándar visual contra el cual comparar?"
3. Su Cliente — OK, no cambia
4. Herramientas y Decisión — OK, no cambia
5. Test y Validación — **Cambia:** Las fotos de prueba se evalúan CONTRA la referencia, no en aislamiento

**Nuevo sub-flujo necesario entre Fase 2 y Fase 5:**
- Subir material de referencia (imagen, PDF, tabla)
- BBM procesa y extrae datos estructurados del material
- El ClientConfig se enriquece con la referencia procesada
- Las fotos de prueba se evalúan contra la referencia

### 7. El ClientConfig necesita extensión — no reemplazo

El modelo actual funciona bien para evaluación "absoluta" (¿está limpio? ¿hay producto?).
La comparación contra referencia agrega una dimensión "relativa" (¿coincide con lo esperado?).

Opciones de extensión del `ClientConfig`:
- **Campo nuevo:** `referenceData` — datos estructurados extraídos del planograma/manual
- **Criterion type nuevo:** `match` — evalúa coincidencia contra referencia
- **Evaluation area especial:** `planogram_compliance` con criterios de posición, surtido, precio

Esto NO rompe la compatibilidad con configs existentes (QSR, futuras). Es aditivo.

### 8. El scoring se vuelve más rico

Hoy: "¿Hay producto en el anaquel?" → binary (sí/no) o count (cuántos)
Con referencia: "¿El producto correcto está en la posición correcta?" → match score

Nuevas métricas posibles:
- **Surtido:** % de SKUs del planograma presentes en la foto
- **Posición:** % de SKUs en su ubicación correcta
- **Precio:** % de precios que coinciden con el planograma
- **Huecos:** Conteo de posiciones vacías que deberían tener producto

Estas métricas son EXACTAMENTE lo que Carlos necesita para su Excel de incidencias.

### 9. El entregable cambia: de "análisis genérico" a "reporte de cumplimiento"

Hoy BBM genera un análisis descriptivo ("se observan N productos, marca dominante X").
Con referencia, genera un **reporte de cumplimiento** ("90% de surtido, 3 SKUs faltantes,
2 precios incorrectos, 1 hueco en posición B3").

Esto es un salto cualitativo en valor:
- Para Carlos: reemplaza su revisión manual completa
- Para el cliente final (la marca): evidencia verificable de ejecución
- Para Ubiqo/Evidence: diferenciador competitivo

### 10. El modelo de pricing se clarifica

Con la capacidad de referencia:
- **Capa 1 (Eficiencia):** Automatizar la revisión de Carlos → $X/mes
- **Capa 2 (Inteligencia):** Dashboard de cumplimiento por tienda/promotor → $X+Y/mes
- **Capa 3 (Valor al cliente del cliente):** Reportes de cumplimiento para la marca → $X+Y+Z/mes

René y Carlos están comprando Capa 1 hoy. Pero la Capa 3 es donde está el dinero real —
y la referencia es lo que habilita Capa 3.

---

## Cómo entra en el onboarding automático

El onboarding actual sigue este flujo:

```
Conversación (5 fases) → Function calls → Partial Config → Síntesis → ClientConfig → Test → Deploy
```

Con comparación contra referencia, el flujo extendido sería:

```
Conversación (5 fases) → Function calls → Partial Config
                                              ↓
                              ¿Tiene referencia? ─── No → Síntesis normal
                                              ↓ Sí
                              Subir referencia (planograma, manual, tabla)
                                              ↓
                              Procesar referencia → datos estructurados
                                              ↓
                              Enriquecer Partial Config con referencia
                                              ↓
                              Síntesis (incluye match criteria)
                                              ↓
                              Test de fotos CONTRA referencia
                                              ↓
                              Deploy
```

### Cambios concretos al onboarding:

1. **Nuevo tool de function calling:** `addReference(type, data)` — registra que el cliente tiene
   material de referencia y su tipo (planograma, manual, checklist)

2. **Phase 2 ampliada:** El system prompt de onboarding preguntaría:
   "¿Tienen un planograma, manual de marca, o estándar visual documentado contra el cual evalúan?"

3. **Nuevo endpoint:** `/api/onboarding/reference` — recibe imagen/PDF del planograma, lo procesa
   con Gemini para extraer datos estructurados (SKUs, posiciones, precios)

4. **Síntesis ampliada:** `synthesis.ts` genera `match` criteria cuando hay referencia,
   además de los criteria normales

5. **Test runner ampliado:** `test-runner.ts` incluye los datos de referencia en el prompt
   de análisis durante la fase de prueba

### Lo que NO cambia:
- Clientes sin referencia siguen funcionando exactamente igual
- El scoring server-side no cambia en lógica — solo agrega el tipo `match`
- La escalación funciona igual (score below threshold → trigger)
- La UI de onboarding (chat) no cambia — solo agrega un paso de upload

---

## Impacto en otros clientes (de los 12 prospectos)

| Prospecto | ¿Beneficia? | Tipo de referencia |
|-----------|-------------|-------------------|
| Métrica BTL | Sí — mismo patrón exacto | Planogramas de marcas |
| Auto Todo | Sí — layout de autopartes | Planograma de exhibición |
| Acuario Lomas | Sí — exhibición pet products | Planograma por categoría |
| Franquicia Restaurante (Guillermo) | Sí — estándar de marca | Manual de imagen corporativa |
| Construcción SB | Parcial — avance vs. plan | Planos/cronograma |
| GTAC | Parcial — instalación vs. spec | Especificaciones técnicas |
| Urbaser Colombia | No directamente | Checklists normativos (ya cubierto por criteria) |
| Banco Itau | No directamente | Estándares de sucursal (podría beneficiar) |
| Menarini | Sí — regulatorio | Planograma farmacéutico |
| Epoxemex | No | Evaluación de calidad de aplicación |
| Siacorp | No | Auditoría de seguridad |
| Grupo YGI | No | Verificación de personal |

**7 de 12 prospectos se benefician directamente** de la feature de comparación contra referencia.

---

## Resumen ejecutivo

1. **Planogram comparison no es un feature — es EL PATRÓN** que desbloquea el mayor valor del producto
2. **El Engine v3 lo soporta con extensión aditiva** — no requiere rediseño, solo ampliar ClientConfig
3. **El onboarding lo absorbe naturalmente** — Phase 2 pregunta por referencia, se agrega upload + procesamiento
4. **7/12 prospectos se benefician** — es la feature con mayor impacto transversal
5. **Habilita Capa 3 de valor** — reportes de cumplimiento para el cliente del cliente (donde está el pricing premium)
6. **El riesgo es bajo** — es extensión, no reemplazo. Lo que funciona hoy sigue funcionando.

---

## El Onboarding como Herramienta de Venta — "Efecto Wow"

### El problema del flujo actual

El onboarding hoy tiene **demasiados pasos entre el interés y el impacto:**

```
Chat (5-15 min) → Síntesis (2 min) → Review config → Aprobar → Subir fotos → Ver resultados
```

Si Gonzalo está sentado con René y Carlos, el "wow" llega después de ~20 minutos de configuración.
Para un prospecto que no pidió el producto, eso es demasiado. Se pierde el momentum.

### Lo que necesitamos: "Demo instantánea" DURANTE la conversación

El efecto wow requiere que el cliente vea resultados ANTES de completar el onboarding.
La secuencia ideal en una reunión de ventas:

```
1. Gonzalo abre el onboarding
2. Conversación breve: "Cuéntame qué hacen, qué evalúan"
3. Cliente menciona planogramas → "¿Tienes uno a la mano? Súbelo"
4. Cliente sube planograma → sistema lo procesa (~5-10s)
5. "Ahora sube una foto de un anaquel real"
6. Cliente sube foto → COMPARACIÓN INSTANTÁNEA contra el planograma
7. "90% de surtido, 3 SKUs faltantes, 2 precios incorrectos" ← WOW
8. Cliente: "¿Cómo hago para tener esto siempre?" ← VENTA
```

El paso 6-7 es el "efecto wow." Todo lo demás es setup para llegar ahí.

### Dos modos de operación del onboarding

**Modo Completo (post-venta / configuración):**
- Las 5 fases de discovery completas
- Síntesis de ClientConfig
- Test con 5-10 fotos
- Deploy a producción
- Para: clientes que ya compraron y necesitan configurar su cuenta

**Modo Demo (pre-venta / presentación):**
- Conversación breve (1-2 minutos, solo lo esencial)
- Upload de referencia (planograma, manual)
- Upload de 1-3 fotos reales
- Comparación instantánea con resultados visuales
- Para: prospectos en reunión de ventas, efecto wow inmediato

El Modo Demo no necesita síntesis completa ni deploy. Usa un prompt ad-hoc que combina
la referencia + la foto + criterios básicos inferidos del tipo de referencia.

### Arquitectura del Modo Demo

```
┌─────────────────────────────────────────────┐
│           Onboarding UI                     │
│                                             │
│  ┌─── Modo Completo (5 fases) ───┐          │
│  │  Chat → Síntesis → Test → Deploy        │
│  └─────────────────────────────────┘         │
│                                             │
│  ┌─── Modo Demo (quick comparison) ──┐      │
│  │  1. Subir referencia              │      │
│  │  2. Subir foto(s) de campo        │      │
│  │  3. Comparación instantánea       │      │
│  │  4. "¿Quieres configurar más?"    │      │
│  │     → Sí: pasar a Modo Completo   │      │
│  │     → No: compartir resultados    │      │
│  └────────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

### Qué se necesita para el Modo Demo

1. **Endpoint `/api/onboarding/compare`** — Recibe referencia + foto, retorna comparación
   - Input: imagen de referencia (planograma) + imagen de campo + tipo de referencia
   - Proceso: un solo call a Gemini con prompt que incluye ambas imágenes
   - Output: reporte de cumplimiento estructurado (surtido %, faltantes, discrepancias)
   - Sin ClientConfig, sin síntesis, sin Supabase — puro análisis directo

2. **UI de comparación** — Vista side-by-side o split-view
   - Izquierda: planograma/referencia
   - Derecha: foto de campo
   - Abajo: reporte de cumplimiento con métricas destacadas
   - Exportable: PDF, Excel, WhatsApp (como el demo actual)

3. **Prompt de comparación ad-hoc** — No usa prompt-builder
   - "Eres un experto en retail visual merchandising. Te doy un planograma de referencia
     y una foto de un anaquel real. Compáralos y reporta..."
   - Retorna: productos esperados vs. encontrados, posiciones correctas/incorrectas,
     precios visibles vs. esperados, score de cumplimiento

4. **Transición Demo → Completo** — Si el prospecto quiere más
   - Botón: "Configurar análisis completo"
   - Pasa al Modo Completo con la referencia ya cargada
   - La conversación arranca con contexto: "Ya tenemos tu planograma.
     Vamos a configurar el análisis completo para tu operación."

### Qué se puede reutilizar del sistema actual

| Componente existente | Uso en Modo Demo |
|---------------------|-----------------|
| `gemini.ts` (analyzeImage) | Llamada a Gemini con 2 imágenes |
| UI del demo (`/demo/page.tsx`) | Patrón de upload + resultados + exports |
| Formatos de export (PDF, Excel, WhatsApp) | Compartir resultados de comparación |
| `cookie.ts` / auth | Gating del acceso a la demo |
| Onboarding UI (`/onboarding/page.tsx`) | Shell para el Modo Demo (nueva vista) |

### Lo que NO se reutiliza (es nuevo)

| Componente nuevo | Descripción |
|-----------------|-------------|
| Prompt de comparación | Prompt ad-hoc para referencia vs. campo |
| Endpoint `/api/onboarding/compare` | API sin config, directo a Gemini |
| Vista de comparación | UI side-by-side con métricas |
| Procesamiento de referencia | Extraer datos del planograma (Gemini multimodal) |

### Capacidades de Gemini relevantes

Gemini Vision puede procesar **múltiples imágenes en un solo request**.
Esto significa que podemos enviar el planograma + la foto de campo en UN solo call:

```
Prompt: "Compara estas dos imágenes..."
Image 1: [planograma]
Image 2: [foto de campo]
```

Esto es eficiente (un solo API call) y Gemini es bueno comparando imágenes side-by-side.
El costo sería ~$0.008 por comparación (2 imágenes × $0.004).

### Flujo de la reunión con René y Carlos (ejemplo)

```
Gonzalo: "Mira, te voy a mostrar algo. ¿Me puedes mandar el planograma?"
Carlos: [manda planograma por WhatsApp/chat]
Gonzalo: [lo sube en la app]
App: "Planograma procesado: 19 modelos, 6 tallas, 114 SKUs detectados"

Gonzalo: "Ahora mándame una foto de uno de tus anaqueles"
Carlos: [manda foto de tienda]
Gonzalo: [la sube]
App: [5 segundos de procesamiento...]
App: "Cumplimiento: 87%
      - Surtido: 16/19 modelos presentes (84%)
      - Posición: 14/16 en ubicación correcta (88%)
      - Precios: 12/14 visibles coinciden (86%)
      - Huecos: 3 posiciones vacías
      - Faltantes: Boxer Moda 535M, Atlética 2525VM, Trusa 5P461L Negro"

Carlos: "...esto es exactamente lo que yo hago a mano"
```

### Prioridad sugerida

1. **Primero: Modo Demo** — Es lo que cierra ventas. Es más pequeño de construir
   (1 endpoint, 1 prompt, 1 vista de UI). Sin Supabase, sin configs, sin síntesis.

2. **Después: Integración al onboarding** — Una vez que sabemos que la comparación funciona,
   integramos la referencia al flujo completo de onboarding (ClientConfig, scoring, deploy).

3. **Al final: Modo producción** — Integración con Evidence/API para procesamiento batch
   de 400-500 fotos/semana contra el planograma configurado.

---

## Decisiones tomadas

1. **¿Quién opera la herramienta?** → **Ambos.** Gonzalo arranca en laptop durante la reunión,
   pero el prospecto también puede probarlo desde su celular después. Esto implica:
   - La UI debe funcionar bien en desktop Y móvil
   - Necesita un link compartible (no requiere que Gonzalo esté presente)
   - Mobile-first para la experiencia del prospecto

2. **¿En qué formato viene el planograma?** → **Ambos.** Algunos clientes mandan imagen/screenshot,
   otros Excel/tabla. El sistema necesita ingestar ambos:
   - Imagen: Gemini Vision extrae datos estructurados de la foto del planograma
   - Excel: parsear directamente con xlsx (ya en el stack)
   - En ambos casos, el output intermedio es el mismo: tabla de SKUs con posiciones y precios

3. **Timeline** → **Sin prisa, bien pensado.** No hay reunión de seguimiento agendada.
   Prioridad es hacer un spec sólido, auditar, y después implementar.

---

## Siguiente paso recomendado

Escribir un spec (`spec/02-reference-comparison.md`) que cubra:

1. **Modo Demo** — Comparación instantánea (referencia + foto → reporte)
   - Endpoint ad-hoc sin ClientConfig
   - UI responsive (desktop + mobile)
   - Soporte para referencia como imagen o Excel
   - Exports (PDF, Excel, WhatsApp)

2. **Extensión del Engine v3** — Integración al modelo de datos
   - Nuevo campo `referenceData` en ClientConfig
   - Nuevo criterion type `match`
   - Prompt builder con contexto de referencia
   - Scoring de cumplimiento (surtido, posición, precio, huecos)

3. **Extensión del Onboarding** — Fase de carga de referencia
   - Nuevo tool `addReference()`
   - Phase 2 ampliada
   - Test runner con comparación
   - Transición Demo → Completo

4. **Mobile UX** — Para que el prospecto lo use solo
   - Link compartible
   - Upload desde cámara del celular
   - Resultados claros en pantalla pequeña

---

## Auditoría pre-implementación

**Fecha:** 2026-03-30
**Resultado global:** Requiere cambios (9 hallazgos críticos consolidados, 8 observaciones)

### Hallazgos críticos

**HC1. Comparación es una feature de primer nivel, no un criterion type.**
El plan proponía `match` como criterion type. Los criterion types miden dimensiones de UNA foto
(binary, scale, count, presence). Comparación opera sobre DOS imágenes — es semánticamente diferente.
- **Resolución:** Crear `ComparisonResult` como tipo separado de `EngineV3Result`. La comparación
  genera su propio output con métricas de cumplimiento (surtido %, posición %, precio %, huecos).
  No se agrega al enum de criterion types.

**HC2. Un solo path de análisis — no prompt ad-hoc.**
El plan contradecía: §6 proponía extender prompt-builder, §8 proponía prompt ad-hoc que "no usa
prompt-builder." Dos paths = doble mantenimiento, inconsistencias en output, doble testing.
- **Resolución:** Extender `prompt-builder.ts` con `buildComparisonPrompt(referenceData, config?)`.
  En Modo Demo se usa con config mínimo generado on-the-fly. En Modo Completo se usa con el
  ClientConfig real. Un solo path, un solo formato de output.

**HC3. `analyzeImage()` debe soportar múltiples imágenes.**
Firma actual acepta 1 imagen. Gemini API sí soporta múltiples `inlineData` en `parts[]`.
- **Resolución:** Crear `analyzeWithReferences(fieldImage, referenceImages[], prompt, apiKey)`
  en `gemini.ts`. Construye el array de `parts` con todas las imágenes + prompt.

**HC4. UI mobile-responsive obligatoria.**
Cero media queries en el codebase. No viewport meta tag. Side-by-side de 2 imágenes de 180px
excede iPhone (375px).
- **Resolución:** Layout stacked (vertical) en mobile (<768px), side-by-side en desktop.
  Agregar `<meta name="viewport">` a root layout. El spec debe especificar breakpoints.

**HC5. Links compartibles para prospectos.**
Email gate (cookie HMAC) bloquea acceso directo por URL. Un prospecto no puede abrir un link
sin pasar por el gate.
- **Resolución:** Endpoint `POST /api/demo/share` genera token corto (UUID, TTL 48h).
  URL tipo `/compare?token=abc123` bypasea email gate. Token se loguea en Supabase.

**HC6. Auth obligatoria en todos los endpoints.**
`.claude/rules/security.md`: "Todo endpoint público debe validar autenticación antes de procesar."
El plan original decía "no auth."
- **Resolución:** El endpoint de comparación requiere email cookie O share token. Rate limit:
  max 10 comparaciones/hora/email. Logging a `bbm_analysis_log`.

**HC7. Resiliencia de Gemini para multi-imagen.**
No hay retry, backoff, ni manejo de rate limit (429). Multi-imagen tarda más → timeout de 55s
puede ser insuficiente. Sin manejo de concurrencia.
- **Resolución:** Exponential backoff con jitter (3 reintentos). Timeout de 90s para comparación
  (vs 55s para análisis simple). Manejar 429 con Retry-After header. Evaluar upgrade a tier
  pagado de Gemini si se espera >60 RPM.

**HC8. Edge cases sin manejar.**
- Foto parcial del anaquel → SKUs fuera de cuadro reportados como "faltantes"
- Planograma rotado o baja calidad → 0% match sin diagnóstico
- Múltiples planogramas por cliente (diferentes departamentos) → sin disambiguación
- Zero matches → sin información de qué salió mal
- **Resolución:** El spec debe incluir:
  - Campo `coverage: 'full' | 'partial'` en request para ajustar expectativas
  - Pre-flight quality check (Gemini rápido: "¿imagen legible? ¿rotada?")
  - Campo `section` en referencia para filtrar por departamento
  - Reporte detallado de mismatch con "esperado vs encontrado" siempre

**HC9. Data model: URLs only para imágenes + tabla de logging.**
- Si se almacenan imágenes base64 en JSONB de ClientConfig, las rows se inflan (>1MB).
- No existe tabla de logging para comparaciones.
- **Resolución:** Imágenes de referencia siempre como URLs (S3/GCS/Vercel Blob), nunca base64
  en config. Crear migración `bbm_comparison_log` con: reference_id, match_score, mismatches
  (JSONB), processing_time_ms, model. Validar max 500KB en campo config JSONB.

### Observaciones (resolver durante implementación o aceptar riesgo)

| # | Observación | Decisión |
|---|-------------|----------|
| O1 | Planogram versioning (cambian por temporada) | Diferir a v2. Para v1, un planograma activo por sección. |
| O2 | Excel parsing trivial pero matching semántico complejo | Incluir en spec. Definir schema esperado de Excel. |
| O3 | SSRF risk en URLs de referencia | Validar HTTPS-only + bloquear IPs privadas en Zod schema. |
| O4 | Exports (PDF/Excel/WhatsApp) necesitan campos de comparación | Extender templates existentes con métricas de cumplimiento. |
| O5 | Escalation triggers extensibles para comparación | Agregar `compliance_below` trigger type al spec. |
| O6 | Tokens Gemini OK (~15K de 128K límite) | No acción. Monitorear si planogramas crecen. |
| O7 | No se necesitan nuevas dependencias npm | OK. Usar xlsx (ya instalado) para parsing de Excel. |
| O8 | Non-Latin text (CJK) en productos | Diferir. Clientes actuales son LATAM (español). Documentar limitación. |

### Fases de implementación (revisadas post-auditoría)

**Fase 0 — Infraestructura (prerequisitos)**
- Migración Supabase: tabla `bbm_comparison_log`
- Extender `gemini.ts` con `analyzeWithReferences()` (multi-imagen)
- Agregar viewport meta tag a root layout
- Validación HTTPS-only en referenceImages Zod schema
- Retry/backoff para Gemini 429

**Fase 1 — Modo Demo (lo que cierra ventas)**
- Endpoint `POST /api/compare` (auth: email cookie o share token)
- `buildComparisonPrompt()` en prompt-builder.ts
- Tipo `ComparisonResult` (surtido, posición, precio, huecos, faltantes)
- UI responsive: upload referencia + upload foto → resultados
- Share token endpoint (`POST /api/demo/share`)
- Exports extendidos con métricas de cumplimiento

**Fase 2 — Integración Engine v3 (post-venta)**
- Campo `referenceData` en ClientConfig (Zod schema, URL-only)
- `comparisonRules` en ClientConfig (no criterion type)
- Prompt builder ampliado para inyectar referencia en análisis estándar
- Scoring server-side de cumplimiento
- Trigger `compliance_below` en escalación
- Onboarding: Phase 2 pregunta por referencia, upload, procesamiento

**Fase 3 — Producción (batch processing)**
- Endpoint API de producción con comparación (Bearer token auth)
- Procesamiento batch de múltiples fotos contra un planograma
- Excel como formato de entrada para planogramas
- Dashboard de cumplimiento por tienda/promotor (si aplica)

### Tests requeridos

| Tipo | Qué verificar | Prioridad |
|------|--------------|-----------|
| Unit | `analyzeWithReferences()` — construye parts[] correcto con N imágenes | Alta |
| Unit | `buildComparisonPrompt()` — inyecta datos de referencia en prompt | Alta |
| Unit | `ComparisonResult` — Zod schema valida output de comparación | Alta |
| Unit | Share token generation + validation + TTL | Alta |
| Integración | Endpoint `/api/compare` — auth + Gemini call + response shape | Alta |
| Integración | Retry/backoff en Gemini 429 | Media |
| Integración | Referencia como imagen vs. Excel → mismo output intermedio | Media |
| Visibilidad | UI mobile (375px): upload + resultados legibles | Alta |
| Visibilidad | UI desktop: side-by-side + exports | Alta |
| E2E | Flujo completo: subir planograma FOTL + foto tienda → reporte cumplimiento | Alta |
| Edge case | Foto parcial → no reporta faltantes fuera de cuadro | Media |
| Edge case | Planograma baja calidad → error claro, no 0% silencioso | Media |

### Criterios de aceptación

1. **Modo Demo funcional:** Subir planograma (imagen o Excel) + foto de campo → reporte de
   cumplimiento en <15 segundos, con % surtido, faltantes, y discrepancias
2. **Mobile usable:** Un prospecto puede abrir un link compartido en su celular, subir fotos
   desde cámara, y ver resultados sin scroll horizontal ni elementos cortados
3. **Auth y rate limit:** Todos los endpoints protegidos. Max 10 comparaciones/hora/email.
   Logging de toda comparación en Supabase.
4. **No breaking changes:** El demo existente (`/demo`), el onboarding (`/onboarding`), y la
   API de producción (`/api/analyze`) siguen funcionando sin cambios.
5. **Exports:** PDF y Excel incluyen métricas de cumplimiento (surtido, posición, precio, huecos)
6. **Tests:** Todos los tests unitarios + integración + E2E de prioridad Alta pasan

### Riesgos residuales

1. **Precisión de Gemini en comparación visual:** No hay benchmark de qué tan bien Gemini
   compara un planograma contra una foto real. La primera implementación será experimental.
   Mitigación: recopilar feedback (rating ok/no como en onboarding test).

2. **Fotos parciales:** El sistema no puede saber qué parte del anaquel NO se ve en la foto.
   Si el promotor fotografía solo la mitad, los faltantes pueden ser falsos positivos.
   Mitigación: campo `coverage` + documentación para promotores.

3. **Calidad fotográfica variable:** Promotores en campo usan celulares diversos, iluminación
   mala, ángulos oblicuos. Esto afecta la detección de SKUs y precios.
   Mitigación: pre-flight quality check + guía de buenas prácticas fotográficas.
