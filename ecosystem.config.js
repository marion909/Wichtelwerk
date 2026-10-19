// PM2: Web (Cluster, 2 Instanzen) + Worker (genau 1 Instanz, damit kein Job doppelt läuft)
module.exports = {
  apps: [
    {
      name: 'wichtel-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4000',
      exec_mode: 'cluster',
      instances: 2,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M'
    },
    {
      name: 'wichtel-worker',
      script: 'dist/worker.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M'
    }
  ]
};
