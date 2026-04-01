# Reglas de Code Review

## Review de AI es obligatorio en todo PR

- Todo PR creado pasa por review de AI (GitHub Actions u otro mecanismo del proyecto)
- **No reportar un PR como "listo" sin haber procesado el review**
- Si el review aún no está disponible, informar al usuario y ofrecer esperar
- Procesar TODOS los findings CRITICAL y HIGH — no se omiten sin justificación

## Criterios para aceptar/descartar findings

| Acción | Cuándo |
|--------|--------|
| **ACEPTAR** | El finding describe un bug real, vulnerabilidad, edge case no manejado, o error lógico |
| **DESCARTAR** | Falso positivo por contexto limitado del diff, preferencia de estilo sin impacto, o ya manejado en otro lugar del código |

- **Siempre documentar por qué se descarta** un finding — "no aplica" no es justificación suficiente
- Antes de descartar, leer el archivo completo — el reviewer solo ve el diff

## Flujo de iteración

1. Leer review completo del PR
2. Clasificar findings: aceptar vs descartar
3. Aplicar fixes aceptados en un solo commit descriptivo
4. Push → nueva review automática
5. Máximo 4 rondas. Si persisten issues después de 4, reportar al usuario con detalle.

## Integración con cierre de sesión

- El command `/cierre` incluye review como paso obligatorio
- El command `/review` puede usarse independientemente en cualquier momento
- Si un PR se creó sin pasar por review, procesarlo antes de crear el siguiente
