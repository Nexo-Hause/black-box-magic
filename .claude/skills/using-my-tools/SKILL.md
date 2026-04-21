---
name: using-my-tools
description: Use when empiezas una sesion y no estas seguro que skills/commands tienes disponibles, o cuando el usuario menciona herramientas que no recuerdas bien, o como fallback cuando necesitas decidir entre varias skills y no sabes cual aplica.
---

# Mi kit de herramientas

Inventario completo de skills, commands, y reglas disponibles en este setup. Consulta esta skill cuando no estes seguro de que herramienta usar.

## Skills auto-invocables (el modelo las dispara solo si la description aplica)

### Metodologia

| Skill | Cuando se dispara | Que hace |
|---|---|---|
| `resume-session` | Inicio de sesion en repo con `STATUS.md` | Lee STATUS + git log + PRs + presenta resumen, pide confirmacion antes de accion |
| `parallel-exploration` | Exploracion de >3 archivos, sintesis de logs | Lanza subagents Explore/general-purpose con Haiku/Sonnet, no carga su contexto en Opus |
| `verification` | Antes de declarar algo "listo" | Checklist de evidencia verificable antes de claims de exito |
| `systematic-debugging` | Bug, test failure, comportamiento inesperado | 4 fases: root cause -> pattern -> hypothesis -> fix |
| `tdd` | Feature con comportamiento definido, bug fix reproducible | RED-GREEN-REFACTOR. NO aplica a UI exploratoria, prototipos, scripts one-off |

### Workflow

| Skill | Cuando se dispara | Que hace |
|---|---|---|
| `audit` | "auditar spec/plan/feature" | 3 fases: auditoria tecnica multi-dimensional, UX/visibilidad, sintesis y enriquecer plan |
| `writing-spec` | "escribir spec para delegar", "preparar tarea para Alibaba" | Template bite-sized con file paths exactos, code blocks completos, commands con expected output, commit messages |
| `doc-coauthoring` | "escribir doc", "draft PRD", "create spec", "decision doc" | 3 etapas: Context Gathering, Refinement, Reader Testing con Claude fresca |

### Artefactos especificos

| Skill | Cuando se dispara |
|---|---|
| `frontend-design:frontend-design` | Construir componentes web, paginas, UI distintiva |
| `xlsx` | Cualquier tarea con archivos `.xlsx`, `.xlsm`, `.csv`, `.tsv` |
| `anthropic-skills:pdf`, `docx`, `pptx` | Archivos PDF/Word/PowerPoint |

## Commands de invocacion manual

| Command | Que hace |
|---|---|
| `/audit [spec]` | Dispara skill `audit` sobre un spec concreto |
| `/cierre` | Protocolo de cierre de sesion: STATUS.md, commits, cleanup |
| `/delegate [spec]` | Disparar delegacion a Alibaba (tu corres el subprocess en terminal aparte) |
| `/accept` | Aceptar resultado de delegacion, verificar diff contra spec |
| `/review` | Procesar AI review de Kimi sobre el PR actual |
| `/sync [--skills] [--all] [--check] [--global]` | Sincronizar config desde `claude-config` |
| `/init` | Inicializar infra de Claude Code en proyecto nuevo |

## Reparto de trabajo: quien hace que

```
OPUS (yo, esta sesion)         -- cerebro, dialogo, decisiones arquitectonicas,
                                  spec + audit + revision final
HAIKU/SONNET (subagents internos) -- exploracion, lectura masiva, sintesis
                                     (via Task tool con Explore/general-purpose)
ALIBABA (terminal aparte)      -- implementacion de specs auditadas
  -- GLM = implementacion
  -- Kimi = 4 rondas de review
TU                             -- puente entre Opus y Alibaba, decisiones
                                  finales, pushes a remoto
```

Regla: si la tarea es exploratoria o mecanica, considera delegar a subagents internos (Haiku/Sonnet) en lugar de hacerlo en mi propio contexto.

## Reglas claves en CLAUDE.md

Las reglas completas estan en el `CLAUDE.md` del repo. Las mas importantes:

- **Hacer la tarea**: investigar antes de proponer. Mejor opcion, no la mas facil.
- **Regla anti-ambiguedad**: ante ambiguedad, preguntar antes de asumir.
- **UX-First**: features visibles al usuario se describen paso a paso antes de codear.
- **Todo al repo, nada local**: specs, planes, decisiones van commiteadas.
- **Verificacion obligatoria**: no declarar "listo" sin evidencia verificable. Ver skill `verification`.
- **Anti-fabricacion**: nunca inventar datos, umbrales, reglas. Preguntar si no hay fuente.
- **Auditar antes de destruir**: listar que se afecta y confirmar antes de operaciones irreversibles.
- **Post-plan -> audit**: todo plan se audita antes de implementar. Command `/audit`.

## Si no encuentras lo que buscas

- Para tareas que no encajen en ninguna skill, trabajo libre esta bien.
- Si descubres un patron que se repite y valdria la pena codificar, coméntalo — se puede crear una skill nueva en `claude-config/skills/`.
