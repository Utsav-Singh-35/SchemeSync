module.exports = {
  apps: [{
    name: 'schemesync-api',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Performance
    max_memory_restart: '500M',
    restart_delay: 4000,
    
    // Monitoring
    min_uptime: '10s',
    max_restarts: 10,
    
    // Auto restart on file changes (disable in production)
    watch: false,
    
    // Environment variables
    env_file: '.env'
  }]
};