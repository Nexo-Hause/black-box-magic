---
name: verification
description: Use antes de declarar algo como "listo", "funciona", "pasa", "completado", "deployado", o cualquier variacion de exito. Tambien antes de crear PRs, commits de cierre, o reportes de status sobre trabajo completado.
---

# Verificacion antes de declarar "listo"

Lo que no esta verificado no esta hecho. Esta skill te da la rutina de chequeo antes de cualquier claim de exito.

## La regla

Antes de declarar cualquier status positivo o satisfaccion con el trabajo, corre el comando de verificacion correspondiente en esta sesion y lee su output. Si no lo corriste en esta sesion, no puedes afirmar que pasa.

## Que aplica como "verificacion"

Depende del tipo de claim:

| Claim | Comando que lo prueba | No es suficiente |
|---|---|---|
| Tests pasan | Correr test suite, ver `0 failures` | Corrida previa, "deberia pasar" |
| Build compila | `npm run build` / `cargo build` con exit 0 | Lint paso |
| Bug arreglado | Correr el caso que reproducia el bug, confirmar que no ocurre | "cambie el codigo, asumo que funciona" |
| Regression test valida | Ciclo red-green: revertir fix, ver test fallar, restaurar, ver pasar | "escribi el test" |
| Agente delegado completo | Leer `git diff HEAD~1` y confirmar | Self-report del agent |
| PR mergeado | `gh pr view <n> --json mergedAt` con valor no null | "le di click" |
| Migration corrida | Output del migrate tool con exit 0 y verificar schema | "deberia haber corrido" |
| Comando ejecutado | Su propio output en esta sesion | Historico |

## Senales de que estas por declarar sin verificar

Detente si te encuentras:

- Escribiendo "deberia funcionar", "probablemente pasa", "tiene buena pinta"
- Escribiendo "perfecto", "listo", "ya quedo", "excelente" antes de correr el comando
- Confiando en el reporte de Alibaba sin haber revisado el `git diff HEAD~1`
- Extrapolando: "el lint paso, entonces compila" (no necesariamente)
- Extrapolando: "el test unitario paso, entonces la integracion tambien" (no)
- "Ya lo corri hace rato, debe seguir igual" (no necesariamente — pudo cambiar algo)
- Pensando "solo por esta vez salto la verificacion"

## Racionalizaciones tipicas y que hacer

| Excusa | Que hacer en su lugar |
|---|---|
| "Confio en lo que reporto Alibaba" | Corre `git diff HEAD~1 HEAD` y revisa que el diff coincide con la spec |
| "El lint paso, asumo que compila" | Corre el build |
| "Hace 5 minutos pasaba" | Corre el test ahora |
| "Es obvio que funciona" | Obviedad no es evidencia |
| "Estoy cansado, lo corro despues" | 5 segundos ahora ahorran debugging de 20 min despues |
| "No quiero gastar tokens en correr test suite completo" | Corre al menos los tests del area tocada |

## Formato correcto de claim

```
Correcto:
  [corri el comando] → [vi el output] → "Tests pasan (34/34)" con evidencia mostrada

Incorrecto:
  "Deberia pasar" / "Creo que funciona" / "Tiene buena pinta"
```

## Caso especial: reportar a Gonzalo

Cuando el claim es de cara a Gonzalo (status, PR creado, merge hecho, feature terminada):

- PR creado → URL del PR
- PR mergeado → output de `gh pr merge` o `gh pr view --json state`
- Tests corriendo → resumen del output con conteo de pass/fail
- Deploy → link al log de deploy
- Migration → output del comando de migrate

"Listo" sin prueba no es "listo".

## Integracion

- `systematic-debugging` fase 4 usa esta skill para verificar el fix antes de cerrar.
- `tdd` usa esta skill en cada paso (verify-red, verify-green).
- `/cierre` exige verificacion antes de escribir STATUS.md con trabajo "completado".
- `/accept` (post-delegacion a Alibaba) exige verificacion del diff antes de aceptar.

## Si la verificacion falla

No reportes exito. Reporta el estado real con el output:

```
Correcto:
  "Tests fallan: 2/34. Output:
   [output relevante]
   Estoy investigando la causa."

Incorrecto:
  "Casi listo, solo faltan unos detalles" (opaco, no accionable)
```
