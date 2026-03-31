# Resumen Ejecutivo — Reunión Retail (Ropa Interior / Fruit of the Loom)

**Fecha:** 30 de marzo de 2026
**Duración:** ~66 minutos
**Transcripción completa:** `docs/ubiqo/reunion-2026-03-30-retail.md`

---

## Participantes

| Persona | Rol | Notas |
|---------|-----|-------|
| **Gonzalo León** | BBM / Producto | Presentó demo de análisis visual |
| **Enrique** | UBIQO Comercial | Maneja la relación con el cliente |
| **René** | Cliente — Dir. Operaciones | Toma decisiones operativas; puede aprobar sin consultar al dueño |
| **Carlos** | Cliente — Coord. Anaqueles | Revisa evidencia fotográfica de promotores semanalmente |
| **Andrés** | Cliente — Dueño (no presente) | Rol comercial, aprueba proyectos grandes |

---

## Contexto del Cliente

- **Industria:** Retail — ropa interior masculina (Fruit of the Loom, marcas ECO)
- **Operación:** ~400-500 carpetas de evidencia fotográfica por semana
- **Tiendas:** Cadenas como Soriana, posiblemente Home Depot (construcción ligera)
- **Equipo:** Promotores en campo que toman fotos de anaqueles y llenan formularios en Evidence (UBIQO)
- **Proceso actual:** Carlos revisa manualmente TODAS las fotos, genera incidencias en Excel, retroalimenta a cada promotor individualmente
- **Pain point principal:** El proceso es 100% manual, depende del ojo humano, toma un dia completo por semana, y se le pasan cosas por fatiga visual

---

## Qué les mostró Gonzalo

Demo del análisis genérico de BBM con fotos de anaquel (Soriana):
- Identificación de productos, cantidades, marcas
- Lectura de precios desde etiquetas
- Participación en anaquel (shelf share)
- Condiciones del anaquel (limpieza, iluminación, huecos)
- Hallazgos y observaciones automáticas
- Formatos de salida: WhatsApp, JSON, PDF, Excel, email

---

## Reacciones y Necesidades Identificadas

### 1. Comparación contra planograma (ALTA PRIORIDAD)
- René lo propuso directamente: subir el planograma y que la IA compare la foto contra el planograma
- Carlos compartió un planograma de caballeros (Fruit of the Loom) durante la llamada
- Necesitan definir criterios de evaluación: binario (cumple/no cumple) vs. graduado (calificación)
- **Material recibido:** Planograma con ~19 modelos, 6 tallas (Chica a 2XL), precios $169-$249

### 2. Detección de incidencias automática
- Huecos/agotados en anaquel
- Exhibición mal ejecutada
- Producto faltante vs. planograma
- Fotos de mala calidad

### 3. Lectura de precios
- Carlos lo destacó como algo muy valioso
- Actualmente pide a promotores fotos grandes donde se vean precios
- La IA identificó precios correctamente incluso cuando apenas se veían

### 4. Automatización de reportes de asistencia (NO es visión)
- Formularios de check-in/check-out de promotores
- Detectar: retardos, falta de check-in, salidas anticipadas
- Hoy lo hace manualmente en Excel, le toma un dia completo
- Esto es procesamiento de datos estructurados, no análisis de imagen

### 5. Interpretación de otros formularios
- Tienen múltiples formularios además de fotos
- Quieren que la IA interprete datos de horarios, precios, inventarios

---

## Señales de Compra

| Señal | Cita textual (parafraseo) |
|-------|--------------------------|
| Validación fuerte | Carlos: "Creo que es bastante util, nos saltaria el proceso mecanico" |
| Disposicion a colaborar | Rene: "Si necesitas mas informacion, lo hacemos sin problema" |
| Preferencia por suscripcion | Carlos: "Me hace mas sentido el que sea permanente, a que sea bajo demanda" |
| Sensibilidad al precio | Carlos: "Si yo le digo a mi jefe que se le duplica, nos va a decir 'mejoras tu trabajo'" |
| Uso extensivo | Carlos: "Yo lo podria usar para todo" |
| Ofrecen mas datos | Rene: "Tenemos varias marcas... Home Depot, construccion ligera" |

---

## Modelo de Negocio Explorado

- **Opcion A:** Suscripcion mensual del modulo IA (preferida por el cliente)
- **Opcion B:** Creditos bajo demanda
- **Restriccion:** Precio debe ser competitivo, no puede duplicar el costo actual de Evidence

---

## Compromisos y Siguiente Paso

| Compromiso | Responsable | Estado |
|------------|-------------|--------|
| Trabajar comparacion foto vs. planograma con los materiales recibidos | Gonzalo | **Pendiente** |
| Compartir resultado de prueba planograma via Enrique | Gonzalo → Enrique → Cliente | Pendiente |
| Enviar planograma de caballeros | Carlos (ya enviado) | **Recibido** |
| Ofrecer planogramas adicionales (otras marcas, Home Depot) | Rene/Carlos | Ofrecido, pendiente |
| Bajar reporte de asistencia de Evidence para compartir | Enrique | Pendiente |
| Armar propuesta comercial | Gonzalo + Enrique | Pendiente |

---

## Analisis del Planograma Recibido

El planograma muestra la linea completa de **Fruit of the Loom caballeros** con:

| Categoria | Modelos | Piezas/paquete | Precio |
|-----------|---------|----------------|--------|
| Atletica (cuello V y redondo) | 2501M, 3P261CM, 2525VM, 2727M | 3 pzas | $169 - $195 |
| Trusa | 5P461L (colores/negro) | 5 pzas | $229 |
| Boxer Brief | 4BB761M (7 variantes: colores, negro, azules, estampados) | 4 pzas | $249 |
| Boxer Trunk | 4TR762M, 4TR761M (4 variantes: negro, colores, estampados) | 4 pzas | $249 |
| Boxer Moda | 535M (colores), 536M (colores) | 3 pzas | $209 |

**Tallas:** Chica, Mediana, Grande, Extragrande, 2XL
**Total SKUs visibles:** ~19 modelos x 6 tallas = ~114 SKUs
**Cada fila del planograma = una talla**, cada columna = un modelo

---

## Fotos de Anaquel Recibidas (para contrastar con planograma)

### Foto 1 — Boxer Briefs / Boxer Trunks
- Angulo frontal del anaquel principal
- 5 estantes visibles, densamente cargados
- Predomina empaque azul (Fruit of the Loom) con variantes ECO
- Etiquetas de precio visibles: $229, $249, $209
- Tallas visibles en empaques: M, G, CH
- Se observan tanto packs de 4 como de 5 piezas

### Foto 2 — Atleticas / Trusas / Boxer Briefs (seccion izquierda)
- Muestra la parte izquierda del anaquel
- Atleticas (cuello V y redondo) en la parte superior
- Trusas y Boxer Briefs mas abajo
- Empaques blancos (atleticas) y azules/negros (boxers)
- Precios visibles: $149, $108
- Señaletica de tienda visible en techo (icono de camiseta y zapato)

---

## Implicaciones para BBM

1. **Feature critica nueva:** Comparacion foto vs. planograma (no existe hoy)
   - Requiere: ingestar planograma como referencia, mapear SKUs por posicion, evaluar cumplimiento
   - Es el diferenciador que cierra la venta

2. **Volumen:** 400-500 fotos/semana por este solo cliente
   - Si se procesan todas, ~2,000 analisis/mes
   - Costo Gemini estimado: ~$8/mes (a $0.004/imagen)

3. **Entregable principal:** Excel con incidencias por promotor y por tienda
   - No necesitan UI bonita — necesitan datos exportables
   - El flujo ideal: foto → analisis → incidencia automatica → Excel/PDF para retroalimentar promotor

4. **Oportunidad adicional:** Automatizacion de reportes de asistencia
   - Esto NO es vision, es procesamiento de datos de formularios
   - Podria ser un segundo modulo o parte de la propuesta
