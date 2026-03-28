# Analisis de Clientes Evidence \+ Prospectos Directos

## Contexto

Este documento presenta el analisis de los 11 clientes actuales de Evidence (UBIQO) y prospectos directos de BBM, evaluados como candidatos para la integracion con **Black Box Magic (BBM)** — motor de analisis visual por inteligencia artificial.

BBM interpreta fotos de campo y devuelve insights estructurados en JSON. Se integra como capa de inteligencia sobre la captura fotografica que ya realizan los usuarios de Evidence.

**Ventaja competitiva vs Involves:** $0 setup (vs $140K MXN), sin entrenamiento por SKU, costo por imagen \~$0.002 USD, despliegue en dias (vs 2-3 meses).

**Actualizado:** 26 de marzo de 2026 — Agregado cliente \#12 (Franquicia Restaurante / Guillermo) tras demo en vivo.

## Ranking General

| \# | Empresa | Industria | Potencial BBM | Estado |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Metrica BTL | Marketing BTL | Muy Alto | Research |
| 2 | Urbaser Colombia | Gestion residuos | Muy Alto | Research |
| 3 | Construccion SB | Construccion | Muy Alto | Research |
| 4 | **Franquicia Restaurante (Guillermo)** | **Franquicias QSR** | **Muy Alto** | **Demo realizado 26 mar** |
| 5 | Auto Todo | Autopartes wholesale | Alto | Research |
| 6 | Menarini | Farmaceutica | Alto | Research |
| 7 | GTAC | Telecom fibra optica | Alto | Research |
| 8 | Acuario Lomas | Mascotas wholesale | Solido | Research |
| 9 | Banco Itau Chile | Banca | Medio-Alto | Research |
| 10 | Epoxemex | Quimicos industriales | Medio | Research |
| 11 | Siacorp | Seguridad privada | Medio | Research |
| 12 | Grupo YGI | Staffing | Medio | Research |

## Franquicia Restaurante (Guillermo / BBM-Ubiqo) — NUEVO

**Giro:** Franquicia de restaurantes de comida rapida (hamburguesas). Modelo franquiciatario con multiples sucursales.

**Tamano:** Por confirmar. Multiples sucursales, multiples franquiciatarios, operacion por zonas y regiones.

**Sede:** Por confirmar. Contacto via Ubiqo (Alberto \+ Guillermo).

**Operaciones de campo:** Supervisores de marca visitando sucursales de franquiciatarios. Evaluacion visual de fachadas, material promocional, limpieza interior, cocina, banos, uniforme del personal. Campanas promocionales que rotan cada \~3 semanas.

**Ya usan:** Evidence (Ubiqo) para captura fotografica. Evaluacion actualmente manual.

**Estado:** Demo en vivo realizado el 26 mar 2026\. Gonzalo presento analisis AI de fotos de fachada — detecto promociones, senaletica, precios, compliance. Guillermo y Alberto validaron el concepto.

\[TIER-3\] **Caso de uso BBM:** Scoring automatico de sucursales de franquicia por areas (fachada, mesas, cocina, banos, personal). Comparacion entre sucursales, franquiciatarios, zonas y regiones. Validacion de material promocional vigente (rota cada 3 semanas). Dashboard multi-sucursal con ranking y alertas. **Diferenciador Tier 3:** valor bidireccional — la marca evalua compliance, pero el franquiciatario tambien recibe benchmarking, reportes de mejora y reconocimiento ("Sucursal Premium"). \[/TIER-3\]

**Siguiente paso:** Guillermo envia criterios de evaluacion por area \+ fotos de referencia (correcto/incorrecto). Nosotros configuramos reglas custom. Demo 2 con scoring real.

**Roadmap especifico:** Ver documento "BBM — Roadmap Especifico: Franquicia de Restaurantes" para fases detalladas, pricing y plan de implementacion.

---

## Metrica BTL

**Giro:** Agencia BTL con 25+ anios. Promotorias en tienda, activaciones de marca, eventos, guerrilla marketing, instalacion POP, tecnologia en punto de venta.

**Tamano:** Corporativo 51-200 \+ cientos de promotores por campania. Cobertura nacional.

**Sede:** Ciudad de Mexico. Operan en toda la Republica.

**Operaciones de campo:** Promotores/demostradoras en cadenas retail, equipos de activacion de marca, supervisores de calidad, equipos de eventos, instalacion de material POP, despliegue de tecnologia (kioscos, pantallas, AR).

**Ya usan:** Sistema propio de reporteo en linea con geolocalizacion en tiempo real.

\[TIER-3\] **Caso de uso BBM:** Scoring automatico de ejecucion de activaciones — la IA verifica que displays estan montados correctamente, material POP es el correcto, promotor tiene uniforme adecuado, producto esta exhibido segun planograma. Reemplaza al supervisor humano que no puede visitar todas las activaciones. Un cliente como Coca-Cola o P\&G paga premium por verificacion independiente de ejecucion. \[/TIER-3\]

## Urbaser Colombia

**Giro:** Gestion ambiental — recoleccion de residuos, barrido, poda, manejo RESPEL, rellenos sanitarios, residuos industriales. Subsidiaria espanola (Platinum Equity).

**Tamano:** 2,000+ empleados en Colombia, 10 ciudades, 9 departamentos, 4 parques ecologicos, 4 rellenos sanitarios. ISO 9001, 14001, 45001\.

**Sede:** Bogota. Operan en Monteria, Yumbo, Soacha, Tunja, Duitama y mas.

**Operaciones de campo:** Cuadrillas de recoleccion, barredores, podadores, operadores de relleno, manejo de residuos peligrosos, succion industrial, conductores de vehiculo pesado.

\[TIER-3\] **Caso de uso BBM:** Verificacion de cumplimiento de contratos municipales. Fotos antes/despues con scoring AI prueban que calles quedaron limpias, areas verdes podadas, residuos recolectados. Critico para auditorias gubernamentales (Superintendencia de Servicios Publicos). Safety compliance: verificacion automatica de EPP en campo. \[/TIER-3\]

## Construccion SB

**Giro:** Construccion integral — edificacion, urbanizacion, terracerias, maquinaria pesada. Subsidiaria: SB Transporte. 31+ anios, 70+ proyectos completados.

**Tamano:** 50-300+ empleados (varia por proyecto). Maquinaria propia, flota de transporte con GPS. Sede en Queretaro, cobertura nacional.

**Operaciones de campo:** Cuadrillas de obra, operadores de maquinaria pesada, transportistas, supervisores de obra, inspectores de seguridad y calidad, topografos.

\[TIER-3\] **Caso de uso BBM:** Tracking automatico de avance de obra (uno de los casos AI vision mas probados globalmente). Safety compliance: deteccion de uso correcto de casco, chaleco, arnes. Verificacion de calidad de acabados. Condicion de equipo/maquinaria. Reportes automaticos de progreso para clientes corporativos. \[/TIER-3\]

## Auto Todo (Ciosa AutoTodo)

**Giro:** Autopartes wholesale. Fusion reciente con Grupo Ciosa. Target: $300M USD revenue.

**Tamano:** \~1,600 empleados post-fusion, 34 centros de distribucion, 160 rutas diarias de entrega, 200+ asesores de venta, 7,000+ clientes (refaccionarias). Presencia en Mexico, Colombia y Costa Rica.

**Operaciones de campo:** 160 rutas diarias con conductores y ayudantes, 200+ vendedores visitando refaccionarias, promotores de producto en campo. Tecnologia: Zebra TC56 \+ WMS implementado.

\[TIER-2\] **Caso de uso BBM:** Verificacion automatica de entregas (foto del producto entregado \= confirmacion sin disputa). Auditorias de merchandising en refaccionarias. Compliance de senaletica y material POP de AutoTodo en tiendas cliente. A 160 rutas/dia, el volumen de fotos es masivo. \[/TIER-2\]

## Menarini

**Giro:** Farmaceutica italiana. EUR 4.6B revenue global, 17,800 empleados, productos en 140 paises. En Mexico desde 2008, alianza con Lab Sanfer.

**Tamano Mexico:** 50-200 empleados estimado. Oficina en Insurgentes Sur, CDMX. Visitadores medicos en CDMX, Leon, Hermosillo, Cuernavaca, Culiacan, Tijuana.

**Operaciones de campo:** Visitadores medicos (reps pharma) visitando consultorios, hospitales y clinicas. Gerentes distritales. Key account managers hospitalarios.

\[TIER-2\] **Caso de uso BBM:** Verificacion de visitas medicas — la foto del consultorio/clinica \= prueba de que el rep estuvo ahi (combate "visitas fantasma"). Analisis de anaquel en farmacias: share of shelf de Menarini vs competencia. Verificacion de material promocional vigente. \[/TIER-2\]

## GTAC

**Giro:** Telecom. Opera la red backbone de fibra optica mas grande de Mexico sobre infraestructura de CFE. 22,000+ km de fibra, 159 puntos de presencia.

**Tamano:** \~105 empleados, \~$8M USD revenue. Accionistas: Corporativo Vasco de Quiroga, Pegaso PCS, Megacable. Partner tecnologico: Huawei.

**Operaciones de campo:** Tecnicos de fibra optica (instalacion, empalme, reparacion), equipos de construccion de sitios, ingenieros de red, equipos de respuesta a emergencias (cortes de fibra).

\[TIER-2\] **Caso de uso BBM:** Inspeccion de calidad de instalaciones (cable management, empalmes, paneles). Auditorias de 159 puntos de presencia. Verificacion de avance en construccion de sitios nuevos. Safety compliance cerca de lineas de alta tension de CFE. \[/TIER-2\]

## Acuario Lomas

**Giro:** Distribucion mayorista de productos para mascotas. 100% mexicana, fundada 1976\. Marcas propias de accesorios y alimento.

**Tamano:** 51-200 empleados. Almacen en Lerma, EdoMex. HQ en Bosques de las Lomas, CDMX. Usan BeepQuest para gestion de rutas.

**Operaciones de campo:** Vendedores en rutas definidas visitando tiendas de mascotas, repartidores en rutas programadas, equipo de telemarketing de soporte.

\[TIER-1\] **Caso de uso BBM:** Verificacion de display de productos en tiendas de mascotas (presencia en anaquel, planograma). Confirmacion de entregas con control de calidad (empaques, cantidades). Monitoreo de productos competidores. \[/TIER-1\]

## Banco Itau Chile

**Giro:** Banca universal. Subsidiaria de Itau Unibanco (Brasil). Formado por fusion con CorpBanca (2016). Banco mas antiguo de Chile (fundado 1871).

**Tamano:** 4,681 empleados, 168 sucursales Chile, 68 Colombia, 500+ ATMs Chile, 180+ ATMs Colombia. Market cap USD 3.3B, revenue USD 1.71B.

**Operaciones de campo:** Ejecutivos PYME visitando clientes, supervisores de sucursal, tecnicos de ATM, inspectores hipotecarios, evaluadores de seguros.

\[TIER-2\] **Caso de uso BBM:** Auditorias de sucursales a escala (168+ ubicaciones verificadas por fotos: marca, orden, seguridad). Monitoreo de condicion de 500+ ATMs. Verificacion de visitas a clientes PYME. Inspeccion de propiedades para creditos hipotecarios. \[/TIER-2\]

## Epoxemex

**Giro:** Quimicos industriales — resinas epoxicas, endurecedores, aditivos, pigmentos. Desde 1994\. Partner: KUKDO Chemical (Corea). ISO 9001\.

**Tamano:** 50-200 empleados estimado. Planta en CDMX, oficinas en Monterrey, Guadalajara, Leon, Queretaro. 13 lineas de producto, 3 laboratorios.

**Operaciones de campo:** Representantes de venta tecnica, ingenieros de aplicacion en sitios de cliente, logistica de productos quimicos.

\[TIER-1\] **Caso de uso BBM:** Verificacion de calidad de aplicacion de producto en sitio (pisos epoxicos, recubrimientos). Documentacion tecnica antes/despues. Verificacion de condiciones de almacenamiento de quimicos en clientes. \[/TIER-1\]

## Siacorp

**Giro:** Seguridad privada y consultoria de inteligencia. Fundada en Israel por expertos ex-IDF. Tres areas: seguridad, investigacion, capacitacion (Academia SIA).

**Tamano:** Firma boutique, tamano no divulgado (confidencial). HQ Tel Aviv, operaciones en Mexico (CDMX, San Luis Potosi), LATAM, Africa, Medio Oriente.

**Operaciones de campo:** Equipos de auditoria de seguridad, proteccion VIP, investigacion/inteligencia, instructores de capacitacion. Clientes: bancos, laboratorios farmaceuticos, gobierno.

\[TIER-1\] **Caso de uso BBM:** Auditorias de seguridad fisica — analisis de fotos para detectar vulnerabilidades (accesos, puntos ciegos, perimetro). Verificacion de compliance en checkpoints y puestos de guardia. Limitado por naturaleza confidencial del negocio. \[/TIER-1\]

## Grupo YGI

**Giro:** Staffing y reclutamiento. Conecta talento con empresas. Entidades asociadas: MCPA, Sunoff.

**Tamano:** 51-200 empleados. HQ en Zapopan, Jalisco. Cobertura regional Bajio/occidente, potencialmente nacional.

**Operaciones de campo:** Reclutadores visitando clientes, ejecutivos comerciales, supervisores verificando personal colocado en sitios de trabajo.

\[TIER-1\] **Caso de uso BBM:** Verificacion de presencia de personal colocado (uniforme, ubicacion, condiciones del sitio). Documentacion de condiciones laborales en sitios de clientes. Auditorias de compliance laboral. \[/TIER-1\]

## Clusters Estrategicos

Se identifican cinco agrupaciones naturales por tipo de operacion:

**Cluster 1 — Ejecucion Retail/Campo** (potencial maximo): Metrica BTL, Acuario Lomas, Auto Todo. Verificacion de ejecucion en punto de venta. El caso clasico de vision AI: "confirma que lo que se pidio se hizo."

**Cluster 2 — Franquicias Multi-Sucursal** (NUEVO — validado con demo): Franquicia Restaurante (Guillermo). Evaluacion de compliance de marca en sucursales de franquiciatarios. Scoring por areas, ranking entre sucursales, valor bidireccional marca/franquiciatario. **Este cluster es replicable a cualquier franquicia** (cafeterias, tiendas de conveniencia, farmacias de cadena, etc.).

**Cluster 3 — Infraestructura/Construccion:** GTAC, Construccion SB. Avance de obra, inspeccion de infraestructura, safety compliance. Caso probado globalmente.

**Cluster 4 — Servicios Regulados:** Urbaser, Banco Itau, Menarini. Compliance regulatorio donde la foto es evidencia para auditorias gubernamentales o corporativas.

**Cluster 5 — Operaciones Generales:** Epoxemex, Siacorp, Grupo YGI. Campo menos intenso pero con casos especificos de valor.

## Modelo de Pricing Sugerido por Cluster

- **Volumen alto** (Metrica, Urbaser, Auto Todo, Construccion SB): cobro por imagen procesada — el volumen reduce el costo unitario  
- **Volumen medio** (Menarini, GTAC, Banco Itau, Acuario Lomas): cobro por usuario/mes con tope de imagenes incluidas  
- **Volumen bajo** (Epoxemex, Siacorp, Grupo YGI): paquete mensual fijo o por proyecto

\[CIERRE\] **Siguiente paso recomendado:**

1. **Franquicia Restaurante (Guillermo)** — ya tuvo demo, el interes es concreto. Esperar criterios de evaluacion y fotos de referencia para Demo 2 con scoring real. Es el prospecto mas avanzado en el pipeline.  
2. **Metrica BTL** — maximo volumen de campo, caso de uso alineado al 100%.  
3. **Construccion SB** — relacion local en Queretaro, caso de uso probado globalmente.

**Insight post-demo 26 mar:** El cluster de Franquicias es un mercado horizontal masivo. Si BBM resuelve bien el caso de Guillermo, el mismo producto se replica a cualquier cadena de franquicias (cafeterias, tiendas de conveniencia, farmacias de cadena, gimnasios, etc.). Este es potencialmente el vertical mas grande. \[/CIERRE\]  
