module.exports = {
  apps: [
    {
      name: 'bbm-worker',
      // ADVERTENCIA FRAGILIDAD: La ruta de 'script' depende directamente del 'rootDir' configurado en tsconfig.json.
      // Dado que 'rootDir' es '../../../' (raíz del repositorio), la estructura se preserva en 'dist',
      // generando 'dist/infra/vps/worker/src/worker.js'. Si cambias 'rootDir' en tsconfig.json,
      // esta ruta cambiará y romperá PM2.
      script: 'dist/infra/vps/worker/src/worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
