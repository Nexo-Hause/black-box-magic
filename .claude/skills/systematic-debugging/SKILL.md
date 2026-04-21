---
name: systematic-debugging
description: Use ante cualquier bug, test failure, error inesperado, build failure, comportamiento anomalo, o "algo no funciona". Especialmente util bajo presion de tiempo (cuando la tentacion de "fix rapido" es mas fuerte), despues de fixes previos que no resolvieron, o cuando no entiendes del todo el problema.
---

# Debugging sistematico

Random fixes crean bugs nuevos. Fixes al sintoma esconden la causa. Esta skill te obliga a encontrar la raiz antes de tocar codigo.

## La regla

No propongas ningun fix sin haber completado la fase 1 (investigacion de causa raiz). Sin importar lo obvio que parezca el fix, sin importar la urgencia.

## Cuando es especialmente dificil seguir el proceso

- Bajo presion de tiempo (las emergencias son cuando mas tentador es adivinar)
- Cuando el fix parece obvio ("seguro es solo X")
- Despues de 2-3 fixes que no funcionaron (la frustracion empuja a probar cosas)
- Cuando alguien pide "arreglarlo YA"

Sistematico es mas rapido que thrashing. El thrashing produce 5 fixes en 1 hora sin resolver; sistematico produce 1 fix en 30 minutos que resuelve.

## Las 4 fases

Cada fase se completa antes de pasar a la siguiente.

### Fase 1 — Investigacion de causa raiz

**Lectura cuidadosa del error**

- No saltarse errores o warnings — a veces el error contiene el fix
- Leer stack traces completos: numeros de linea, paths, codigos de error
- Si hay multiples errores, identificar cual es el "primero" (los demas suelen ser consecuencia)

**Reproducir consistentemente**

- Pasos exactos para triggear el bug
- Ocurre siempre o intermitente?
- Si no es reproducible: juntar mas datos (logs, traces, repro desde otro angulo) antes de proponer un fix. No adivinar.

**Revisar cambios recientes**

- `git log --oneline -10`
- Dependencias actualizadas? Config cambio? Env vars diferentes?
- Si el bug aparecio despues de un commit conocido: `git diff <commit>^ <commit>` para ver exactamente que cambio

**Juntar evidencia en sistemas multi-componente**

Si el problema cruza componentes (CI → build → sign, o API → service → DB):

1. Instrumentar cada boundary: log de que entra / que sale
2. Correr y ver donde se rompe
3. Solo entonces, investigar el componente que fallo

Ejemplo (signing en CI):

```bash
# Layer 1: Workflow
echo "=== Secrets in workflow ==="
echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

# Layer 2: Build script
echo "=== Env in build ==="
env | grep IDENTITY || echo "NOT PRESENT"

# Layer 3: Signing script
echo "=== Keychain ==="
security find-identity -v

# Layer 4: Signing actual
codesign --verbose=4 "$APP"
```

**Trazar el flujo de datos hacia atras**

Si el error es "valor X es None en la linea 100":

1. De donde viene ese valor?
2. Quien lo puso en None?
3. Trazar hasta encontrar el origen
4. El fix va en el origen, no en la linea 100

### Fase 2 — Analisis de patrones

**Buscar ejemplos que SI funcionan**

- Codigo similar en este mismo repo que si funciona
- Que tiene de diferente al codigo roto?

**Compararlo con referencia**

- Si estas implementando un patron, lee la referencia COMPLETA (no solo el trozo)
- Lista cada diferencia entre "funciona" y "no funciona", por pequena que sea

**Entender dependencias**

- Que otros componentes necesita
- Que config, env vars, assumptions hace
- Estan disponibles en el contexto donde falla?

### Fase 3 — Hipotesis y testing

**Formar UNA hipotesis**

- "Creo que la causa raiz es X porque Y"
- Escribirla concretamente, no vagamente

**Testear minimamente**

- Cambio mas pequeno posible para validar la hipotesis
- Una variable a la vez
- No arreglar 3 cosas en el mismo fix

**Verificar antes de avanzar**

- Funciono? → Fase 4
- No funciono? → Formar NUEVA hipotesis (no apilar mas fixes)

**Si no entiendes algo, admitelo**

- "No entiendo X" es mejor que pretender
- Preguntar es mas rapido que 3 hipotesis incorrectas

### Fase 4 — Implementacion

**Test que falle primero**

- Caso de test mas simple que reproduzca el bug
- Debe fallar antes del fix
- Ver skill `tdd` para mecanica del red-green

**Fix unico**

- Una cosa a la vez
- No "ya que estoy, arreglo estas otras 3 cosas"
- No refactor oportunista

**Verificar fix**

- Corre el test creado en el paso 1 — pasa?
- Corre test suite completo — nada roto?
- Ver skill `verification`

**Si el fix no funciona**

Cuenta: cuantos fixes intentados?

- **< 3** → volver a Fase 1 con la nueva info
- **>= 3** → DETENTE. Cuestiona la arquitectura. Habla con Gonzalo antes de fix #4.

Si 3 fixes fallaron, el problema no es el fix — es algo mas profundo. Seguir intentando fixes es reforzar el error.

## Integracion con otras skills

- `parallel-exploration`: cuando la fase 1-2 requieren leer muchos archivos, delega a Explore/general-purpose.
- `tdd`: la fase 4 (test que falla → fix → test que pasa) es TDD aplicado al bug.
- `verification`: la fase 4 cierra con la rutina de verification antes de declarar "arreglado".

## Integracion con el flujo Alibaba

Cuando Alibaba (GLM) reporta un bug durante su implementacion:

1. No delegues el debugging a Alibaba directamente si es sutil. Trae el problema de vuelta a Opus.
2. Opus usa esta skill para encontrar causa raiz.
3. Opus actualiza la spec con el fix (o lo corrige directo si es puntual).
4. Alibaba retoma con la spec actualizada.
