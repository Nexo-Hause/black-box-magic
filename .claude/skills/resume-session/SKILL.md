---
name: resume-session
description: Use when arrancas una sesion nueva en un repo que tiene .claude/STATUS.md, o cuando Gonzalo diga "continuemos", "retomemos", "sigamos con X", o antes de actuar sobre una continuacion de trabajo previo en un repo con trabajo en curso (branch no-main, PR abierto, commits recientes).
---

# Retomar sesion previa

Protocolo para re-establecer contexto al arrancar una sesion en un repo donde ya se ha trabajado antes, sin gastar tokens re-explorando archivos ni haciendo preguntas que STATUS.md ya responde.

## Cuando se dispara

- Arranque de sesion en un repo con `.claude/STATUS.md`
- Gonzalo dice "continuemos con X", "retomemos", "sigamos"
- Antes de tomar cualquier accion en un repo donde claramente hay trabajo previo (branch no-main, PR abierto, commits recientes)

## Cuando NO disparar

- Sesiones que claramente empiezan de cero (proyecto nuevo, Gonzalo dice "empecemos un X")
- Preguntas puntuales que no requieren contexto del proyecto (explicar un concepto, ayuda con syntax, etc.)

## El protocolo — 4 pasos

**Pasos 1-3 son lectura pura. No tomes ninguna accion hasta el paso 4.**

### Paso 1: Leer STATUS.md

```bash
cat .claude/STATUS.md 2>/dev/null || echo "no STATUS.md"
```

Si no existe STATUS.md: saltate esta skill y actua normalmente. El proposito de la skill es leer STATUS, sin STATUS no hay valor.

### Paso 2: Estado de git

Ejecuta en paralelo si es posible (un solo Bash con `;`):

```bash
git branch --show-current
git log --oneline -5
git status --short
```

### Paso 3: PRs abiertos (si hay `gh`)

```bash
gh pr list --author @me --state open --limit 5 2>/dev/null || echo "no gh o no PRs"
```

### Paso 4: Presentar resumen en 3 lineas y ESPERAR

Formato estricto:

```
**Estado al retomar:**
- Ultimo trabajo: <1 linea del STATUS o del ultimo commit>
- En curso: <branch + PR abierto si hay + tarea pendiente del STATUS>
- Siguiente paso segun STATUS: <1 linea>

Confirma que retomamos por aqui o dime que cambio. No hago nada hasta que me digas.
```

**No avances.** No hagas mas lecturas, greps, o decisiones arquitectonicas. Espera la confirmacion de Gonzalo.

## Por que este protocolo

- **Ahorra tokens**: STATUS.md + git log + `gh pr list` son ~500 tokens. Explorar el repo a ciegas es ~5000+ tokens y muchas veces produce conclusiones obsoletas.
- **Evita divergencia**: si el repo evoluciono entre sesiones (otro colaborador, Gonzalo trabajo desde otra maquina), el STATUS.md puede estar desactualizado. Confirmar con Gonzalo antes de actuar detecta drift temprano.
- **Respeta la regla anti-ambiguedad**: no interpretar "seguimos" sin validar que "seguimos con X" sigue siendo correcto.

## Senales de que estas saltandote esta skill mal

- "Voy a revisar los archivos del repo para orientarme" → haz primero el protocolo.
- "Parece que el ultimo commit fue X, asumiendo que seguimos con..." → no asumas, pregunta.
- "Voy a continuar donde se quedo" sin leer STATUS → fuente de bugs y de repetirse.

## Integracion con otros tools

- **`/cierre`** escribe el STATUS.md al final de cada sesion. Si cada sesion se cierra bien, esta skill tiene material actualizado que leer.
- **`using-my-tools`** puede ser util despues del resumen si hay que decidir herramienta.
