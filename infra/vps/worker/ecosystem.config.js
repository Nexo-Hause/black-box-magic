module.exports = {
  apps: [
    {
      name: 'bbm-worker',
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
