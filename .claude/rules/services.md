# Acceso a servicios externos

Estas instrucciones aplican a TODAS las sesiones de Claude Code en cualquier repo.

## GitHub

Autenticado vía `gh` CLI con Personal Access Token (`ghp_...`).

**Fuentes del token (cascada, primer match gana):**
1. `GH_TOKEN` env var persistente de Windows (seteado con `setx` / `[Environment]::SetEnvironmentVariable`)
2. `~/.claude/github.env` — cache global con `GH_TOKEN=ghp_...`
3. `op://Dev Secrets/GitHub PAT/credential` — 1Password como último recurso
4. Keyring de Windows (legacy, `gho_...` token de OAuth flow)

**Fuente de verdad:** 1Password (`op://Dev Secrets/GitHub PAT/credential`). Los demás son cachés.

**Si se rota el token:** actualizar las 3 fuentes al mismo tiempo:
1. 1Password: `op item edit "GitHub PAT" --vault "Dev Secrets" "credential[password]=ghp_NUEVO"`
2. Cache global: editar `~/.claude/github.env`
3. Env var persistente: `powershell -Command "[Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_NUEVO', 'User')"`

**Scopes del token actual:** `repo`, `workflow`, `write:packages`. Falta `read:org` (warning no bloqueante).

- Verificar: `gh auth status`
- Test rápido: `gh repo list gonzalodev-ops --limit 3`

## Vercel

Autenticado vía plugin MCP de Vercel.
- Herramientas disponibles: `list_projects`, `list_deployments`, `get_project`, etc.
- Para bajar env vars a local: `vercel env pull .env.local`
- Requiere que el Vercel CLI esté instalado para `vercel env pull`.

## Supabase

Autenticado vía Supabase CLI. El access token está en `~/.supabase/access-token`.

**IMPORTANTE:** El token está en formato UTF-16LE con BOM. Git Bash no lo carga automáticamente.

Para cargar el token al inicio de cualquier operación con Supabase CLI:
```bash
export SUPABASE_ACCESS_TOKEN=$(node -e "const fs=require('fs');const b=fs.readFileSync(require('os').homedir()+'/.supabase/access-token');process.stdout.write(b.toString('utf16le').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufeff\ufffe]/g,'').trim())")
```

Después de exportar, comandos como `supabase projects list` funcionan normalmente.

- Verificar: `supabase projects list`
- Para obtener API keys de un proyecto: `supabase projects api-keys --project-ref <ref>`

## 1Password

CLI instalado en `C:\Users\gleon\scoop\apps\1password-cli\current\op.exe`.
Cuenta: `my.1password.com` (gleonp@gmail.com).

### Vaults — cuál usar

| Vault | Para qué | Claude lo toca? |
|---|---|---|
| **`Dev Secrets`** | **TODOS** los secrets de desarrollo: API keys, tokens de servicios, DB credentials, webhook URLs, SMTP passwords, cloud provider keys, coding plans | **Sí — default obligatorio para cualquier secret de trabajo** |
| `Private` | Secrets personales de Gonzalo (banking, apps personales, cuentas no-laborales) | **NO** — nunca crear, leer, ni referenciar items aquí |
| `Shared` | Secrets compartidos con otras personas | Solo si Gonzalo lo indica explícitamente |
| Otros (`farmasi`, `k`, etc.) | Vaults project-specific | Solo si Gonzalo lo indica explícitamente |

**REGLA DURA:** Cuando escribas cualquier `op://...` path en código, comandos, docs o scripts, debe empezar con `op://Dev Secrets/...`. Si te encontrás tentado a usar `op://Private/...` para un secret de desarrollo, **pará y usá `Dev Secrets`**. `Private` está reservado para los secrets personales de Gonzalo.

### Convención de naming de items

Pattern observado en `Dev Secrets`: `<Proyecto> - <Categoría>`.
- `DeepAudit - AI APIs`
- `SGR-CBC - Secrets`
- `Black Box Magic - SMTP`

Para recursos cross-project que no pertenecen a un solo proyecto (como coding plans, cuentas globales), usar el nombre del servicio directo: `Alibaba Coding Plan`, `Anthropic API`, etc.

### Workflow de upload

Gonzalo pone los secrets nuevos en `.env.local` del repo (ya está en `.gitignore`). Claude los sube a `Dev Secrets` cuando corresponda, **sin leer los valores con el Read tool**. El patrón seguro es sourcear `.env.local` dentro de un subshell y pipear directo a `op item create`:

```bash
( set -a; . ./.env.local; set +a; \
  /c/Users/gleon/scoop/apps/1password-cli/current/op.exe item create \
    --category="API Credential" \
    --title="<Nombre del Item>" \
    --vault="Dev Secrets" \
    "credential[password]=$VARIABLE_NAME" \
    > /dev/null 2>&1 \
) && echo "uploaded" || echo "failed"
```

Después del upload: **no borrar `.env.local` sin preguntar** (ver `feedback_file_handling.md` — hay historia).

### Leer un secret sin exponerlo

```bash
/c/Users/gleon/scoop/apps/1password-cli/current/op.exe read "op://Dev Secrets/NombreDelItem/campo"
```

El espacio en `Dev Secrets` se respeta literal (no se URL-encodea) si la ruta va entre comillas dobles.

### Inyectar en un comando sin tocar disco

```bash
ANTHROPIC_API_KEY=$(op read "op://Dev Secrets/Alibaba Coding Plan/credential") comando
```

La key vive solo en el env del subprocess, nunca se escribe a disco ni aparece en logs.

### Items conocidos (referencia rápida)

- `op://Dev Secrets/GitHub PAT/credential` — Personal Access Token de GitHub (`ghp_...`). Rotado 2026-04-11 después de filtración accidental vía Python a un VPS.
- `op://Dev Secrets/Alibaba Coding Plan/credential` — API key del Coding Plan de Alibaba (para Qwen/Kimi/GLM como worker, ver `rules/delegation.md`)
- `op://Dev Secrets/Alibaba Coding Plan/base_url` — Endpoint Anthropic-compatible del mismo plan

### Caches globales en `~/.claude/`

Para que los tokens sean accesibles **sin fricción desde todos los repos**, existen caches globales en `~/.claude/` (Windows: `C:\Users\gleon\.claude\`). Son archivos plaintext shell-style:

- **`~/.claude/github.env`** — `GH_TOKEN=ghp_...` (GitHub PAT)
- **`~/.claude/alibaba.env`** — `ALIBABA_API_KEY=sk-sp-...` + `ALIBABA_BASE_URL=...`

Ejemplo de `alibaba.env`:

```
ALIBABA_API_KEY=sk-sp-...
ALIBABA_BASE_URL=https://coding-intl.dashscope.aliyuncs.com/apps/anthropic
```

**Razón de existir:** `op read` puede disparar prompts biométricos que bloquean corridas no-interactivas (bench, delegaciones automáticas). El cache global elimina esa fricción para todos los repos donde Gonzalo codea de verdad.

**Fuente de verdad:** sigue siendo 1Password. Si la key rota, actualizar AMBOS (1Password y el cache global) al mismo tiempo.

**Cascada de lectura obligatoria** (runner del bench + commands que disparan el worker):

1. `process.env.ALIBABA_API_KEY` — ya en env, cero archivos tocados
2. `~/.claude/alibaba.env` — cache global, caso normal en máquinas de Gonzalo
3. `./.env.local` del repo actual — por compatibilidad (ej: claude-config tiene su propio)
4. `op read "op://Dev Secrets/Alibaba Coding Plan/credential"` — último recurso

**No commitear** `~/.claude/alibaba.env` en ningún repo. El directorio `~/.claude/` es home del usuario, no vive dentro de ningún working directory de git.

### Reglas operativas

1. **Nunca usar `op read` con el Read tool** ni imprimir el resultado en el chat.
2. **Siempre pipear directo al destino** (env var de subprocess, stdin de otro comando, archivo temporal que se borra solo).
3. **Nunca escribir secrets a archivos commiteables**. Si hace falta un archivo de config, usar `.env.local` (gitignored).
4. **Si un archivo en `commands/`, `rules/`, `bench/`, etc. referencia `op://Private/...`, es un bug.** Corregirlo a `op://Dev Secrets/...` y commit.
