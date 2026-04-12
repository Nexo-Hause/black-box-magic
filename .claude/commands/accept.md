Revisar el resultado de la última (u otra) delegación a Qwen-worker y decidir: aceptar, pedir retry, o rechazar y hacerlo yo mismo con Opus.

$ARGUMENTS

Comportamiento según argumento:
- **Sin argumentos**: Revisar la delegación más reciente (última spec en `.claude/tasks/` con estado `done`)
- **Con task-id** (ej: `TASK-20260411-1530-rename-getcwd`): Revisar esa spec específica
- **`--diff`**: Solo mostrar el diff y las métricas, sin tomar decisión automática
- **`--retry [--model <otro>]`**: Disparar retry con la misma spec, opcionalmente con otro modelo
- **`--reject`**: Marcar como rechazada y hacer `git reset HEAD~1` (solo si el commit sigue siendo el último del branch)

---

## Flujo

### 1. Localizar la spec

Si no hay argumento, buscar la última spec en `.claude/tasks/TASK-*.md` ordenada por fecha. Debe tener estado `done` en su frontmatter/contenido. Si el estado es `failed` o `running`, reportar y parar.

### 2. Leer la spec completa

Especialmente:
- Objetivo
- Alcance (archivos que se podían tocar)
- Cambios requeridos
- Fuera de alcance (explícito)
- Criterios de aceptación
- Comandos de verificación

### 3. Verificar el commit

```bash
git log --oneline -1
git show --stat HEAD
git diff HEAD~1
```

Verificaciones automáticas:
- El commit del HEAD tiene el trailer `Co-Authored-By: Qwen Worker <qwen-worker@alibaba-coding-plan>`. Si no, es un commit ajeno, abortar y reportar.
- El commit toca SOLO archivos dentro del alcance declarado en la spec. Si toca archivos fuera, 🔴.
- No hay archivos nuevos no declarados. Si los hay, listar y evaluar (puede ser legítimo si la spec los pedía implícitamente).

### 4. Correr los comandos de verificación

Ejecutar los comandos exactos del bloque "Verificación" de la spec. Capturar output y exit code.

Si la spec no tenía comandos de verificación claros (mala spec mía), correr por default:
- El test runner del proyecto si existe (`npm test`, `pytest`, etc.)
- El linter si existe
- El type checker si existe
- Nada más — no inventar.

### 5. Evaluar contra los criterios de aceptación

Por cada criterio listado en la spec, determinar si se cumple con evidencia:
- ✅ Se cumple (con evidencia: archivo/línea/output de comando)
- ❌ No se cumple (con evidencia)
- ❓ No se puede verificar automáticamente (reportar a Gonzalo para que decida)

### 6. Decisión

**ACEPTAR** (✅): si TODOS los criterios se cumplen Y el diff está dentro del alcance Y los comandos de verificación pasan.
- Actualizar la spec con estado `accepted` + timestamp + mis notas
- Reportar a Gonzalo el resumen final
- NO hacer push (eso lo decide Gonzalo)

**REVISAR** (⚠️): si hay criterios ambiguos, o el output de tests tiene warnings, o Qwen agregó algo fuera del alcance pero parece útil.
- Presentar a Gonzalo el detalle: qué está bien, qué es ambiguo, qué recomendación tengo
- Esperar decisión

**RECHAZAR** (🔴): si algún criterio claramente falla, si rompió tests, si tocó archivos fuera del alcance.
- NO hacer `git reset` automáticamente (Gonzalo decide)
- Presentar el diagnóstico: qué falló, por qué, y las opciones:
  - Retry con otro modelo (con feedback específico de qué corregir)
  - Yo corrijo con Opus (si el error es chico)
  - Abort total (`git reset HEAD~1` local, sin perder la spec para análisis)

### 7. Reportar

```
## Revisión de delegación — <task-id>

**Modelo**: <modelo> | **Costo**: $<N.NNN> | **Turnos**: <N>
**Commit**: <hash> — <mensaje>

### Diff resumido
- path/a/archivo1.ts (+X -Y)  [en alcance ✅]
- path/a/archivo2.ts (+X -Y)  [en alcance ✅]
- path/nuevo.ts (+X)  [⚠️ no declarado en la spec]

### Criterios de aceptación
- [x] Criterio 1 — evidencia: <detalle>
- [x] Criterio 2 — evidencia: <detalle>
- [ ] Criterio 3 — FALLA: <detalle>

### Comandos de verificación
- `npm test` → ✅ passed (42 tests)
- `tsc --noEmit` → ✅ clean
- `npm run lint` → ⚠️ 2 warnings (detalle)

### Ahorro vs Opus (estimado)
Este commit hubiera tomado ~X turnos de Opus ≈ $Y USD (vs $<cost_usd> real del worker)

### Estado: ✅ Aceptable / ⚠️ Revisar / 🔴 Rechazar

### Recomendación
<Mi recomendación concreta: aceptar, retry con modelo X, o yo lo corrijo con Opus porque...>
```

---

## Caso especial: verificación visual

Si la spec involucraba UI y hay que verificar visualmente, NO asumir que está bien solo porque los tests pasan. Reportar a Gonzalo con un resumen del cambio y dejar que él abra la UI y confirme antes de marcar como accepted.

---

## Reglas

1. **Nunca aceptar sin verificación efectiva.** Si no hay manera objetiva de comprobar los criterios, reportar a Gonzalo.
2. **Nunca hacer `git reset` automáticamente.** Gonzalo decide si descartar el commit de Qwen.
3. **Nunca pushear.** `/accept` es solo revisión local.
4. **Leer el archivo completo** antes de aceptar, no solo el diff. Qwen puede haber metido cambios que el diff no resalta como problemáticos.
5. **Documentar el diff-vs-spec en el reporte**, incluso si todo está bien, para el historial de delegaciones.
6. **Si hubo retries**, mencionarlos en el reporte final: "este fue el 2º intento, el 1º falló porque X".
7. **NUNCA confiar en el self-report del worker.** Si el texto final del output dice "✅ todo listo" o "✅ criterios cumplidos", IGNORARLO como fuente autoritativa. Verificar cada criterio con evidencia objetiva (grep, diff, comandos de verificación de la spec). Un worker que alucina éxito es el failure mode más peligroso — confirmado en el bench inicial donde `qwen3-coder-next` reportó textualmente éxito con la tarea a medio hacer.
