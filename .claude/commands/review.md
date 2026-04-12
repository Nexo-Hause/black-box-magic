Procesar el code review de AI (Kimi/otro) en el PR del branch actual.

$ARGUMENTS

Comportamiento según argumento:
- **Sin argumentos**: Procesar el review del PR del branch actual
- **Con número de PR** (ej: `366`): Procesar el review de ese PR específico
- **"status"**: Solo mostrar si hay review pendiente, sin procesar

---

## Flujo

### 1. Identificar el PR

```bash
gh pr view --json number,url,state,headRefName
```

Si no hay PR en el branch actual, informar y preguntar si crear uno.

### 2. Buscar el review de AI

```bash
gh pr view <number> --json comments --jq '.comments[] | select(.body | contains("AI Code Review")) | .body'
```

- **Marker:** buscar comentarios que contengan "AI Code Review"
- Si no hay review aún: informar que el GitHub Action puede tardar ~45 segundos. Preguntar si esperar o continuar.
- Si hay múltiples reviews (por pushes sucesivos): tomar el MÁS RECIENTE

### 3. Parsear findings

Clasificar cada finding por severidad:
- **CRITICAL** — Bug, vulnerabilidad, o pérdida de datos. SIEMPRE corregir.
- **HIGH** — Error lógico, edge case no manejado. SIEMPRE corregir.
- **MEDIUM** — Mejora de robustez, validación faltante. Evaluar y justificar si se descarta.
- **LOW** — Estilo, naming, mejora menor. Evaluar; descartar con justificación si no aporta.

### 4. Procesar cada finding

Para cada finding CRITICAL o HIGH:
1. Leer el archivo y contexto completo mencionado (no solo el diff)
2. Evaluar si el fix propuesto es correcto
3. Si sí: aplicar el fix
4. Si no (falso positivo por contexto limitado del diff): documentar POR QUÉ se descarta

Para MEDIUM y LOW:
1. Evaluar si aporta valor real
2. Aplicar los que mejoren el código sin over-engineering
3. Descartar con justificación los que no apliquen

### 5. Commit y push

```bash
git add <archivos-corregidos>
git commit -m "fix: address AI review findings — <resumen>"
git push
```

El push dispara un nuevo review automático via GitHub Actions.

### 6. Iterar

Esperar ~45 segundos para el nuevo review, luego repetir desde paso 2.

**Condiciones de salida:**
- ✅ No hay findings CRITICAL ni HIGH pendientes
- ✅ Todos los findings descartados tienen justificación
- ⚠️ Máximo 4 rondas. Si después de 4 rondas persisten issues, reportar al usuario con el detalle para que decida.

### 7. Reportar

Mostrar al usuario:

```
## Review completado — PR #<number>

**Rondas:** <N>
**Findings procesados:** <total>
- Corregidos: <n> (CRITICAL: x, HIGH: x, MEDIUM: x, LOW: x)
- Descartados: <n> (con justificación por cada uno)

**Commits de corrección:**
- <hash> <mensaje>

**Estado:** ✅ Limpio / ⚠️ Findings residuales (ver detalle)
```

---

## Reglas

- **No silenciar findings legítimos.** Si Kimi encuentra un bug real, corregirlo aunque sea incómodo.
- **No aplicar cambios cosméticos innecesarios.** Si un finding LOW es solo preferencia de estilo, descartarlo.
- **Leer contexto completo.** El reviewer solo ve el diff. Antes de descartar, leer el archivo completo — a veces el contexto confirma el finding.
- **Justificar descartes.** Cada finding descartado necesita una razón concreta (no "no aplica" genérico).
