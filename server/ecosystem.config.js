// AKS TIZIM — pm2 sozlamasi (ilova serveri). deploy.sh: pm2 startOrReload ecosystem.config.js
module.exports = {
  apps: [{
    name: 'aks-api',
    script: 'api/index.js',
    cwd: '/opt/aks/app',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '400M',
    kill_timeout: 5000,
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
