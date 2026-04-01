# Validación API Ubiqo — Fase 0

**Fecha:** 2026-03-31
**Token:** JWT empresa 6376, sin restricción de formularios, expira ~2036
**Resultado:** API funcional, pipeline completo validado

---

## Hallazgos Clave

### 1. Construcción de URLs de fotos

La URL completa de una foto requiere **3 partes** (no 2 como asumía el spec):

```
URL = urlBase + fotografias[].url + firma
```

Ejemplo real:
```
https://d1g2sa7lgddaom.cloudfront.net/Capsulas/6376-57325-1774042254169.jpg?Policy=...&Signature=...&Key-Pair-Id=...
```

| Campo | Valor | Notas |
|-------|-------|-------|
| `urlBase` | `https://d1g2sa7lgddaom.cloudfront.net/` | CloudFront CDN (AWS). Mismo para todas las capturas. |
| `fotografias[].url` | `Capsulas/{empresaId}-{movilId}-{timestamp}.jpg` | Path relativo. Patrón: `{IdEmpresa}-{idMovil}-{unixMs}.jpg` |
| `firma` | `?Policy=...&Signature=...&Key-Pair-Id=...` | CloudFront signed URL. Campo a nivel de captura, NO de foto. |

**Importante:** El campo `firma` NO existía en el spec original. Es una signed URL de CloudFront con expiración temporal.

### 2. Expiración de firma

La firma tiene una Policy con `DateLessThan` (epoch timestamp). En el dato observado:
- **Expira:** ~24 horas después de la consulta al API
- Cada llamada al API genera firmas nuevas
- No requiere auth adicional para descargar fotos — la firma ES la auth

### 3. Estructura real de captura

```typescript
interface UbiqoCaptura {
  alias: string;                    // "GALINDO RAMOS PATRICIA"
  username: string;                 // "admin.metrica"
  estatus: string;                  // "Completa" (no "validado" como asumía el spec)
  motivo: string | null;            // Motivo de rechazo
  idMovil: number;                  // ID del dispositivo móvil
  grupo: string;                    // UUID del grupo
  fecha: string;                    // ISO 8601 UTC
  fechaInicial: string;             // ISO 8601 con ms
  fechaSincronizacion: string;      // ISO 8601 con ms
  fechaRechazo: string | null;
  nombreUsuarioRechazo: string | null;
  usernameRechazo: string | null;
  fechaValido: string | null;
  nombreUsuarioValido: string | null;
  usernameValido: string | null;
  urlBase: string;                  // "https://d1g2sa7lgddaom.cloudfront.net/"
  firma: string;                    // "?Policy=...&Signature=...&Key-Pair-Id=..."
  folioEvidence: string;            // "260320111540-30143-57325"
  catalogosMetaData: object | null;
  capturas: CapturaBase[];          // Campos del formulario
}
```

### 4. Tipos de campo (idTipo)

| idTipo | Tiene fotos | Cantidad (muestra 484 capturas) |
|--------|------------|--------------------------------|
| 1 | No | 658 campos |
| 6 | No | 484 campos |
| 7 | Sí | 4,604 campos |

Solo `idTipo=7` (galería) contiene fotografías. El spec mencionaba `idTipo=2` (foto única) pero en los datos reales no aparece.

### 5. Estructura de fotografía

```json
{
  "fotografia": "",
  "url": "Capsulas/6376-57325-1774042254169.jpg",
  "descripcion": "",
  "latitud": "19.405715",
  "longitud": "-99.2735567",
  "tieneCoordenada": true
}
```

Diferencias vs spec:
- `fotografia` es string vacío (no se usa)
- `latitud`/`longitud` son **strings**, no numbers
- `descripcion` es string vacío (no se usa en este formulario)

### 6. Volumen de datos

Formulario 30143 (EVIDENCIA FOL 2024), semana 17-23 marzo 2026:
- **484 capturas**, TODAS con fotos
- **10,707 fotos** totales
- **~22 fotos por captura** promedio
- Todas con estatus "Completa"

### 7. Formularios con datos

| Form ID | Nombre | Capturas (17-23 mar) |
|---------|--------|---------------------|
| 30143 | EVIDENCIA FOL 2024 | 484 |
| 30144 | ENTRADA Y SALIDA FOL 2024 | 1,020 |
| 41461 | CONTEO MACROPAY | 819 |
| 41513 | ENCUESTA | 870 |
| 41534 | NUEVAS LLEGADAS WALMART | 79 |
| 41477 | USG EXHIBICIONES Y LABOR DE VENTA | 10 |
| 39459 | CLINICA USG | 1 |

---

## Pipeline Validado

```
1. GET /v1/Capturas/Rango/{formId}/{de}/{a}?tz=America/Mexico_City
   → Bearer token en header
   → Retorna array de capturas con metadata + campos + fotos

2. Para cada foto:
   URL = captura.urlBase + foto.url + captura.firma
   → GET directo (sin auth adicional, la firma es la auth)
   → Retorna JPEG (1200x1600 típico, ~350KB)

3. Foto → Gemini 2.5 Flash → Análisis
   → Identifica correctamente: marca (Fruit of the Loom), productos, layout
   → ~1,400 tokens totales (~$0.0002 por análisis)
```

---

## Diferencias vs Spec 00

| Aspecto | Spec 00 asumía | Realidad |
|---------|---------------|----------|
| URL de foto | `urlBase + foto.url` | `urlBase + foto.url + firma` (3 partes) |
| `firma` | No existía | Signed URL CloudFront con expiración ~24h |
| Auth de fotos | "POR CONFIRMAR" | No requiere — la firma es la auth |
| `estatus` | "validado", "pendiente", "rechazado" | "Completa" (puede haber otros) |
| `idTipo` fotos | 2 (foto) y 7 (galería) | Solo 7 en datos reales |
| `latitud`/`longitud` | number | string (necesita parsear) |
| `folioEvidence` | Existía | Confirmado: formato `{fecha}-{formId}-{movilId}` |
| `urlBase` fijo | "POR CONFIRMAR" | CloudFront: `https://d1g2sa7lgddaom.cloudfront.net/` |
| Foto auth | "POR CONFIRMAR" | Signed URL (Policy + Signature + Key-Pair-Id) |

---

## Implicaciones para Implementación

1. **SSRF simplificado:** Solo necesitamos allowlist para `d1g2sa7lgddaom.cloudfront.net`. No hay redirects.
2. **No necesitamos pasar Bearer para fotos.** La firma CloudFront es suficiente.
3. **Firma caduca ~24h.** El pipeline debe descargar fotos pronto después de ingest. Si re-procesamos, necesitamos re-llamar al API para obtener firma fresca.
4. **Latitud/longitud son strings.** Parsear con `parseFloat()`, validar que no sea "0".
5. **Campo `firma` va a nivel de captura**, no de foto. Todas las fotos de una captura comparten la misma firma.
6. **Volumen alto:** 10K+ fotos por semana en un solo formulario. El cron de 1 foto/min no alcanza — necesitamos batch o concurrencia.

---

## Prerequisitos Actualizados

| # | Item | Estado |
|---|------|--------|
| 1 | Bearer token | **Resuelto** — JWT empresa 6376 |
| 2 | Cuenta Evidence de prueba | **Resuelto** — acceso a todos los formularios |
| 3 | `urlBase` de fotos | **Resuelto** — CloudFront CDN |
| 4 | Auth de foto URLs | **Resuelto** — Signed URLs via campo `firma` |
| 5 | Expiración del token | **Resuelto** — expira ~2036 |
| 6 | Rate limits | Pendiente — no observados, probar con volumen |
| 7 | Formato webhook | Pendiente — para Fase 2 |

**Gate de Fase 0: COMPLETADO.** Podemos proceder a Fase 1.
