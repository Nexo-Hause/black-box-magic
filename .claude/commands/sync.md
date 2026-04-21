Sincronizar la configuracion de Claude Code desde el repo central (claude-config) al repo actual.

$ARGUMENTS

Opciones:
- Sin argumentos: sincronizar commands portables + rules + reglas globales en CLAUDE.md
- `--skills`: tambien sincronizar skills al repo destino (`.claude/skills/`)
- `--global`: ademas de lo anterior, copiar skills a `~/.claude/skills/` para que apliquen en TODOS los repos (incluyendo Claude Code web conectado a cualquier repo)
- `--all`: todo (commands, rules, reglas, skills, workflow pr-review.yml)
- `--check`: solo mostrar que esta desactualizado, sin modificar nada

---

## Flujo

### 1. Verificar repo fuente

Verificar que el repo claude-config existe:
```bash
ls /c/Users/gleon/Projects/claude-config/commands/
```

Si no existe, informar al usuario:
> El repo claude-config no esta clonado. Ejecuta:
> `git clone git@github.com:gonzalodev-ops/claude-config.git ~/Projects/claude-config`

### 2. Pull ultimo cambio

```bash
cd /c/Users/gleon/Projects/claude-config && git pull origin main
```

### 2b. Instalar hooks globales (siempre)

Antes de tocar el repo destino, asegurar que los hooks user-level de claude-config esten instalados en `~/.claude/hooks/` y referenciados en `~/.claude/settings.json`. El instalador es idempotente — si ya esta todo al dia, no hace nada.

```bash
bash /c/Users/gleon/Projects/claude-config/hooks/install.sh
```

Reporta al usuario cuantos hooks se instalaron/actualizaron y cuantas entradas de `PreToolUse` se agregaron a `~/.claude/settings.json`. No imprime el contenido del settings (contiene tokens).

### 3. Detectar contexto del repo actual

Verificar que existe en el repo actual:
- `.claude/commands/` (si no existe, crearlo)
- `.claude/rules/` (si no existe, crearlo)
- `CLAUDE.md` (si no existe, advertir)
- `.github/workflows/` (para `--all`)

### 4. Comparar y mostrar checkpoint

**Commands portables** (siempre sincronizar):
Para cada uno de: `cierre.md`, `review.md`, `audit.md`, `delegate.md`, `accept.md`:
1. Leer el archivo fuente: `/c/Users/gleon/Projects/claude-config/commands/{nombre}`
2. Leer el archivo destino: `.claude/commands/{nombre}` (si existe)
3. Comparar contenido
4. Reportar: "actualizar" / "ya esta al dia" / "nuevo"

**Rules** (siempre, para cada archivo):
Para cada uno de: `review.md`, `services.md`, `delegation.md`:
1. Leer fuente: `/c/Users/gleon/Projects/claude-config/rules/{nombre}`
2. Comparar con `.claude/rules/{nombre}`
3. Reportar y sincronizar si hay diferencias

**Reglas en CLAUDE.md** (siempre):
1. Leer fuente: `/c/Users/gleon/Projects/claude-config/CLAUDE.md`
2. Extraer contenido entre `<!-- REGLAS-GLOBALES-START -->` y `<!-- REGLAS-GLOBALES-END -->`
3. Buscar los mismos marcadores en el CLAUDE.md del repo actual
4. Si existen: comparar contenido entre marcadores
5. Si no existen: marcar como "nuevo — se agregara al final"

**Si `--skills`**: Listar skills disponibles en claude-config/skills/
**Si `--all`**: Incluir workflow pr-review.yml

Mostrar el checkpoint al usuario con formato:

```
## Sync checkpoint

| Archivo | Estado |
|---------|--------|
| commands/cierre.md | actualizar (diferencias encontradas) |
| commands/review.md | ya esta al dia |
| commands/audit.md | nuevo (no existe en el repo) |
| commands/delegate.md | nuevo (no existe en el repo) |
| commands/accept.md | nuevo (no existe en el repo) |
| rules/review.md | ya esta al dia |
| rules/services.md | actualizar |
| rules/delegation.md | nuevo |
| CLAUDE.md reglas | actualizar |
```

Esperar confirmacion del usuario.

### 5. Ejecutar sincronizacion

Si el usuario confirma:

**Commands:**
- Leer archivo fuente y escribirlo al destino con el Write tool
- NO tocar commands del proyecto (spec.md, status.md, db.md, e2e.md, nexo.md, etc.)

**Rules:**
- Leer fuente y escribir al destino
- NO tocar rules del proyecto (security.md, supabase.md, testing.md, etc.)

**Reglas en CLAUDE.md:**
- Si los marcadores existen en el CLAUDE.md destino:
  - Leer todo el CLAUDE.md
  - Reemplazar SOLO el contenido entre `<!-- REGLAS-GLOBALES-START -->` y `<!-- REGLAS-GLOBALES-END -->` (incluyendo los marcadores mismos) con el contenido del fuente
  - Escribir el archivo con Edit tool
- Si los marcadores NO existen:
  - Leer todo el CLAUDE.md
  - Agregar al final: los marcadores + el contenido de reglas
  - Escribir con Edit tool

**Skills (si `--skills`):**
- Para cada skill en claude-config/skills/ (audit, doc-coauthoring, resume-session, using-my-tools, verification, systematic-debugging, tdd, parallel-exploration, writing-spec, xlsx):
  - Crear `.claude/skills/{nombre}/` si no existe
  - Copiar SKILL.md y todos los archivos adicionales (scripts, licencias, schemas)
- NO sincronizar `frontend-design` — ya existe la version del plugin `frontend-design:frontend-design` y se prefiere esa

**Skills globales (si `--global`):**
- Ademas de lo anterior, copiar las mismas skills a `~/.claude/skills/` para que apliquen sin importar el repo actual
- Esto es util para Claude Code CLI cuando no estas en un repo especifico
- Para Claude Code web (navegador), las skills se cargan desde el repo conectado, asi que `--skills` basta para la web

**Workflow (si `--all`):**
- Si `.github/workflows/` existe:
  - Copiar claude-config/workflows/pr-review.yml a `.github/workflows/pr-review.yml`

### 6. Reportar

Mostrar:
- Que se actualizo
- Que ya estaba al dia
- Que se salto
- Recordar: "Haz commit+push para que las sesiones web tengan los cambios"

---

## Reglas

1. **NUNCA tocar** archivos del proyecto que no son portables
2. **NUNCA** sincronizar email.md (es project-specific, esta en claude-config/project-specific/)
3. **Siempre** mostrar checkpoint antes de modificar
4. Si un archivo local fue modificado respecto a la version anterior de claude-config, advertir antes de sobreescribir
5. Si el modo es `--check`, NO modificar nada — solo reportar
