# Black Box Magic — BullMQ Worker

Este directorio contiene el esqueleto independiente para el **Worker BullMQ** diseñado para ejecutarse en el VPS. El worker es responsable del procesamiento asíncrono y en segundo plano de tareas pesadas (análisis de imágenes con Gemini, control de incidencias, descargas, ingesta recurrente).

## 🚀 Características Clave

1. **Auto-Onboarding & Auto-Descubrimiento:** No requiere que registres formularios manualmente. El repeatable job periódicamente auto-descubre qué formularios (`form_id`) procesar consultando la base de datos de capturas y asignaciones, ejecutando su ingesta de forma incremental automática.
2. **Control de Presupuesto Diario de Gemini:** Limita dinámicamente el costo de la API de Gemini basándose en una estimación de tokens diarios consumidos. Si se alcanza el umbral en `GEMINI_DAILY_BUDGET_LIMIT`, se pausan temporalmente los análisis para proteger tus costos.
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
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ─── Configuración de IA (Gemini) ───
GOOGLE_AI_API_KEY=your-gemini-api-key
GEMINI_DAILY_BUDGET_LIMIT=50.0 # Límite diario en USD (ej: 50.00 USD)

# ─── Configuración de Integración Ubiqo ───
UBIQO_API_TOKEN=your-ubiqo-api-token
UBIQO_QSR_CUSTOM_RULES="Reglas personalizadas..."

# ─── Configuración de Colas (Redis) ───
REDIS_URL=redis://127.0.0.1:6379

# ─── Configuración del Dashboard Bull Board ───
WORKER_PORT=3005
WORKER_ADMIN_USER=admin
WORKER_ADMIN_PASS=bbm-secret-pass-2026

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

* **Usuario por defecto:** `admin` (configurable en `WORKER_ADMIN_USER`).
* **Contraseña por defecto:** `bbm-secret-pass-2026` (configurable en `WORKER_ADMIN_PASS`).

Desde este panel podrás:
- Ver jobs procesados con éxito, fallidos o pendientes.
- Inspeccionar payloads y logs de error detallados.
- Reintentar trabajos fallidos de manera manual con un simple clic.
