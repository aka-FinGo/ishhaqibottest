// ============================================================
// ecosystem.config.js — PM2 Production Configuration
// Usage: pm2 start ecosystem.config.js
//        pm2 reload ecosystem.config.js --update-env
// SERVER_GUIDELINES: 1 vCPU, 2GB RAM
// ============================================================

module.exports = {
  apps: [{
    name: 'ishhaqibottest',
    script: 'server/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '150M',  // SERVER_GUIDELINES: 1 vCPU, 2GB RAM limit
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
