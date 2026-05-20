# Runbook de Operación en Producción — Black Box Magic Worker

Este documento detalla la matriz de resolución de incidentes, procedimientos de monitoreo y políticas de mitigación de costos para el pipeline y worker asíncrono BullMQ ejecutado en el VPS.

---

## 📋 Matriz de Resolución de Incidentes (Síntoma → Causa → Acción)

| Síntoma | Causa Probable | Acción Recomendada |
| :--- | :--- | :--- |
| **Error: Redis connection lost** o el worker no inicia y arroja errores de conexión a Redis. | El servidor Redis en el VPS está caído, no responde o se quedó sin memoria. | 1. Entrar vía SSH al VPS.<br>2. Comprobar el estado del servicio: `systemctl status redis`<br>3. Iniciar o reiniciar el servicio: `sudo systemctl restart redis`<br>4. Verificar que Redis escuche en el puerto correcto: `redis-cli ping` (debe responder `PONG`).<br>5. Si persiste, revisar los logs de Redis en `/var/log/redis/redis-server.log`. |
| **Alerta `[UBIQO_AUTH_FAILURE]` en logs** o filas de base de datos marcadas con `error_kind='ubiqo_auth'`. | El token de la API de Ubiqo ha expirado, ha sido revocado o es incorrecto. | **Procedimiento de Rotación de Token:**<br>1. Obtener un nuevo token válido de la consola de Ubiqo.<br>2. Actualizar el registro correspondiente en **1Password**.<br>3. Editar el archivo `.env` del worker en el VPS y actualizar la variable `UBIQO_API_TOKEN`.<br>4. Reiniciar el proceso de PM2 actualizando el entorno:<br>`pm2 restart bbm-worker --update-env` |
| **Filas de capturas o incidencias estancadas** en estado `processing` por más de 15 minutos. | Caída abrupta del proceso del worker, reinicios del VPS o problemas severos de conectividad de red mientras se procesaba un lote. | **El Reconciliador de Estado Automático se encargará de esto:**<br>1. El worker ejecuta un repeatable job (`reconcile-jobs`) cada 10 minutos.<br>2. Este job consulta los IDs reales de BullMQ (`bullmq_job_id`) en Redis.<br>3. Si el job ya no está activo/esperando/retrasado en la cola, revierte automáticamente el estado de la fila a `pending` (para reintentar) o a `failed` (si ya superó los 2 intentos acumulados).<br>4. Busca en los logs del worker `RECONCILE_REQUEUED=<n>` para validar cuántos trabajos fueron recuperados. |
| **Mensaje `[Budget Exceeded]` en logs** y trabajos suspendidos en la cola o fallando de inmediato. | El costo estimado de procesamiento con Gemini de hoy ha superado el límite diario configurado en `GEMINI_DAILY_BUDGET_LIMIT`. | 1. Comprobar el costo acumulado en base de datos. Cada token consumido suma al total diario.<br>2. Si se requiere procesar más capturas de forma urgente, se puede incrementar temporalmente el límite diario en el archivo `.env` del VPS (ej: cambiar `GEMINI_DAILY_BUDGET_LIMIT=50.0` a `100.0`).<br>3. Reiniciar PM2 para aplicar el nuevo límite:<br>`pm2 restart bbm-worker --update-env`<br>*Nota: Si la variable está ausente, es inválida (no numérica) o es negativa, se aplica el fallback de seguridad de **$50 USD diarios**.* |

---

## 🔄 Flujo de Reconciliación de Estado (Cola ↔ Base de Datos)

El reconciliador de estado (`infra/vps/worker/src/reconcile.ts`) es una pieza de seguridad crítica diseñada para **evitar el bloqueo perpetuo** de capturas o incidencias.

```mermaid
graph TD
    A[Inicio de Ciclo Reconciliar cada 10m] --> B[Buscar filas 'processing' > 15 min]
    B --> C{¿Se encontró alguna?}
    C -- No --> D[Fin de ciclo: RECONCILE_REQUEUED=0]
    C -- Sí --> E[Obtener bullmq_job_id de la fila]
    E --> F{¿El job está vivo en BullMQ?<br>active / waiting / delayed}
    F -- Sí --> G[Ignorar: El trabajo sigue en proceso real]
    F -- No --> H{¿retry_count >= 2?}
    H -- No --> I[Restaurar a 'pending'<br>Incrementar RECONCILE_REQUEUED]
    H -- Sí --> J[Marcar como 'failed' permanentemente<br>error_kind = 'permanent']
    I --> K[Actualizar fila en Supabase]
    J --> K
    K --> L[Siguiente fila]
    L --> B
```

### Monitoreo Manual de la Reconciliación
* Puedes ver el estado de la cola `reconcile` y del job repetible `reconcile-jobs` entrando al panel de **Bull Board** en `http://<IP-DEL-VPS>:3005/admin/queues`.
* Si deseas forzar un ciclo de reconciliación manual sin esperar los 10 minutos, puedes desencadenar el job directamente desde la sección "reconcile" en el panel visual.

---

## ⚡ Ajustes de Concurrencia y Rate Limits

Para regular el consumo y evitar bloqueos en Gemini, el worker respeta la configuración definida en las variables de entorno del VPS:

1. **`WORKER_CONCURRENCY`**: Define cuántos jobs se procesan en paralelo.
   * Por defecto, procesa un máximo de **2** capturas de Ubiqo concurrentes y **1** análisis de planograma concurrente.
   * Si el VPS tiene pocos recursos o Gemini arroja demasiados errores de límite de tasa, reduce la concurrencia a `1` en el archivo `.env`.
2. **`GEMINI_MAX_PER_MIN`**: Controla el rate limit de peticiones por minuto a la API de Gemini mediante el limitador nativo de BullMQ.
   * Por defecto es **30** peticiones por minuto.
   * Evita saturar la cuota gratuita o de pago de la API.
