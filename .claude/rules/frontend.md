# Frontend — React / Next.js

## Componentes

- Componentes en `src/app/` siguiendo App Router de Next.js.
- Separar lógica de negocio (hooks, lib) de presentación (componentes).
- Marcar componentes client-side con `"use client"` solo cuando sea necesario.

## Estado

- Estado local con `useState`/`useReducer` para UI del demo.
- Hook `useEmailGate` para estado de autenticación del demo gate.
- No instalar state managers externos (Redux, Zustand) sin justificación.

## UI

- Todo texto visible al usuario en **español**.
- Estilos con Tailwind CSS inline (clases de utilidad).
- Responsive design: verificar en móvil y desktop.
- Feedback visual obligatorio: loading states, errores, progreso de batch.

## Accesibilidad

- Labels en formularios (`<label htmlFor>`).
- Alt text en imágenes.
- Contraste suficiente en colores de texto.
- Botones con texto descriptivo (no solo iconos).

## Performance

- Imágenes en base64 pueden ser grandes — considerar compresión client-side antes de upload.
- Batch processing: máximo 2 análisis en paralelo (ya implementado).
- No bloquear el hilo principal con operaciones pesadas.
