# BBM — Roadmap Específico: Franquicia de Restaurantes (Caso Guillermo/BBM)

**Fecha:** 26 de marzo de 2026 **Fuente:** Demo en vivo con Guillermo y Alberto (BBM / Ubiqo) **Contexto:** Gonzalo presentó las capacidades de análisis visual de BBM aplicadas a evaluación de sucursales de franquicia de restaurantes de comida rápida (tipo hamburguesas).

---

## Hallazgos Clave de la Reunión

### Lo que Guillermo necesita

1. **Evaluación de sucursales de franquicia** — verificar cumplimiento visual en múltiples ubicaciones  
2. **Resultado binario como base** — "¿está o no está?" (la lona, el material promocional, etc.)  
3. **Pero con gradualidad posible** — "¿está pero ya se quemó con el sol?" → condición del material  
4. **Campañas que rotan** — material promocional cambia cada 3 semanas (mundial, temporadas, promos)  
5. **Consumo por humanos** — dashboard para gerentes, no integración a otro sistema  
6. **Comparación entre sucursales** — ranking por tienda, franquiciatario, zona, región  
7. **Valor para el franquiciatario** — la inquietud principal de Guillermo: cómo hacer que el franquiciatario QUIERA usarlo, no solo la marca

### Lo que el demo mostró (y funcionó)

- Análisis de foto de fachada de restaurante → detectó promoción, señalética, precios, combos  
- Compliance automático contra criterios  
- Múltiples formatos de exportación (WhatsApp, JSON, PDF, Excel, email)  
- Capacidad de definir reglas custom de evaluación

### Lo que falta definir (action items del cliente)

- **Criterios de evaluación específicos** — qué áreas evaluar (exterior, mesas, cocina, baños)  
- **Imágenes de referencia** — fotos de lo correcto vs lo incorrecto para entrenar  
- **Áreas por sucursal** — cuántas fotos por visita (5-10 dependiendo de áreas)

---

## Propuesta de Implementación por Fases

### Fase 0 — Definición de Criterios (1-2 semanas, colaborativo)

**Objetivo:** Construir el "checklist visual" que BBM va a evaluar automáticamente.

| Área | Criterios sugeridos | Tipo evaluación |
| :---- | :---- | :---- |
| **Fachada** | Lona promocional vigente, señalética legible, iluminación, limpieza exterior | Binario \+ condición |
| **Material Promocional** | Promo correcta vs campaña vigente, estado del material (nuevo/dañado/descolorido) | Binario \+ condición |
| **Interior — Mesas** | Limpieza, orden, estado del mobiliario, material de mesa | Scoring 0-100 |
| **Interior — Cocina** | (Si aplica) Limpieza visible, orden, EPP del personal | Scoring 0-100 |
| **Baños** | Limpieza, dispensadores, funcionamiento | Scoring 0-100 |
| **Precios** | Precios visibles y correctos vs lista oficial | Binario |
| **Uniforme/Personal** | Uniforme correcto, limpio, gafete visible | Binario \+ condición |

**Entregable:** JSON Schema de evaluación por área, listo para inyectar en el engine de BBM.

**Lo que necesitamos de Guillermo:**

- Validar/ajustar las áreas de arriba  
- Enviar 3-5 fotos de "sucursal ideal" y 3-5 de "sucursal con problemas"  
- Definir cuántas áreas y cuántas fotos por visita

### Fase 1 — Motor de Scoring por Sucursal (1-2 semanas)

**Objetivo:** De "la IA lee una foto" a "la IA califica una sucursal completa".

**Qué se construye:**

1. **Reglas custom para franquicia de restaurante** → inyectadas en el prompt de BBM  
2. **Score por área** (0-100) con semáforo (verde/amarillo/rojo)  
3. **Score compuesto por sucursal** \= promedio ponderado de áreas  
4. **Comparación contra campaña vigente** — la marca sube la referencia de la promo actual y BBM compara

**Ponderación sugerida (ajustable):**

| Área | Peso |
| :---- | :---- |
| Fachada / Material Promocional | 30% |
| Interior — Mesas | 25% |
| Cocina | 20% |
| Baños | 15% |
| Uniforme/Personal | 10% |

**Output por sucursal:**

```
Sucursal: Querétaro Centro
Score General: 78/100 (AMARILLO)
├── Fachada: 85 (VERDE) — Promo vigente, señalética OK
├── Mesas: 72 (AMARILLO) — 2 mesas sin limpiar
├── Cocina: 80 (VERDE) — Orden OK, EPP correcto
├── Baños: 65 (AMARILLO) — Dispensador vacío
└── Personal: 90 (VERDE) — Uniforme correcto
```

### Fase 2 — Dashboard Multi-Sucursal (2-3 semanas)

**Objetivo:** La vista que Guillermo realmente necesita — comparar TODAS las sucursales.

**Qué se construye:**

1. **Grid de sucursales** con score, tendencia (subió/bajó vs visita anterior), semáforo  
2. **Filtros:** por zona, por franquiciatario, por rango de score, por período  
3. **Ranking:** mejores y peores performers  
4. **Alertas automáticas:** sucursal que baja más de 15 puntos entre visitas  
5. **Vista por franquiciatario:** promedio de todas sus sucursales → accountability

**Dimensiones de comparación:**

- Sucursal vs sucursal  
- Franquiciatario vs franquiciatario (promedio de sus sucursales)  
- Zona vs zona  
- Región vs región  
- Temporal: esta semana vs la pasada, este mes vs el anterior

### Fase 3 — Valor para el Franquiciatario (diferenciador)

**Objetivo:** Resolver la inquietud central de Guillermo — "cómo le damos valor al franquiciatario para que SÍ lo quiera usar".

**Insight:** Si BBM solo sirve para que la marca vigile al franquiciatario, el franquiciatario lo ve como amenaza. Hay que invertir la dinámica.

**Propuestas de valor para el franquiciatario:**

1. **"Mi sucursal vs el promedio"** — el franquiciatario ve dónde está parado vs la red. Si está arriba, es reconocimiento. Si está abajo, es guía de mejora.  
     
2. **Reporte automático de mejora** — BBM detecta que el franquiciatario mejoró fachada y genera un reporte visual "antes/después" que puede compartir con la marca o en redes.  
     
3. **Detección de oportunidades** — la IA no solo evalúa compliance, también detecta: "esta sucursal tiene alto tráfico pero baja visibilidad de la promo → oportunidad de incrementar ventas con mejor señalética".  
     
4. **Benchmarking anónimo** — el franquiciatario ve su score vs el promedio de la zona SIN saber quiénes son los otros. Motivación por competencia sana.  
     
5. **Certificado digital de excelencia** — sucursales con score \>90 durante 3 meses reciben badge "Sucursal Premium". Valor de marca para el franquiciatario.

---

## Modelo de Pricing Sugerido

| Tier | Sucursales | Precio/mes | Incluye |
| :---- | :---- | :---- | :---- |
| **Starter** | 1-20 | $4,900 MXN | 500 análisis/mes, dashboard básico, 1 usuario admin |
| **Growth** | 21-100 | $12,900 MXN | 3,000 análisis/mes, dashboard completo, comparativos, 5 usuarios |
| **Enterprise** | 100+ | $24,900 MXN | Análisis ilimitados, API, white-label, alertas, usuarios ilimitados |

**Costo real por análisis:** \~$0.002 USD por imagen (Gemini). A 3,000 imágenes/mes \= \~$6 USD \= \~$100 MXN. **Margen:** \>95% en todos los tiers.

---

## Cruce con Roadmap General BBM

| Feature del Roadmap General | Relevancia para Franquicia | Prioridad |
| :---- | :---- | :---- |
| Selector de industria | ALTA — seleccionar "Franquicia/Restaurante" activa reglas custom | Ya existe en roadmap |
| Antes/Después | ALTA — rotación de material promocional cada 3 semanas | Ya existe en roadmap |
| Scoring numérico 0-100 | CRÍTICA — es exactamente lo que pidió Guillermo | Ya existe en roadmap |
| Dashboard batch | CRÍTICA — vista multi-sucursal es el entregable core | Ya existe en roadmap |
| Formulario inteligente | MEDIA — podría usarse para reporte de visita | Ya existe en roadmap |
| Comparación vs planograma | BAJA para este caso (no hay planograma, hay "campaña vigente") | Adaptar a "campaña vigente" |
| White-label | ALTA — Guillermo querrá poner marca de la franquicia | Ya existe en roadmap |

---

## Próximos Pasos Inmediatos

1. **Guillermo envía:** criterios de evaluación por área \+ fotos de referencia (correcto/incorrecto)  
2. **Nosotros:** configuramos reglas custom en BBM para "Franquicia Restaurante"  
3. **Demo 2:** corremos las fotos de Guillermo con las reglas custom y mostramos scoring real  
4. **Decisión:** si funciona, arrancamos Fase 1 con piloto en 5-10 sucursales

---

## Conexión con Evidence (Ubiqo)

BBM se integra como capa de inteligencia sobre Evidence:

- **Evidence** \= captura de fotos en campo (ya lo usan los promotores/supervisores)  
- **BBM** \= análisis automático de las fotos que Evidence ya captura  
- **Flujo:** Supervisor toma foto en Evidence → foto llega a BBM → BBM devuelve score → score aparece en dashboard

Esta integración es la que habilita escalar a los 11 clientes de Evidence. La franquicia de Guillermo sería el **caso piloto \#2** (después de la demo de retail que ya funciona).  
