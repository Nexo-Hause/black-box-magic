---
name: parallel-exploration
description: Use when necesitas leer mas de 3 archivos para responder una pregunta, buscar donde esta implementado algo en un repo que no conoces bien, sintetizar un log o output largo, mapear un area de codigo desconocida, o hacer cualquier trabajo exploratorio de lectura-sintesis antes de tomar una decision.
---

# Exploracion en paralelo con subagents internos

Mover trabajo exploratorio a subagents internos (Task tool con Explore / general-purpose, modelo Haiku o Sonnet) para no cargar archivos y outputs masivos en el contexto de Opus.

## Por que existe esta skill

El contexto de Opus es caro (tokens 4.6 costosos + rapido llenado de ventana). El trabajo exploratorio (leer 10 archivos, hacer greps, sintetizar logs) no requiere el razonamiento de Opus — lo puede hacer Haiku/Sonnet. Cuando un subagent termina, me devuelve UN mensaje con el resumen. Los archivos que leyo no entran a mi contexto.

## Cuando disparar

| Necesito... | Subagent | Modelo sugerido |
|---|---|---|
| Leer >3 archivos para responder una pregunta exploratoria | `Explore` | Haiku |
| Buscar donde esta implementado X en el repo | `Explore` | Haiku |
| Sintetizar un log, output, o texto largo | `general-purpose` | Haiku |
| Mapear un area del codigo desconocida | `Explore` | Sonnet |
| Revisar documentacion externa con razonamiento | `general-purpose` | Sonnet |
| Analizar un diff grande para sintesis | `general-purpose` | Sonnet |

## Cuando NO disparar (hazlo tu, Opus)

- Decisiones arquitectonicas
- Escribir specs para Alibaba
- Auditar planes (`/audit`)
- Codigo critico (auth, billing, RLS, migrations)
- Dialogo con Gonzalo
- Tareas con ambiguedad — primero pregunta, no delegues

## Como se invoca

Via el Task tool con `subagent_type` y opcionalmente `model`.

**Nota sobre `subagent_type`**: los valores disponibles dependen de la version de Claude Code y de los agents configurados. Valores comunes: `general-purpose` (universal), `Explore` (especializado en exploracion, si esta disponible), `Plan` (para diseno de planes). Si no sabes cual esta disponible, usa `general-purpose` como fallback seguro.

```
Task(
  description: "Explore auth module",
  subagent_type: "Explore",    # o "general-purpose" si Explore no esta disponible
  model: "haiku",
  prompt: "<contexto completo que el subagent necesita + lo que debe reportar>"
)
```

**El prompt debe ser auto-contenido**. El subagent no tiene acceso a la conversacion con Gonzalo. Incluye:
- Objetivo concreto
- Que debe mirar/leer
- Que debe reportar (formato breve si queremos respuesta corta)

## Paralelizacion

Si necesitas N exploraciones independientes, lanza N subagents en paralelo (un solo mensaje con varios Task calls). No los corras en serie si no hay dependencia.

## Red flags que senalan que te estas saltando esta skill

- "Voy a leer estos 8 archivos para entender X..." → delega a Explore
- "Dejame grepear todo el repo..." → delega
- "Este log es muy largo, voy a leer por partes..." → delega sintesis
- "Voy a explorar el modulo auth..." → delega (excepto si es decision arquitectonica)

## Que NO hacer

- No mezclar delegacion interna con delegacion a Alibaba. Alibaba corre en terminal aparte para trabajo de implementacion. Los subagents internos son para exploracion/sintesis dentro de ESTA sesion.
- No delegar tareas de implementacion a subagents internos. Para implementar codigo, la spec va a Alibaba (terminal aparte, `/delegate`).
- No pasar secretos, .env, o credenciales en el prompt del subagent.

## Integracion

- `resume-session` puede invocar esta skill si el STATUS.md requiere sintesis de multiples archivos/logs.
- `systematic-debugging` fase 1-2 (gathering evidence) se beneficia de esta skill cuando el sistema es multi-componente.
