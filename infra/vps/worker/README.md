# Black Box Magic — BullMQ Worker

Este directorio contiene el esqueleto independiente para el **Worker BullMQ** diseñado para ejecutarse en el VPS. El worker es responsable del procesamiento asíncrono y en segundo plano de tareas pesadas (análisis de imágenes con Gemini, control de incidencias, descargas, ingesta recurrente).

## 🚀 Características Clave

1. **Auto-Onboarding & Auto-Descubrimiento:** No requiere que registres formularios manualmente. El repeatable job periódicamente auto-descubre qué formularios (`form_id`) procesar consultando la base de datos de capturas y asignaciones, ejecutando su ingesta de forma incremental automática.
2. **Control de Presupuesto Diario de Gemini:** Limita dinámicamente el costo de la API de Gemini basándose en una estimación de tokens diarios consumidos. Si se alcanza el umbral en `GEMINI_DAILY_BUDGET_LIMIT`, se pausan temporalmente los análisis para proteger tus costos. Si esta variable está ausente, no es válida o es negativa, se utilizará un fallback de seguridad predeterminado de **$50 USD diarios**.
3. **Panel Visual de Monitoreo (Bull Board):** Servidor Express integrado con Basic Auth para supervisar, reintentar y auditar trabajos en tiempo real en la dirección `/admin/queues`.
4. **Reutilización de Código sin Duplicados:** Mediante TypeScript Paths, el worker consume la lógica Next.js y el pipeline centralizado sin necesidad de copiar código.

---

## 🛠️ Requisitos Previos en el VPS

- **Node.js:** v18.x o superior.
- **Redis Server:** Corriendo en local (`127.0.0.1:6379`) o accesible por red.
- **PM2:** Instalado globalmente (`npm install -g pm2`) para persistencia y supervisión.

---

## 📝 Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz del repositorio o dentro de este directorio (`infra/vps/worker/.env`) con las siguientes variables:

```env
# ─── Configuración de Base de Datos ───
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ─── Configuración de IA (Gemini) ───
GOOGLE_AI_API_KEY=your-gemini-api-key
GEMINI_DAILY_BUDGET_LIMIT=50.0 # Límite diario en USD. Si está ausente, es inválido o negativo, se usa un fallback de $50.0 USD.

# ─── Configuración de Integración Ubiqo ───
UBIQO_API_TOKEN=your-ubiqo-api-token
UBIQO_QSR_CUSTOM_RULES="Reglas personalizadas..."

# ─── Configuración de Colas (Redis) ───
REDIS_URL=redis://127.0.0.1:6379

# ─── Configuración del Dashboard Bull Board (REQUERIDO, sin valores por defecto) ───
WORKER_PORT=3005
WORKER_ADMIN_USER=admin
WORKER_ADMIN_PASS=tu-contrasena-segura-aqui

# ─── Opcionales: Form IDs por defecto ───
UBIQO_DEFAULT_FORM_IDS=30143
PLANOGRAM_DEFAULT_FORM_IDS=30143
```

---

## 📦 Instrucciones de Despliegue y Operación

### 1. Preparar el Repositorio en VPS
El worker referencia de forma directa archivos en `src/lib/pipeline` en la raíz del repositorio. Por lo tanto, debes clonar el repositorio completo de la aplicación en tu VPS, y no solo la carpeta `infra`.

### 2. Instalar Dependencias y Compilar
Navega a la carpeta del worker en tu VPS y ejecuta:
```bash
# Entrar al directorio
cd infra/vps/worker

# Instalar dependencias
npm install

# Compilar TypeScript a JavaScript
npm run build
```

### 3. Iniciar el Worker con PM2
Inicia y registra el proceso en PM2 para que corra de manera continua y persistente en segundo plano:
```bash
pm2 start ecosystem.config.js
```

### 4. Guardar Estado de PM2 (Recomendado)
Para asegurar que el worker se inicie automáticamente ante un reinicio del VPS:
```bash
pm2 save
pm2 startup
```

---

## 📊 Monitoreo del Worker

Una vez que el worker está corriendo en PM2, puedes acceder al **Bull Board** desde tu navegador en la URL:
`http://<IP-DE-TU-VPS>:<WORKER_PORT>/admin/queues`

* **Usuario:** Configurado en la variable de entorno `WORKER_ADMIN_USER`.
* **Contraseña:** Configurada en la variable de entorno `WORKER_ADMIN_PASS` (REQUERIDO, sin valor por defecto por motivos de seguridad).

Desde este panel podrás:
- Ver jobs procesados con éxito, fallidos o pendientes.
- Inspeccionar payloads y logs de error detallados.
- Reintentar trabajos fallidos de manera manual con un simple clic.

---

## 📘 Runbook — Rotación de Token de Ubiqo

### 1. ¿Cómo detectar un fallo del token?
Si el token de Ubiqo expira, es revocado o es inválido, el worker registrará el error y no podrá continuar con la ingesta. Lo detectarás mediante:
* **Logs del Worker:** Buscar el mensaje de alerta crítico `[UBIQO_AUTH_FAILURE]` en los logs de PM2 corriendo:
  ```bash
  pm2 logs bbm-worker --lines 100
  ```
* **Base de Datos (Supabase):** Las capturas (`bbm_ubiqo_captures`) e incidencias (`bbm_incidences`) afectadas se marcarán con estado `'failed'` y la columna `error_kind` tendrá el valor `'ubiqo_auth'`. El campo `error_log` detallará el error de autorización HTTP 401/403.

### 2. ¿Dónde reside el token?
* **Respaldo Seguro:** El token maestro está almacenado de forma segura en **1Password** (bajo el elemento "Ubiqo API Production Token").
* **Entorno del VPS:** Se encuentra configurado en la variable de entorno `UBIQO_API_TOKEN` en el archivo `.env` del worker (o de la raíz del proyecto).

### 3. Procedimiento de Rotación y Actualización
Sigue estos pasos en orden para actualizar el token de forma segura sin interrupciones severas:
1. **Obtener el Token:** Genera o copia el nuevo token API de la consola de administración de Ubiqo.
2. **Actualizar 1Password:** Reemplaza el token antiguo en 1Password para mantener la documentación interna actualizada.
3. **Modificar el `.env`:** Accede al VPS vía SSH, abre el archivo `.env` del worker y actualiza el valor:
   ```env
   UBIQO_API_TOKEN=tu_nuevo_token_aqui
   ```
4. **Reiniciar PM2 de forma segura:** Para asegurar que PM2 cargue el nuevo archivo `.env` y lo aplique a los procesos en ejecución, debes usar la bandera `--update-env`:
   ```bash
   pm2 restart bbm-worker --update-env
   ```
5. **Verificación:** Monitorea los logs con `pm2 logs bbm-worker` para validar que el siguiente ciclo de ingesta e inicio de jobs se ejecute correctamente (HTTP 200) sin arrojar errores de autenticación.

