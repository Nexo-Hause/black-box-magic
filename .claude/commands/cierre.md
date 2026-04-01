Protocolo de cierre de sesión. Ejecutar estos pasos en orden:

### 1. Actualizar `.claude/STATUS.md`

Si el proyecto tiene `.claude/STATUS.md`, actualizarlo con:
- **Última sesión:** fecha y resumen breve de lo que se hizo
- **Foco Actual:** actualizar si cambió
- **Bloqueos:** agregar nuevos, quitar resueltos
- **Próximos Pasos:** actualizar según lo que quedó pendiente
- Si hubo decisiones de arquitectura, agregar a la sección de decisiones
- Si se creó un spec nuevo, agregarlo a la tabla de specs

### 2. Actualizar `.claude/SESSION_LOG.md`

Si existe, agregar una línea con el resumen de la sesión:
```
### Sesión <número> (<fecha>)
<Resumen de 2-3 líneas: qué se hizo, archivos clave, PR#>
```

### 3. Revisar documentación

Evaluar si los cambios de esta sesión afectan algún doc del proyecto. Solo actualizar si hubo cambios relevantes. Buscar en `docs/`, `README.md`, y cualquier doc referenciado en CLAUDE.md. Si nada cambió, saltar este paso.

### 4. Commit y push

```bash
git add .claude/STATUS.md .claude/SESSION_LOG.md <otros archivos cambiados>
git commit -m "chore: cierre sesión <número> — <resumen breve>"
git push
```

**NUNCA** usar `git add -A` (puede incluir archivos sensibles).
**NUNCA** hacer push a main directamente.

### 5. Crear PR

```bash
gh pr create --title "<resumen>" --body "## Resumen\n<bullet points de cambios>"
```

Informar la URL del PR al usuario. **No mergear** — esperar instrucciones.

### 6. Procesar review de AI (obligatorio)

Ejecutar el flujo de `/review` para procesar el code review automático:
- Esperar a que el review aparezca en el PR (~2 min)
- Leer findings, corregir los válidos, descartar con justificación los que no aplican
- Commit + push las correcciones
- Iterar hasta que el PR esté limpio
- Solo entonces continuar al resumen final

### 7. Resumen al usuario

Mostrar:
- Qué se hizo en esta sesión (bullet points)
- Qué quedó pendiente
- Si hay bloqueos nuevos
- URL del PR
- Estado del review (findings corregidos / descartados)
- **Recordar: mergear el PR para que la próxima sesión tenga el STATUS.md actualizado**

### 8. Verificar git

```bash
git status    # No debe haber cambios sin commit
git log --oneline -3   # Verificar commits
```
