# Demo v2 — Roadmap

> Plan generado el 26 mar 2026, cruzando la reunión con Enrique Coronel (25 mar),
> el estado actual del código (PR #1 mergeado), y el research de 11 clientes Evidence.
>
> **Objetivo:** Transformar el demo de "mira lo que puede hacer la IA con una foto"
> a "mira cómo tu operación se simplifica mañana".

---

## Estado actual del demo (post-PR #1)

- [x] Engine hybrid-v2 (single-pass + condition escalation)
- [x] 7 facetas de análisis (inventory, shelf_share, pricing, compliance, condition, context, insights)
- [x] Email gate + usage tracking (Supabase `bbm_users` + `bbm_analysis_log`)
- [x] 5 formatos exportación (WhatsApp ES, JSON, PDF marca IP, Excel, imagen anotada)
- [x] Batch de hasta 5 imágenes (2 paralelo)
- [x] Truncation detection + precision fix (maxOutputTokens 8192)
- [x] PDF con colores Integrador Pro

---

## Fase 1 — Quick Wins (1-2 días cada uno)

### 1.1 Selector de industria (personalización del análisis)

**Impacto:** Máximo — cada cliente ve resultados relevantes a SU operación.

**Qué hacer:**
- Agregar pantalla post-gate con selector: "¿Qué tipo de operación tienes?"
- Opciones: Retail/Promotoría, Construcción, Seguridad, Limpieza/Mantenimiento, Farmacéutica, Telecom/Infraestructura
- Guardar selección en cookie + `bbm_users.industry`
- Pasar reglas custom al prompt vía `buildSinglePassPrompt(customRules)`

**Código afectado:**
- `src/app/demo/gate.tsx` — agregar paso 2 después del email
- `src/lib/prompts.ts` — ya soporta `customRules`, solo falta definir las reglas por industria
- `src/app/api/demo/analyze/route.ts` — leer industria de cookie y pasar al prompt
- `src/hooks/useEmailGate.ts` — extender para incluir industry
- Supabase: `ALTER TABLE bbm_users ADD COLUMN industry TEXT;`

**Reglas por industria (inyectar en customRules):**

```
RETAIL/PROMOTORIA:
- Priorizar: frenteo (facing), share of shelf, compliance POP, planograma
- Scoring: % de facing correcto, presencia de marca, material promocional vigente
- Output key: "execution_score" (0-100)

CONSTRUCCION:
- Priorizar: avance de obra, EPP (casco, chaleco, arnés), calidad de acabado, maquinaria
- Scoring: % avance visible, compliance seguridad, condición equipo
- Output key: "safety_compliance_score", "progress_pct"

SEGURIDAD:
- Priorizar: estado del punto de ronda, accesos, iluminación, señalización
- Scoring: condición general, riesgos detectados
- Output key: "checkpoint_score"

LIMPIEZA/MANTENIMIENTO:
- Priorizar: limpieza antes/después, daños, estado de equipos, plagas
- Scoring: limpieza (0-100), issues por área
- Output key: "cleanliness_score"

FARMACEUTICA:
- Priorizar: productos en anaquel, fechas de caducidad visibles, material médico, competencia
- Scoring: share of shelf, compliance regulatorio
- Output key: "pharma_compliance_score"

TELECOM/INFRAESTRUCTURA:
- Priorizar: estado de equipo, cableado, seguridad eléctrica, señalización
- Scoring: condición infraestructura, riesgos
- Output key: "infrastructure_score"
```

**Clientes que se benefician:** TODOS los 11.

---

### 1.2 Modo Antes/Después (comparación de 2 fotos)

**Impacto:** Alto — caso de uso universal para cualquier operación de campo.

**Qué hacer:**
- Toggle en UI: "Comparar antes/después"
- Cuando activo: pedir exactamente 2 fotos (antes + después)
- Enviar ambas al modelo en un solo request con prompt comparativo
- Generar reporte de delta: qué cambió, qué mejoró, qué empeoró, % de mejora

**Código afectado:**
- `src/app/demo/page.tsx` — agregar toggle, limitar a 2 fotos cuando activo
- `src/lib/prompts.ts` — nuevo prompt `buildComparisonPrompt()`
- `src/app/api/demo/analyze/route.ts` — nueva ruta o flag `mode: "compare"`
- Gemini soporta múltiples imágenes en un request — enviar ambas
- Exports: adaptar WhatsApp/PDF/Excel para mostrar deltas

**Prompt comparativo (nuevo):**

```
You are comparing two photos of the same location: BEFORE and AFTER an intervention.

For each of the 7 facets, report:
1. State in BEFORE photo
2. State in AFTER photo
3. What changed (improved, worsened, unchanged)
4. Improvement percentage where applicable

Output JSON:
{
  "comparison_summary": "Executive summary of changes",
  "overall_improvement_pct": 0-100,
  "facet_deltas": [
    {
      "facet": "...",
      "before": "...",
      "after": "...",
      "change": "IMPROVED|WORSENED|UNCHANGED",
      "delta_detail": "..."
    }
  ],
  "notable_changes": [],
  "remaining_issues": []
}
```

**Clientes que se benefician:**
- Urbaser Colombia (limpieza: antes=sucio, después=limpio — prueba para auditoría municipal)
- Construcción SB (avance obra: semana 1 vs semana 2)
- Epoxemex (aplicación producto: piso sin vs con recubrimiento)
- Métrica BTL (activación: antes=anaquel desordenado, después=frenteo ejecutado)

---

### 1.3 Traducción completa a español

**Impacto:** Requisito mínimo para mercado MX/LATAM.

**Qué hacer:**
- Gate screen: "Retail photo analysis powered by AI" → "Análisis de fotos de campo con IA"
- Badges: COMPLETE → COMPLETO, ESCALATED → ESCALADO
- Secciones: Inventory → Inventario, Shelf Share → Participación en Anaquel, etc.
- Prompt: agregar instrucción `Respond in Spanish` al prompt
- Exports: ya están mayormente en español, revisar consistencia
- Email template: traducir a español

**Archivos a tocar:**
- `src/app/demo/page.tsx` — strings de UI
- `src/app/demo/gate.tsx` — textos del gate
- `src/app/demo/export-menu.tsx` — labels del menú
- `src/lib/prompts.ts` — instrucción de idioma
- `src/lib/email.ts` — template HTML

**Esfuerzo:** 2-3 horas.

---

## Fase 2 — Diferenciadores (1 semana cada uno)

### 2.1 Formulario inteligente (llenado automático desde foto)

**Impacto:** MUY alto — es el feature que Enrique pidió. El que vende.

**Qué hacer:**
- UI para definir un formulario (o cargar JSON schema)
- Al analizar foto, BBM llena los campos automáticamente
- El usuario solo revisa y corrige
- En el demo: formulario de ejemplo precargado ("Reporte de visita a tienda")

**Schema del formulario (ejemplo):**

```json
{
  "form_name": "Reporte de visita — Tienda de mascotas",
  "fields": [
    {"id": "store_name", "label": "Nombre de tienda", "type": "text", "source": "context.establishment_type"},
    {"id": "brands_found", "label": "Marcas encontradas", "type": "list", "source": "shelf_share.brands[].name"},
    {"id": "total_products", "label": "Total de productos", "type": "number", "source": "inventory.total_skus_detected"},
    {"id": "dominant_brand", "label": "Marca dominante", "type": "text", "source": "shelf_share.dominant_brand"},
    {"id": "pop_present", "label": "Material POP presente", "type": "boolean", "source": "compliance.pop_materials.present"},
    {"id": "cleanliness", "label": "Estado de limpieza", "type": "select", "options": ["Limpio", "Aceptable", "Sucio"], "source": "condition.cleanliness"},
    {"id": "issues", "label": "Problemas detectados", "type": "list", "source": "compliance.issues"},
    {"id": "photo_notes", "label": "Observaciones", "type": "text", "source": "additional_observations"}
  ]
}
```

**Flujo en el demo:**
1. Usuario sube foto
2. BBM analiza (engine normal)
3. Resultado se mapea al formulario automáticamente
4. Usuario ve formulario lleno con campos editables
5. Exporta como PDF/Excel con el formulario completo

**Dato de ROI para la presentación a René:**
- 150 formularios/día × 8 min manual = 20 hrs/día de captura
- Con BBM: 150 fotos × 2 min revisión = 5 hrs/día
- **Ahorro: 75% del tiempo de captura = 15 hrs/día**

**Clientes que se benefician:**
- Métrica BTL (150 formularios/día, 30 fotos/formulario)
- Auto Todo (160 rutas/día, cada entrega es un formulario)
- Menarini (visitas médicas, cada visita requiere reporte)
- Acuario Lomas (entregas + display)

---

### 2.2 Scoring numérico (0-100) con semáforo

**Impacto:** Habilita Tier 3 — métricas comparables entre ubicaciones y en el tiempo.

**Qué hacer:**
- Agregar `execution_score: 0-100` al schema del prompt
- Ponderación por faceta (configurable por industria):
  - Retail: compliance 30%, inventory 25%, shelf_share 20%, condition 15%, context 10%
  - Construcción: safety 35%, progress 30%, condition 25%, compliance 10%
- UI: score prominente con color (verde 80+, amarillo 50-79, rojo <50)
- En exports: score como KPI principal

**En el prompt, agregar:**

```
STEP 4 — CALCULATE execution_score (0-100):
Weight each facet by industry relevance and produce a single numeric score.
Score reflects: "How well was this location executing vs ideal?"
- 90-100: Exemplary execution
- 70-89: Good, minor improvements possible
- 50-69: Needs attention
- 30-49: Significant issues
- 0-29: Critical intervention needed
```

**Por qué importa para el pitch:**
- "Tu sucursal 14 bajó de 87 a 72 este mes" > "Tu sucursal tiene compliance MEDIUM"
- Números permiten benchmarks, tendencias, comparaciones entre agentes/zonas
- Coronel puede cobrar por resultado: "te garantizo que subes de 65 a 85 en 3 meses"

---

### 2.3 Dashboard de batch (vista gerente)

**Impacto:** Alto para enterprise — los que compran no son los que toman fotos.

**Qué hacer:**
- Nueva ruta `/demo/dashboard` con data de ejemplo
- Grid de N análisis con: thumbnail, score, tipo, severity
- Aggregados: score promedio, distribución por severity, worst performers
- Filtros: por fecha, por score, por tipo
- No requiere backend real — puede usar los análisis del batch actual

**Clientes que se benefician:**
- Banco Itaú (168 sucursales → "¿cuáles tienen compliance bajo?")
- Urbaser (auditoría municipal → "¿qué rutas están por debajo del estándar?")
- Auto Todo (160 rutas → "¿qué zonas tienen más problemas de entrega?")
- GTAC (159 PoPs → "¿qué nodos necesitan mantenimiento?")

---

## Fase 3 — Moat Competitivo (2+ semanas)

### 3.1 Comparación contra planograma

- Cliente sube imagen de planograma ideal
- BBM compara foto real vs ideal
- Reporte de discrepancias: productos faltantes, posición incorrecta, marcas invasoras
- **Involves no tiene esto** — es diferenciador claro
- Clientes: Métrica BTL (Oxxo, SuperC), Acuario Lomas, Menarini

### 3.2 API documentada + sandbox

- Documentar `/api/analyze` con examples, schemas, error codes
- Sandbox interactivo (tipo Swagger/Redoc)
- Necesario para integración con Evidence (Ubiqo)
- El demo convence al director; la API convence al CTO

### 3.3 White-label

- Logo del cliente en reportes PDF/Excel/email
- Colores personalizables
- Dominio custom (CNAME)
- Coronel lo pidió explícitamente: "los clientes quieren poner sus logos"

---

## Orden de implementación recomendado

| # | Feature | Esfuerzo | Impacto | Para la reunión con René |
|---|---------|----------|---------|--------------------------|
| 1 | Selector de industria | 1 día | Máximo | Si |
| 2 | Antes/Después | 1-2 días | Alto | Si |
| 3 | Español completo | 3 hrs | Requisito | Si |
| 4 | Formulario inteligente | 3-5 días | MUY alto | Ideal |
| 5 | Scoring numérico | 2 días | Alto | Ideal |
| 6 | Dashboard batch | 3-5 días | Alto | Bonus |
| 7 | Planograma | 2 semanas | Diferenciador | No (fase siguiente) |
| 8 | API docs | 1 semana | Medio | No |
| 9 | White-label | 1 semana | Medio | No |

---

## Métricas de éxito

- **Pre-René:** Items 1-3 implementados (selector + antes/después + español)
- **Post-René:** Items 4-5 implementados según feedback
- **Conversion metric:** % de usuarios gate que completan al menos 1 análisis
- **Engagement metric:** análisis promedio por usuario por sesión
- **Revenue signal:** cuántos piden pricing después de probar

---

## Notas de implementación

### Supabase migrations necesarias
```sql
ALTER TABLE bbm_users ADD COLUMN industry TEXT;
ALTER TABLE bbm_analysis_log ADD COLUMN industry TEXT;
ALTER TABLE bbm_analysis_log ADD COLUMN execution_score INTEGER;
ALTER TABLE bbm_analysis_log ADD COLUMN comparison_mode BOOLEAN DEFAULT FALSE;
```

### Vercel considerations
- `maxDuration=60` requiere Pro plan ($20/mo) — en Hobby timeout a 10s
- Antes/Después envía 2 imágenes → tokens input ~doble → verificar que no exceda límites
- Dynamic imports para jsPDF y xlsx ya están — mantener patrón para nuevos módulos

### Variables de entorno nuevas
Ninguna — todo se configura con las existentes + industria en cookie/Supabase.
