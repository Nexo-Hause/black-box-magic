# Delegación a Qwen-worker (Alibaba Coding Plan)

Regla de cuándo y cómo delegar trabajo mecánico a un subprocess Claude Code backed by modelos de Alibaba (Qwen, Kimi, GLM, MiniMax), dejando que yo (Opus) me dedique a pensar.

---

## Paradigma: cerebro + manos

- **Yo (Opus / Sonnet)** = cerebro. Investigación, planificación, auditoría, debugging sutil, decisiones de arquitectura, revisión de código, diálogo con Gonzalo.
- **Qwen-worker (Alibaba)** = manos. Edits mecánicos, refactors masivos, renames, boilerplate, aplicar un patrón repetido, test scaffolding, port de código, lint fixes.

El objetivo es conservar la quota de Anthropic para lo que realmente requiere razonamiento y mandar a Alibaba todo lo que es mecánico.

---

## Mecánica

Cuando detecto una tarea delegable, disparo un subprocess:

```bash
ANTHROPIC_API_KEY=$(op read "op://Dev Secrets/Alibaba Coding Plan/credential") \
ANTHROPIC_BASE_URL=https://coding-intl.dashscope.aliyuncs.com/apps/anthropic \
claude -p --bare \
  --model <modelo-elegido> \
  --permission-mode bypassPermissions \
  --add-dir "$PWD" \
  --disallowedTools "Bash(git push:*) Bash(rm -rf:*) Bash(git reset --hard:*) WebFetch" \
  --output-format json \
  --max-budget-usd 2 \
  --append-system-prompt "$(cat .claude/tasks/<spec>.md)" \
  "Ejecutá la spec. Commitea localmente al terminar. Reportá los archivos modificados."
```

El flag `--bare` es crítico: fuerza auth por `ANTHROPIC_API_KEY` e ignora el keychain OAuth de la app (que tiene mis credenciales de Anthropic). Sin `--bare` el subprocess usaría MI token y no el del plan de Alibaba.

El subprocess es una sesión Claude Code completa con Edit/Read/Grep/Bash. Itera, corrige, commitea localmente, y termina. Yo leo el output JSON (`{result, cost_usd, num_turns, ...}`), reviso el `git diff HEAD~1`, y verifico contra la spec.

---

## Cuándo auto-delegar (sin preguntar a Gonzalo)

Auto-delego cuando la tarea cumple **todos** estos criterios:

1. **Es mecánica**: no requiere juicio sobre arquitectura, naming crítico, ni decisiones de diseño
2. **El patrón está claro**: sé exactamente qué cambiar en cada archivo (no hay ambigüedad sobre "cómo")
3. **El resultado es verificable objetivamente**: tests pasan, golden diff, lint clean, comando concreto que dice OK o FAIL
4. **Tocar muchos archivos** (>5) o repetir el mismo patrón N veces (>10)
5. **Reversible**: si Qwen la caga, `git reset` y listo

Ejemplos claros de auto-delegar:
- Rename de una función en 20 archivos con sus imports
- Agregar un field opcional a una interface TS y tipar todos los usos
- Aplicar 30 fixes de ESLint
- Migrar `import foo from 'x'` a `import { foo } from 'x'`
- Escribir tests parametrizados para una función pura dada
- Port de un módulo JS puro a TS
- Agregar JSDoc con tipos a N funciones
- Actualizar 40 snapshots de test después de un cambio intencional de UI

## Cuándo NO delegar (lo hago yo mismo)

- Debugging de bugs sutiles (requiere razonamiento sobre causa raíz)
- Diseño de APIs o tipos nuevos
- Code review (me pagas para que yo sea el crítico, no para tercerizarlo)
- Decidir si un enfoque es correcto
- Tareas con ambigüedad ("mejorá este código")
- Tocar security/auth/secrets
- Escribir prompts, specs, docs conceptuales
- Cualquier cosa que tocaría producción directamente
- Primera pasada en un feature nuevo (yo diseño, Qwen después replica)

## Cuándo preguntarte primero (borderline)

- Refactor mecánico pero en código crítico (auth, billing, DB access)
- Tarea grande (>50 archivos) donde un error de Qwen sería caro
- Cuando no estoy 100% seguro de que la spec es unívoca
- Primera vez que delegamos a un modelo específico en un tipo de tarea nuevo

En esos casos genero la spec, te muestro qué voy a delegar y a qué modelo, y vos aprobás.

---

## Selección de modelo por tarea

No hay default. Yo elijo el modelo basándome en la tarea (y en los resultados del benchmark una vez que exista `bench/results/latest.csv`). Mientras no haya benchmark, uso estos criterios tentativos:

### Tabla de selección basada en benchmark (datos reales, 96 runs, 2026-04-11)

**Fuente:** `bench/results/merged.csv` — 4 tasks × 8 modelos × 3 runs. Pass rate global 98% (94/96). Datos limpios después de re-correr las corridas que fallaron por error de red (ENOTFOUND).

| Tipo de tarea | Modelo recomendado | Turns avg | σ | Alternativa | Evidencia |
|---|---|---|---|---|---|
| **Rename mecánico** (renames, symbol replace) | `glm-5` | 22.7 | 1.5 | `qwen3-max-2026-01-23` (25.3) | Task 01: 100% pass, menor turns y menor variance de los 8 |
| **Propagación de tipos** (agregar field, interface extension) | `glm-5` | 11.7 | 2.1 | `kimi-k2.5` (12.0) | Task 02: 100% pass, virtual empate con kimi |
| **Bug fix guiado** (seguir pista + agregar test) | `qwen3.5-plus` | 11.3 | 2.3 | `MiniMax-M2.5` (11.7) | Task 06: 100% pass, todos los modelos pasaron al 100% |
| **Import migration masiva** (cambio mecánico en muchos archivos) | `kimi-k2.5` | 23.7 | 1.5 | `glm-5` (27.7) | Task 07: 100% pass, menor turns, menor variance |
| **Vision input** (leer screenshot, arreglar UI) | `kimi-k2.5` o `qwen3.5-plus` | — | — | — | Sin bench todavía. Son los 2 vision-capable del plan. |
| **Default general** (cuando la tarea no encaja en ninguna categoría) | `glm-5` | 18.8 | — | `kimi-k2.5` (18.9) | Ranking general: 2 wins, 100% pass, turns más bajo promedio |

### Hallazgos clave del benchmark

1. **`glm-5` es el mejor modelo general** — gana en 2 de 4 tasks, 100% pass, menor turns promedio. NO era mi heurística inicial (yo asumía `qwen3-coder-plus`).
2. **`qwen3-coder-plus` no gana ninguna task** — queda 4°-8° en todas. Funciona, pero nunca es la opción más eficiente. Los modelos "coder" de Alibaba no superan a los generales en estas tareas mecánicas.
3. **`kimi-k2.5` es el segundo mejor** — gana en import migration, segundo en interface extension, 100% pass rate, turns promedio casi idéntico a glm-5.
4. **`qwen3-coder-next` es consistentemente el más lento/caro** — 100% pass pero 25+ turns en promedio. No vale la pena para "manos" a menos que glm-5 y kimi fallen.
5. **`MiniMax-M2.5` y `glm-4.7` tienen 92% pass** (fallan en import migration) — fiables como alternativa pero no son primera opción.
6. **Todos los modelos pasan task 01 (rename simple) al 100%** — es la tarea más fácil, no diferencia modelos. Las tasks 02, 06, 07 son las que separan.
7. **La variance importa**: `glm-5` tiene la menor σ en rename (1.5), `glm-4.7` en bug fix (1.2 en datos originales, 0.6 en primeras corridas), `kimi-k2.5` en import migration (1.5). Modelos con σ alta (como `qwen3-max` con σ=10.2 en imports) son impredecibles.

### Cómo actualizar esta tabla

Cuando se agreguen nuevos modelos al Coding Plan o se implementen más tasks del bench:
1. Agregar el modelo a `bench/models.json`
2. Correr `node bench/run.mjs --runs 3`
3. Fusionar con `node bench/merge-csvs.mjs --auto > bench/results/merged.csv`
4. Analizar con `node bench/analyze.mjs bench/results/merged.csv`
5. Actualizar esta tabla con los nuevos ganadores

**IDs exactos validados contra el endpoint** (ver `bench/models.json`). Cuando Alibaba cambie IDs, actualizar `bench/models.json` primero.

---

## Safety rails obligatorios

### Nunca en un subprocess delegado
- `git push`, `git push --force` → disallowedTools
- `rm -rf`, `rm -r` sobre directorios → disallowedTools
- `git reset --hard` sobre commits ajenos → disallowedTools
- Tocar `.env`, `.env.local`, secrets, keys → se excluyen del add-dir o la spec lo prohíbe explícitamente
- Ejecutar migraciones de DB
- Deploy o cualquier cosa que toque producción
- `WebFetch` → disallowedTools (no queremos que Qwen llame a servicios externos sin mi supervisión)
- Nunca delegar una tarea que yo mismo no sabría verificar

### La API key
- **Siempre** se lee via `op read` al momento de lanzar el subprocess y se inyecta como env var inline
- **Nunca** se escribe a un archivo, a un .env, al chat, ni al output del subprocess
- **Nunca** se usa con el Read tool
- Cumple `rules/services.md` (sección 1Password)

### Commits
- Qwen commitea LOCAL (nunca push)
- Yo pusheo manualmente después de verificar
- Los commits de Qwen llevan `Co-Authored-By: Qwen Worker <qwen-worker@alibaba-coding-plan>` en el trailer para distinguir

### NUNCA confiar en el self-report del worker

Hallazgo del primer bench: `qwen3-coder-next` reportó literalmente *"✅ computeTotal no aparece en archivos .ts"* cuando el grep después encontró la referencia sin renombrar en `math.ts:13`. El modelo **mintió sobre el resultado** (hallucinated success).

Regla dura: al recibir el output del worker, **NUNCA** tomar como verdad el texto que dice "lo hice, está todo bien". Siempre correr:

1. `git diff HEAD~1 HEAD` para ver qué tocó realmente
2. El `score.sh` / comandos de verificación definidos en la spec (si aplica)
3. Contar ocurrencias del símbolo viejo vs nuevo con grep
4. Lint / tipado si el stack lo permite

Solo marcar el resultado como aceptado si TODAS las verificaciones objetivas pasan. El output textual del worker es informativo, NO autoritativo. Esto aplica también a `/accept`: el flujo debe correr el scoring automático antes de reportar "accepted".

### Budget
- `--max-budget-usd 2` por default (ajustable por tarea grande)
- Rate limits del Coding Plan: 6000 req/5h, 45000/semana, 90000/mes. Holgado.

---

## Flujo completo de una delegación

1. Gonzalo me pide algo
2. Yo evalúo: ¿es "manos" según los criterios de arriba?
3. Si sí: yo leo el repo lo necesario para escribir una spec precisa
4. Escribo `.claude/tasks/TASK-<YYYYMMDD-HHMM>-<slug>.md` con: objetivo, archivos a tocar, cambios exactos, criterios de aceptación, comando de verificación
5. Invoco `/delegate <path-a-spec> --model <modelo>` o disparo el subprocess directo
6. Mientras Qwen trabaja, yo NO hago otra cosa sensible en el repo (evitar conflictos)
7. Qwen termina, yo leo el JSON output y el `git diff HEAD~1`
8. Si el diff matchea la spec → `/accept` (merge mental, verifico tests, commit amend si hace falta, reporto a Gonzalo)
9. Si no matchea → corrijo yo directamente con Opus, o le mando un retry a otro modelo con feedback específico
10. Gonzalo ve el reporte final con: archivos tocados, tiempo, costo real de Qwen, qué verifiqué

---

## Integración con otros commands

- `/delegate` — dispara la delegación (mecánica descrita arriba)
- `/accept` — revisa el resultado de la última delegación contra su spec
- `/cierre` — si en la sesión hubo delegaciones, incluir resumen (cuántas, costo total, % success)
- `/audit` — si estoy auditando un spec que va a delegar tareas, incluir una dimensión "delegabilidad" (¿está escrito con la precisión que un modelo más chico necesita?)
