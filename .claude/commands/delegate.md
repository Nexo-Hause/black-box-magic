Delegar una tarea mecánica a un subprocess Claude Code backed by un modelo de Alibaba (Qwen/Kimi/GLM/MiniMax). Yo (Opus) sigo siendo el cerebro: escribo la spec, disparo el worker, verifico el resultado.

$ARGUMENTS

Comportamiento según argumento:
- **Sin argumentos**: Yo acabo de detectar una tarea delegable en la conversación actual. Escribo la spec basándome en el contexto, elijo el modelo según `rules/delegation.md`, y disparo el worker.
- **Con descripción** (ej: `rename getCwd a getCurrentWorkingDirectory en todo src/`): Uso la descripción como input para escribir la spec.
- **`--model <nombre>`**: Forzar modelo específico (qwen3-coder, kimi-k2.5, glm-5, qwen3.5-plus, MiniMax-M2.5). Override del criterio automático.
- **`--dry-run`**: Escribir la spec y mostrarla, pero NO disparar el worker. Útil cuando no estoy 100% seguro.
- **`--budget <usd>`**: Override del budget default de $2 USD.
- **`--retry <task-id>`**: Reintentar una spec ya existente (p.ej. tras un fallo), opcionalmente con otro modelo.

---

## Pre-requisitos (una sola vez por máquina)

Antes de la primera invocación, verificar:

1. **Cache global de la key existe** (prioridad 1, el caso normal en las máquinas de Gonzalo):
   ```bash
   test -f "$HOME/.claude/alibaba.env" && grep -q '^ALIBABA_API_KEY=' "$HOME/.claude/alibaba.env" && echo "ok" || echo "missing"
   ```
   - Si dice `ok`: todo listo, no necesitás nada más.
   - Si dice `missing`: seguir al paso 2 para fallback.

2. **1Password CLI como fallback** (prioridad 4 en la cascada):
   ```bash
   /c/Users/gleon/scoop/apps/1password-cli/current/op.exe item get "Alibaba Coding Plan" --vault "Dev Secrets" --format json > /dev/null 2>&1 && echo "ok" || echo "missing"
   ```
   - Si dice `ok`: la cascada puede caer acá como último recurso, aunque puede disparar prompt biométrico.
   - Si dice `missing`: parar y preguntar a Gonzalo dónde está la key. NO intentar leerla ni adivinarla.

3. **CLI `claude` disponible en PATH**:
   ```bash
   which claude && claude --version
   ```
   Debe estar junto con la app Windows (la app bundlea la CLI).

Si los tres fallan, reportar a Gonzalo y PARAR — no seguir con valores inventados.

## Cascada para leer la key (obligatoria — aplica tanto al runner del bench como a cualquier disparo manual del worker)

Orden estricto, primer match gana:

1. **`process.env.ALIBABA_API_KEY`** — si ya está en el env del shell (ideal, cero archivos tocados)
2. **`~/.claude/alibaba.env`** (global cache) — archivo shell-style con `ALIBABA_API_KEY=sk-sp-...`, leído en todos los repos sin fricción
3. **`.env.local` del repo actual** — por compatibilidad con repos que tengan su propia copia
4. **`op read "op://Dev Secrets/Alibaba Coding Plan/credential"`** — último recurso, puede disparar prompt

Implementación como shell snippet (antes de cualquier `claude -p`):

```bash
# Cascada: env → global → repo → op
if [ -n "${ALIBABA_API_KEY:-}" ]; then
  :  # ya está en env, nada que hacer
elif [ -f "$HOME/.claude/alibaba.env" ] && grep -q '^ALIBABA_API_KEY=' "$HOME/.claude/alibaba.env"; then
  set -a; . "$HOME/.claude/alibaba.env"; set +a
elif [ -f "./.env.local" ] && grep -q '^ALIBABA_API_KEY=' "./.env.local"; then
  set -a; . "./.env.local"; set +a
else
  ALIBABA_API_KEY=$(/c/Users/gleon/scoop/apps/1password-cli/current/op.exe read "op://Dev Secrets/Alibaba Coding Plan/credential" 2>/dev/null)
fi

if [ -z "${ALIBABA_API_KEY:-}" ]; then
  echo "ERROR: no ALIBABA_API_KEY en ninguna fuente" >&2
  exit 1
fi
```

---

## Flujo

### 1. Determinar la tarea

**Si hay argumentos**: la descripción viene del usuario.
**Si no hay argumentos**: yo infiero la tarea del turno actual de conversación — el último pedido concreto de Gonzalo que sea mecánico.

En cualquier caso, antes de seguir verifico contra `rules/delegation.md`:
- ¿Es realmente "manos"? Si no estoy seguro, paro y le pregunto a Gonzalo.
- ¿Es reversible? Si no (toca prod, DB, secrets) → abortar, no se delega.
- ¿Tengo los criterios de verificación? Si no puedo decir objetivamente "esto está bien o mal", abortar y escribir la spec con más precisión primero.

### 2. Escribir la spec

Archivo destino: `.claude/tasks/TASK-<YYYYMMDD-HHMM>-<slug>.md`

Crear `.claude/tasks/` si no existe.

Estructura de la spec (obligatoria):

```markdown
# TASK-<timestamp>-<slug>

**Creada**: <ISO timestamp>
**Delegada a**: <modelo elegido>
**Budget**: $<N> USD
**Estado**: pending → running → done / failed

## Objetivo
<Una sola oración con el qué y el por qué>

## Alcance
### Archivos que se PUEDEN tocar
- path/a/archivo1.ts
- path/a/archivo2.ts
- (o patrón glob: `src/**/*.ts`)

### Archivos que NO se pueden tocar
- Cualquier cosa fuera del alcance de arriba
- `.env*`, `.claude/settings.json`, secrets
- Archivos de configuración global si la tarea no lo pide

## Cambios requeridos
<Descripción precisa y determinística. Si es un rename: "cada vez que aparezca X, reemplazar por Y". Si es un refactor: "cada función con firma A debe pasar a firma B". Sin ambigüedades.>

## Fuera de alcance (explícito)
<Lo que NO se está pidiendo, para que Qwen no se entusiasme. Ej: "NO refactorizar otras funciones aunque parezcan similares", "NO actualizar tests a menos que fallen por el cambio".>

## Criterios de aceptación
- [ ] <Criterio 1 verificable>
- [ ] <Criterio 2 verificable>
- [ ] Los archivos fuera del alcance están intactos
- [ ] Commit local creado con mensaje descriptivo
- [ ] Ningún archivo nuevo agregado al repo sin haberlo declarado en "Archivos que se pueden tocar"

## Verificación
Comandos exactos que prueban éxito:
```bash
<comando 1, ej: npm test -- path/tests/affected>
<comando 2, ej: npm run lint>
<comando 3, ej: tsc --noEmit>
```

## Notas para el worker
- Trabajás en el branch actual, no crees uno nuevo
- Hacé UN solo commit al terminar, con co-author trailer (ver abajo)
- Si encontrás ambigüedad que no podés resolver, ABORTÁ con un mensaje claro en vez de adivinar
- Si tocás un archivo fuera del alcance, ABORTÁ

## Co-author trailer obligatorio en el commit
```
Co-Authored-By: Qwen Worker <qwen-worker@alibaba-coding-plan>
```
```

### 3. Seleccionar modelo

Si `--model` fue pasado: usar ese.
Si no: aplicar la heurística de `rules/delegation.md`:

| Tarea | Modelo |
|---|---|
| Refactor mecánico >5 archivos | `qwen3-coder` |
| Instrucciones condicionales / lógica no trivial | `kimi-k2.5` |
| Vision input (screenshot) | `kimi-k2.5` o `qwen3.5-plus` |
| Volumen muy alto (>50 archivos) | `qwen3-coder` |

Si existe `bench/results/latest.csv` en este repo, **usar los datos reales del benchmark** en vez de la heurística. Leer el CSV y elegir el modelo con mejor ratio correctness/costo para la categoría.

### 4. Disparar el worker

**NUNCA imprimir la API key en el chat, en logs, ni dejarla en disco fuera de las fuentes ya conocidas.** Siempre inline como env var.

Comando exacto, incorporando la cascada de lectura definida arriba:

```bash
# ---- 1. Cascada de lectura de key (ver sección "Cascada para leer la key") ----
if [ -n "${ALIBABA_API_KEY:-}" ]; then
  :
elif [ -f "$HOME/.claude/alibaba.env" ] && grep -q '^ALIBABA_API_KEY=' "$HOME/.claude/alibaba.env"; then
  set -a; . "$HOME/.claude/alibaba.env"; set +a
elif [ -f "./.env.local" ] && grep -q '^ALIBABA_API_KEY=' "./.env.local"; then
  set -a; . "./.env.local"; set +a
else
  ALIBABA_API_KEY=$(/c/Users/gleon/scoop/apps/1password-cli/current/op.exe read "op://Dev Secrets/Alibaba Coding Plan/credential" 2>/dev/null)
fi

if [ -z "${ALIBABA_API_KEY:-}" ]; then
  echo "ERROR: no ALIBABA_API_KEY en ninguna fuente" >&2
  exit 1
fi

# ---- 2. Disparar el subprocess ----
# Nota: --disallowedTools usa comma-separated, no space-separated, para evitar
# que cmd.exe en Windows rompa los paréntesis. Ver rules/delegation.md.
ANTHROPIC_API_KEY="$ALIBABA_API_KEY" \
ANTHROPIC_BASE_URL="${ALIBABA_BASE_URL:-https://coding-intl.dashscope.aliyuncs.com/apps/anthropic}" \
claude -p --bare \
  --model "${MODEL}" \
  --permission-mode bypassPermissions \
  --add-dir "$PWD" \
  --disallowedTools "Bash(git push:*),Bash(git push --force:*),Bash(rm -rf:*),Bash(git reset --hard:*),WebFetch" \
  --output-format json \
  --max-budget-usd "${BUDGET:-2}" \
  --append-system-prompt "$(cat ${SPEC_PATH})" \
  "Ejecutá la spec del system prompt. Trabajá en el branch actual. Hacé UN solo commit local al terminar con el trailer Co-Authored-By indicado. NO pushees. Al terminar, reportá en tu respuesta final: (1) lista de archivos modificados, (2) hash del commit, (3) resultado de correr los comandos de verificación." \
  > .claude/tasks/TASK-<id>.output.json 2> .claude/tasks/TASK-<id>.stderr.log

# ---- 3. Limpiar la env var del shell actual por si hereda a otros procesos ----
unset ALIBABA_API_KEY
```

Flags críticos:
- `--bare`: sin esto el subprocess usa el keychain OAuth de la app (mis credenciales de Anthropic). Con `--bare` solo lee `ANTHROPIC_API_KEY`.
- `--output-format json`: yo después parseo `result`, `cost_usd`, `num_turns`, `session_id`.
- `--max-budget-usd`: safety net contra loops.
- `--disallowedTools`: evita push/delete/fetch externo.
- `--add-dir "$PWD"`: Qwen solo puede leer/escribir en el working directory.

### 5. Parsear el resultado

El JSON output tiene la forma:
```json
{
  "type": "result",
  "subtype": "success" | "error",
  "result": "<texto final del modelo>",
  "session_id": "<uuid>",
  "num_turns": N,
  "cost_usd": 0.12,
  "duration_ms": 45000,
  "is_error": false
}
```

Si `is_error: true` o `subtype: error`: actualizar la spec con estado `failed`, reportar a Gonzalo el error concreto, NO intentar otra cosa automáticamente.

Si éxito:
1. Leer `git log --oneline -1` para confirmar que hay un commit nuevo
2. Leer `git diff HEAD~1` para ver qué tocó
3. Verificar que no tocó archivos fuera del alcance
4. Correr los comandos de verificación de la spec
5. Actualizar la spec con estado `done` + métricas (cost, duration, num_turns)
6. **Loggear al delegation-log centralizado** (ver paso 5b abajo)

### 5b. Loggear la delegación

Después de parsear el resultado (éxito o fallo), appendear una línea al CSV centralizado en claude-config:

```bash
# Determinar el repo actual (nombre del directorio)
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")

# Clasificar el tipo de tarea según la spec (rename, interface-ext, bug-fix, import-migration, lint-fix, test-boilerplate, port-ts, jsdoc, vision, other)
TASK_TYPE="<clasificar según el patrón de la spec>"

# Appendear al log centralizado
echo "${TIMESTAMP},${REPO_NAME},${TASK_ID},${MODEL},${RESULT},${COST_USD},${NUM_TURNS},${DURATION_S},${TASK_TYPE}" \
  >> ~/Projects/claude-config/bench/delegation-log.csv
```

**Variables** (extraídas del JSON output del paso 5):
- `TIMESTAMP`: ISO 8601 (ej: `2026-04-12T16:00:00-06:00`)
- `REPO_NAME`: nombre del repo donde se ejecutó (ej: `sgr-cbc`)
- `TASK_ID`: el ID de la spec (ej: `TASK-20260412-1600-parametrize-reparse-v2`)
- `MODEL`: modelo usado (ej: `glm-5`)
- `RESULT`: `success` | `error` | `empty` (si output vacío)
- `COST_USD`: del campo `total_cost_usd` del JSON
- `NUM_TURNS`: del campo `num_turns`
- `DURATION_S`: `duration_ms / 1000`
- `TASK_TYPE`: clasificación manual según el tipo de tarea

Si el archivo `~/Projects/claude-config/bench/delegation-log.csv` no existe o no es accesible (ej: estamos en otra máquina), loggear localmente en `.claude/tasks/delegation-log.csv` del repo actual como fallback. En el próximo `/sync`, se puede consolidar.

### 6. Reportar a Gonzalo

Formato del reporte:

```
## Delegación completada — TASK-<id>

**Modelo**: <modelo> | **Costo**: $<N.NNN> | **Tiempo**: <Ns> | **Turnos**: <N>

**Archivos modificados** (<N>):
- path/a/archivo1.ts (+X -Y)
- path/a/archivo2.ts (+X -Y)

**Commit**: <hash corto> — <mensaje>

**Verificación**:
- ✅ `npm test` → passed (N tests)
- ✅ `tsc --noEmit` → clean
- ❌/⚠️ <cualquier falla con detalle>

**Criterios de aceptación**:
- [x] Criterio 1
- [x] Criterio 2
- [ ] <cualquiera no cumplido con detalle>

**Estado**: ✅ Aceptable / ⚠️ Revisar / 🔴 Rechazar
```

Si ⚠️ o 🔴: mostrar el diff problemático y proponer cómo proceder (yo corrijo con Opus / retry con otro modelo / abortar).

---

## Reglas

1. **Nunca inventar la API key ni el path en 1Password.** Si el item no existe, parar y preguntar.
2. **Nunca escribir la API key a disco.** Siempre inline en el env del subprocess.
3. **Nunca delegar sin spec escrita.** Incluso si es "obvio", la spec queda commiteada en `.claude/tasks/` como parte del histórico auditable.
4. **Nunca delegar tareas no-mecánicas.** Si requiere juicio, lo hago yo.
5. **Nunca permitir que Qwen pushee.** Disallowed en tool args y además el rate limit del plan no está pensado para push loops.
6. **Siempre verificar el diff contra la spec.** Si Qwen tocó algo fuera del alcance, rechazar.
7. **Siempre reportar el costo real** del subprocess (`cost_usd` del JSON), para que Gonzalo vea el ahorro vs Opus.
8. **Nunca reintento más de 2 veces** con el mismo modelo si la primera corrida falló. Si falla dos veces, o cambio de modelo o lo hago yo mismo con Opus.
