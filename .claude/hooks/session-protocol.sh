#!/bin/bash
cat << 'PROTOCOL'
## PROTOCOLO DE SESIÓN — OBLIGATORIO

1. **STATUS:** Leer `.claude/STATUS.md`
2. **Commands:** Leer TODOS los archivos en `.claude/commands/`
3. **Rules:** Leer TODOS los archivos en `.claude/rules/`
4. **Git:** Posicionarse en main/master limpio, crear branch de sesión
5. **NUNCA:** mergear PRs ni push a main sin autorización

Post-PR: Todo PR pasa por review de AI (/review).
Post-Plan: Todo spec con plan se audita (/audit) antes de implementar.
PROTOCOL
exit 0
