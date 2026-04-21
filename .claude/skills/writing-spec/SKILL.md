---
name: writing-spec
description: Use cuando vas a escribir una spec para delegar trabajo a Alibaba (GLM+Kimi) via el comando /delegate, cuando Gonzalo dice "vamos a delegar X" / "preparemos la tarea para GLM" / "arma la spec de esto", o despues de un /audit cuando el plan ya fue aprobado para ejecucion por un worker externo.
---

# Escribir una spec para delegar a Alibaba

El worker (Alibaba GLM) recibe la spec, la lee una vez, y la ejecuta sin acceso a esta sesion. Si la spec es ambigua, Alibaba adivina o regresa con preguntas — en cualquiera de los dos casos, pierdo tokens. Esta skill asegura que la spec es bite-sized y auto-contenida.

## El contrato con Alibaba

Asumo que el ejecutor:
- Es un desarrollador competente pero **no tiene contexto** de este repo, de las decisiones previas, ni de la conversacion con Gonzalo
- Tiene **gusto cuestionable** (si algo no esta especificado, puede elegir la opcion extrana)
- Tiene **aversion a testear** (si no exigo explicitamente los tests, no los va a escribir)

Por lo tanto, la spec tiene que ser completa. Cada step debe contener el contenido real, no una referencia a "la forma usual".

## Cuando disparar esta skill

- "vamos a delegar X a GLM"
- "preparemos la tarea para Alibaba"
- "arma la spec de esta feature"
- "escribe el spec de este fix"
- Despues de `/audit` cuando el plan ya fue aprobado para ejecucion

## Cuando NO disparar

- Tarea que Opus va a implementar directamente (no hace falta spec formal)
- Exploracion / research (no hay implementacion que delegar)
- Decision arquitectonica (no es delegable)
- Tarea con ambiguedad residual que no terminaste de resolver — primero resuelvela con Gonzalo

## Ubicacion y naming

Guarda el spec en:
```
.claude/tasks/TASK-<YYYYMMDD-HHMM>-<slug>.md
```

Ejemplo: `.claude/tasks/TASK-20260420-1430-add-retry-operation.md`

Si el repo tiene `docs/specs/`, `docs/callfast/`, o similar convencion para specs formales, usa esa ubicacion en lugar de `.claude/tasks/`.

## Estructura de la spec

Copia esta plantilla y completala. Cada seccion tiene un proposito — no la saltes.

````markdown
# <Nombre de la tarea>

## Objetivo

<Una frase describiendo que se va a construir o arreglar.>

## Contexto

<3-5 frases: por que esta tarea, que motiva el cambio, que sistema toca, que decisiones previas influyen. Esto ayuda al worker a tomar decisiones razonables cuando hay una ambiguedad menor.>

## Alcance

**Incluye:**
- Lista concreta de lo que SI se debe hacer

**No incluye:**
- Lista concreta de lo que NO se debe tocar (explicito: "no cambies auth", "no toques el esquema", "no agregues features nuevas")

## Archivos afectados

| Archivo | Accion |
|---|---|
| `src/path/to/file.ts` | Crear |
| `src/path/existing.ts` | Modificar (lineas 123-145) |
| `tests/path/to/test.ts` | Crear |

## Tareas

### Tarea 1: <Nombre corto>

**Archivos:**
- Crear: `src/path/to/file.ts`
- Test: `tests/path/to/test.ts`

**Steps:**

- [ ] **Step 1: Escribir test que falle**

  En `tests/path/to/test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { retryOperation } from '../src/path/to/file';

  describe('retryOperation', () => {
    it('retries 3 times before succeeding', async () => {
      let attempts = 0;
      const op = async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      };
      const result = await retryOperation(op);
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });
  });
  ```

- [ ] **Step 2: Verificar que el test falla**

  Run: `pnpm test tests/path/to/test.ts`

  Expected: FAIL con "retryOperation is not defined" o similar.

- [ ] **Step 3: Implementar lo minimo**

  En `src/path/to/file.ts`:

  ```typescript
  export async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < 3; i++) {
      try { return await fn(); }
      catch (e) { if (i === 2) throw e; }
    }
    throw new Error('unreachable');
  }
  ```

- [ ] **Step 4: Verificar que pasa**

  Run: `pnpm test tests/path/to/test.ts`

  Expected: PASS, 1/1.

- [ ] **Step 5: Correr tsc + lint**

  Run: `pnpm tsc --noEmit && pnpm lint`

  Expected: ambos exit 0, sin errores.

- [ ] **Step 6: Commit local**

  ```bash
  git add src/path/to/file.ts tests/path/to/test.ts
  git commit -m "feat(utils): add retryOperation helper"
  ```

### Tarea 2: <Siguiente>

<misma estructura>

## Criterios de aceptacion

- [ ] Todos los tests pasan: `pnpm test`
- [ ] TypeScript compila sin errores: `pnpm tsc --noEmit`
- [ ] Lint limpio: `pnpm lint`
- [ ] <Cualquier otro criterio especifico de la feature>

## Comandos de verificacion (para /accept)

Estos son los comandos que Opus correra para aceptar el trabajo:

```bash
# Cobertura de tests
pnpm test

# Type checking en cada app tocada
pnpm tsc --noEmit

# Lint
pnpm lint

# Diff contra el estado inicial
git log --oneline origin/master..HEAD
git diff origin/master..HEAD -- src/path/

# Verificar que NO se tocaron archivos prohibidos
git diff --name-only origin/master..HEAD | grep -E '\.env|secrets|credentials' && echo "VIOLATION" || echo "OK"
```

## Safety rails

Lo que NO debe hacer el worker:

- **NO** tocar `.env`, `.env.local`, `.credentials.json`, ni ningun archivo de secretos
- **NO** correr `git push` (solo commit local)
- **NO** correr `git reset --hard` sobre commits ajenos
- **NO** correr `rm -rf` sobre directorios
- **NO** ejecutar migraciones de DB
- **NO** hacer deploy ni cualquier accion que toque produccion
- **NO** usar `WebFetch` para llamar servicios externos sin supervision

## Notas para el worker

- Si encuentras ambiguedad no resuelta en esta spec, **detente y reporta** (`BLOCKED`) en vez de adivinar
- Si un archivo ya existe y lo debes crear, lee primero su contenido antes de sobreescribir
- Commitea local despues de cada tarea (no acumular cambios sin commits)
- Self-review antes de reportar DONE: correr tests, tsc, lint y verificar que pasan
````

## Self-review de la spec (antes de entregarla a Alibaba)

Despues de escribir la spec, correla por este checklist. **Fijar inline, no re-auditar**.

### 1. Cobertura del objetivo
¿Cada punto del objetivo tiene una tarea que lo implementa? Si falta algo, agregalo.

### 2. No-placeholders
Buscar en la spec y eliminar:
- "TBD", "TODO", "implementar despues", "rellenar detalles"
- "Agregar manejo de errores apropiado" sin mostrar que manejar
- "Escribir tests para lo anterior" sin mostrar el test real
- "Similar a la tarea N" sin repetir el codigo
- Steps que describen el "que" sin mostrar el "como" (sin code block cuando cambia codigo)
- Referencias a tipos, funciones, o metodos que no estan definidos en ninguna tarea

### 3. Consistencia de tipos y nombres
¿Los nombres de funciones, metodos y variables son iguales en todas las tareas? Un `clearLayers()` en Tarea 3 y `clearFullLayers()` en Tarea 7 es bug.

### 4. Ambiguedad
Si una requirement puede interpretarse de dos formas, elige una y hazla explicita.

### 5. Safety rails presentes
Confirmar que la spec incluye la seccion "Safety rails" con la lista negra.

### 6. Comandos de verificacion ejecutables
Cada comando en "Comandos de verificacion" debe ser copiable y ejecutable en el repo destino sin modificaciones. Si falta un pipeline (`pnpm tsc --noEmit` donde el proyecto no usa pnpm), ajustalo al stack real del repo.

### 7. No contiene el comando de invocacion

**Critico**: la spec NO debe incluir el comando de invocacion del subprocess (`claude -p --bare --model glm-5 ...`). Si lo incluye, el modelo lee el comando y se "marea" intentando invocarse a si mismo. El comando de invocacion vive en la terminal de Gonzalo, no en la spec.

## Despues de la self-review

- Guarda la spec
- Si el repo tiene un spec auditable, sugiere correr `/audit` sobre ella antes de delegar
- Si ya paso por `/audit` y el usuario aprobo, el siguiente paso es `/delegate <path-spec>` (Gonzalo la corre en terminal aparte)
- Cuando Alibaba reporte DONE, Gonzalo correra `/accept` que dispara la verificacion

## Red flags que senalan que escribiste una spec mala

- "Ejemplo de como implementar..." (deberia ser EL codigo, no un ejemplo)
- "Algo como..." (concreto o nada)
- "Manejar el caso edge apropiadamente" (cual edge case, como)
- Tareas de >10 steps (probablemente debe partirse en 2+ tareas)
- Mas de 20 archivos tocados (probablemente debe partirse en 2+ specs)
- Ningun test en ninguna tarea (TDD es expectativa por default salvo que digas que NO aplica)

## Integracion con otras skills y commands

- `audit`: despues de escribir la spec, Gonzalo puede correr `/audit <path>` para auditarla.
- `tdd`: la estructura de steps (test -> verify fail -> implement -> verify pass -> commit) es TDD aplicado.
- `systematic-debugging`: si la spec es para fix de bug, la tarea 1 debe reproducir el bug antes del fix (fase 4 de debugging).
- `verification`: los "Comandos de verificacion" son la base de la aceptacion via `/accept`.
- `/delegate`: toma el path de la spec y dispara el subprocess en terminal aparte (Gonzalo lo ejecuta manualmente).
- `/accept`: despues de que Alibaba termina, Opus revisa el diff contra esta spec.

## Si Alibaba regresa con preguntas

Lo que regresa con preguntas = spec con ambiguedad. Responde a la pregunta y **actualiza la spec** para la proxima. No dejes la respuesta solo en la conversacion con el worker.
