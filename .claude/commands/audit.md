Ejecutar auditoría completa de un spec o plan antes de implementar. Analiza arquitectura, seguridad, UX, performance, completitud y puntos ciegos en 3 fases, luego enriquece el plan original.

$ARGUMENTS

Comportamiento según argumento:
- **Con número de spec** (ej: `6`): Auditar `spec/06-*.md`
- **Con path a archivo**: Auditar el archivo indicado
- **Sin argumentos**: Buscar spec activo en `.claude/STATUS.md`. Si no hay, preguntar al usuario qué auditar.

---

## Preparación

1. **Leer el spec/plan completo** que se va a auditar
2. **Leer `CLAUDE.md`** del proyecto para entender stack, reglas y convenciones
3. **Leer `.claude/rules/`** relevantes según lo que toca el spec (security, testing, supabase, etc.)
4. **Entender el estado actual** del código que el spec va a modificar (explorar archivos clave)

---

## FASE 1: Auditoría Técnica Multi-Dimensional

Lanzar agentes en paralelo, uno por dimensión. Cada agente debe leer el spec Y el código relevante:

| Dimensión | Qué revisar |
|-----------|-------------|
| **Arquitectura** | ¿Coherente con la arquitectura existente? ¿Acoplamiento innecesario? ¿Dependencias correctas? ¿Separación de responsabilidades? |
| **Ingeniería** | ¿Enfoque técnico sólido? ¿Hay alternativas más simples? ¿Se respeta el stack del proyecto (ver CLAUDE.md)? ¿Over-engineering? |
| **Seguridad** | ¿Vulnerabilidades? CSRF, XSS, SQL injection, OWASP Top 10. ¿Auth y ownership verificados? ¿Datos sensibles expuestos? |
| **UX** | ¿Flujo del usuario claro? ¿Feedback en cada acción? ¿Errores visibles? ¿Estados vacíos, loading, error cubiertos? |
| **Frontend** | ¿Componentes reutilizables? ¿Estado manejado correctamente? ¿Rendering performance? ¿Accesibilidad básica? |
| **Backend** | ¿APIs bien diseñadas? ¿Validación en boundaries? ¿Manejo de errores? ¿Contratos claros? |
| **QA** | ¿Qué tests se necesitan? ¿Cobertura estimada? ¿Edge cases identificados? ¿Tests existentes afectados? |
| **Performance** | ¿Queries optimizadas? ¿N+1? ¿Paginación? ¿Lazy loading? ¿Bundle size? |
| **Breaking changes** | ¿Se rompe algo existente? ¿APIs mantienen contrato? ¿Tests existentes pasan? ¿Migraciones reversibles? |

Para cada dimensión, reportar con severidad:
- 🔴 **Crítico** — Debe resolverse ANTES de implementar
- ⚠️ **Observación** — Riesgo bajo, considerar
- ✅ **OK** — Sin problemas detectados

**Adaptar al spec:** Si el spec no toca frontend, no auditar frontend. Si no toca DB, no auditar data integrity. Usar sentido común.

### Gate Fase 1 → Fase 2

- Si hay **🔴 críticos**: PAUSAR. Presentar hallazgos al usuario y esperar decisión antes de continuar.
- Si solo hay **⚠️ y ✅**: Informar hallazgos brevemente y continuar automáticamente a Fase 2.

---

## FASE 2: Auditoría de Completitud y Recursos

Verificar cada punto y reportar hallazgos:

| Verificación | Preguntas clave |
|-------------|----------------|
| **Conexión usuario-función** | ¿Todo lo que se construye tiene un propósito visible para el usuario final? ¿No hay código huérfano ni features "por si acaso"? ¿Cada dato que se genera en backend tiene una ruta visible en la UI? |
| **Recursos apropiados** | ¿Se usan las herramientas correctas del stack? ¿No se está reinventando algo que ya existe? ¿Las dependencias son necesarias? |
| **Flujo de usuario intacto** | ¿Los cambios no interrumpen workflows existentes del usuario? ¿Las pantallas actuales siguen funcionando? |
| **Performance adecuada** | ¿Las estimaciones de carga son realistas? ¿Se necesita paginación, lazy loading, caching? ¿Los queries escalan? |
| **Tests identificados** | ¿Están listados todos los tests necesarios por tipo (unit, integración, visibilidad, E2E)? ¿Se cubren los happy paths Y los error paths? |
| **Errores comunes de producción** | ¿Se manejan timeouts? ¿Rate limits? ¿Datos faltantes/nulos? ¿Concurrencia? ¿Retry logic? ¿Graceful degradation? |

### Gate Fase 2 → Fase 3

- Si hay **🔴 críticos**: PAUSAR. Presentar hallazgos al usuario y esperar decisión.
- Si solo hay **⚠️ y ✅**: Informar y continuar automáticamente a Fase 3.

---

## FASE 3: Puntos Ciegos

Lanzar agentes para buscar perspectivas no cubiertas en las fases anteriores:

| Perspectiva | Qué buscar |
|------------|------------|
| **Data integrity** | ¿Migraciones reversibles? ¿Riesgo de corrupción? ¿Backups necesarios? ¿Foreign keys correctas? |
| **Observabilidad** | ¿Se puede diagnosticar problemas en producción? ¿Logs suficientes y visibles? ¿Métricas? |
| **Edge cases** | ¿Datos vacíos, nulos, enormes, unicode, caracteres especiales? ¿Comportamiento offline? |
| **Rollback** | ¿Se puede revertir el cambio sin pérdida de datos? ¿Feature flags necesarios? |
| **Dependencias** | ¿Dependencias nuevas mantenidas? ¿Licencias compatibles? ¿Impacto en bundle size? |
| **Documentación** | ¿Qué docs se actualizan? ¿Onboarding? ¿APIs? ¿README? |
| **Otras dimensiones** | Evaluar si hay algo más específico del proyecto que no se cubrió. Usar contexto de CLAUDE.md y rules. |

### Gate Fase 3 → Síntesis

- Si hay **🔴 críticos**: PAUSAR.
- Si no: Continuar a síntesis.

---

## SÍNTESIS: Enriquecer el Plan

Al completar las 3 fases, agregar una sección **"Auditoría pre-implementación"** al spec original con esta estructura:

```markdown
## Auditoría pre-implementación

**Fecha:** [fecha]
**Resultado global:** [✅ Aprobado | ⚠️ Aprobado con observaciones | 🔴 Requiere cambios]

### Hallazgos críticos (🔴)
[Lista de hallazgos críticos y cómo se resuelven. Si no hay, indicar "Ninguno".]

### Observaciones (⚠️)
[Lista de observaciones y la decisión tomada: resolver ahora, resolver durante implementación, o aceptar riesgo.]

### Fases de implementación (revisadas)
[Tareas agrupadas por fase con dependencias claras. Incorporar los hallazgos de la auditoría — agregar tareas que faltaban, reordenar si hay dependencias nuevas, eliminar lo innecesario.]

### Tests requeridos
| Tipo | Qué verificar | Prioridad |
|------|--------------|-----------|
| Unit | [descripción] | [alta/media/baja] |
| Integración | [descripción] | [alta/media/baja] |
| Visibilidad | [descripción] | [alta/media/baja] |
| E2E | [descripción] | [alta/media/baja] |

### Criterios de aceptación
[Definición de terminado para el spec completo. Qué debe ser verdad para considerar esto implementado.]

### Riesgos residuales
[Lo que no se puede mitigar completamente y el usuario debe saber. Si no hay, indicar "Ninguno".]
```

---

## Reglas del Audit

1. **No ser superficial.** Cada dimensión requiere leer código real, no solo opinar sobre el spec en abstracto. Los agentes deben explorar los archivos que el spec va a tocar.
2. **No inventar problemas.** Solo reportar hallazgos reales y concretos, con evidencia (archivo, línea, escenario). No agregar warnings genéricos para "parecer exhaustivo".
3. **Ser accionable.** Cada hallazgo 🔴 o ⚠️ debe incluir una recomendación concreta de cómo resolverlo.
4. **Respetar el stack.** Las recomendaciones deben usar las herramientas del proyecto (según CLAUDE.md), no proponer herramientas nuevas.
5. **Contexto > checklist.** Adaptar las dimensiones al proyecto. Si el spec no toca frontend, no auditar frontend. Si no toca DB, no auditar data integrity. Usar sentido común.
6. **El gate es real.** Si hay 🔴 críticos, NO continuar automáticamente. El usuario debe decidir.
