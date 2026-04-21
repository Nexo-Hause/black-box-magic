---
name: tdd
description: Use when implementas una feature con comportamiento bien definido (APIs con contrato claro, logica de negocio, validaciones, parsers, calculos) o arreglas un bug con reproduccion clara. NO usar para UI exploratoria, prototipos, spikes, scripts one-off, migraciones unicas, config files, o proyectos sin infraestructura de testing establecida.
---

# Test-Driven Development

Escribe el test primero. Mira fallar. Escribe el codigo minimo. Mira pasar.

## La regla

Si el test no lo viste fallar primero, no sabes si esta testeando lo correcto. Si el codigo lo escribiste antes del test, no sabes si el test es riguroso o si solo refleja lo que ya hiciste.

## Cuando SI aplica

- Feature con contrato claro (input → output conocido)
- Bug fix donde puedes reproducir el bug
- Refactor de codigo que ya tiene tests (red de seguridad contra regresiones)
- Logica de negocio: calculos, parsers, validaciones, reglas de clasificacion
- APIs: endpoint con request/response definidos

## Cuando NO aplica

- UI exploratoria donde "funciona" = "se ve bien" (el test util es visual, no unit)
- Prototipos y spikes — estas aprendiendo que construir, TDD primero seria testear suposiciones
- Scripts one-off, migraciones unicas, analytics ad-hoc
- Config files, wiring, infra-as-code
- Proyectos sin infraestructura de tests (monta la infra primero si vale la pena; si no, saltate TDD para ese proyecto)

Si dudas si aplica, preguntale a Gonzalo antes de empezar.

## El ciclo Red-Green-Refactor

### RED — Escribir test que falle

Un test, un comportamiento, nombre claro.

**Bien:**
```typescript
test('retryOperation re-intenta 3 veces y luego devuelve el ultimo exito', async () => {
  let attempts = 0;
  const op = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(op);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

**Mal:**
```typescript
test('retry works', async () => {  // nombre vago
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);  // testea mock, no comportamiento
});
```

### Verificar RED — Mirar que falle

Corre el test. Asegurate que:

- Falla (no errora por typo)
- Falla por la razon correcta (function no existe, o returns wrong value)
- No pasa por accidente (si pasa, estas testeando algo existente; reescribe el test)

Si pasa o errora de forma inesperada, arregla el test antes de implementar.

### GREEN — Escribir el codigo minimo

Lo minimo para pasar el test. Nada mas.

**Bien (minimo):**
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e) { if (i === 2) throw e; }
  }
  throw new Error('unreachable');
}
```

**Mal (over-engineered):**
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // ... YAGNI todo lo que no pide el test actual
}
```

### Verificar GREEN — Mirar que pase

- Corre el test: pasa
- Corre el resto de tests: siguen pasando
- No hay warnings nuevos

Si falla, arreglas el codigo (no el test). Si otros tests fallan, es regresion, arreglala ahora.

### REFACTOR — Limpiar

Solo cuando esta en verde:

- Remover duplicacion
- Mejorar nombres
- Extraer helpers

Mantener todos los tests verdes. No agregar comportamiento nuevo en refactor (eso va en otro ciclo RED).

### Siguiente test

Vuelve a RED con el siguiente comportamiento.

## Si escribiste codigo antes del test

- Borra el codigo
- No lo "adaptes" mirandolo mientras escribes el test
- No lo guardes como "referencia"
- Escribe el test desde cero, y luego implementa fresh

Parece duro pero la alternativa es un test que refleja el codigo (no el comportamiento), y no te protege de nada.

## Tests buenos vs malos

| Bueno | Malo |
|---|---|
| Testea comportamiento | Testea implementacion (mocks internos) |
| Nombre describe el "que" | Nombre vago o describe el "como" |
| Un comportamiento por test | Varios asserts sin relacion |
| Setup minimo | Setup masivo |
| Falla con mensaje claro | Falla con `expected true got false` |

## Integracion

- `systematic-debugging` fase 4: el test que falla primero es TDD aplicado al bug.
- `verification`: cada paso del ciclo (verify-red, verify-green) es una verificacion.
- `writing-spec`: si la spec es para Alibaba, el template incluye "test primero" como parte de la secuencia de steps.
