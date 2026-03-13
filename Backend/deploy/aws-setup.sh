#!/bin/bash

# SchemeSync AWS EC2 Deployment Script
# This script sets up SchemeSync on AWS EC2 Free Tier

set -e

echo "🚀 Starting SchemeSync AWS EC2 Setup..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install nginx for reverse proxy
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Install git
echo "📦 Installing Git..."
sudo apt install -y git

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/schemesync
sudo chown $USER:$USER /opt/schemesync

# Clone or copy application (assuming code is already on server)
cd /opt/schemesync

# Install dependencies
echo "📦 Installing application dependencies..."
npm install --production

# Create data directory for SQLite
echo "📁 Creating data directory..."
mkdir -p data
chmod 755 data

# Setup environment file
echo "⚙️ Setting up environment configuration..."
cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database
DB_PATH=/opt/schemesync/data/schemesync.db

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Crawler Configuration
CRAWLER_ENABLED=true
CRAWLER_INTERVAL_HOURS=6
MAX_CONCURRENT_CRAWLERS=1

# Memory Optimization for Free Tier
NODE_OPTIONS="--max-old-space-size=512"

# AWS Configuration
AWS_REGION=us-east-1
EOF

# Setup database
echo "🗄️ Setting up database..."
npm run setup-db

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
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
    error_file: '/opt/schemesync/logs/err.log',
    out_file: '/opt/schemesync/logs/out.log',
    log_file: '/opt/schemesync/logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    restart_delay: 4000
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Setup Nginx configuration
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/schemesync << EOF
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files (if any)
    location /static/ {
        alias /opt/schemesync/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/schemesync /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Setup firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/schemesync << EOF
/opt/schemesync/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Setup systemd service for PM2
echo "⚙️ Setting up systemd service..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Start the application
echo "🚀 Starting SchemeSync application..."
pm2 start ecosystem.config.js
pm2 save

# Start nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# Setup cron job for database backup
echo "💾 Setting up database backup..."
(crontab -l 2>/dev/null; echo "0 2 * * * cp /opt/schemesync/data/schemesync.db /opt/schemesync/data/backup-\$(date +\%Y\%m\%d).db && find /opt/schemesync/data/backup-*.db -mtime +7 -delete") | crontab -

# Run initial crawl
echo "🕷️ Running initial scheme crawl..."
cd /opt/schemesync
npm run crawl

echo "✅ SchemeSync deployment completed successfully!"
echo ""
echo "🌐 Your API is now running at: http://$(curl -s ifconfig.me)"
echo "📊 Health check: http://$(curl -s ifconfig.me)/health"
echo ""
echo "📋 Management Commands:"
echo "  pm2 status                 - Check application status"
echo "  pm2 logs schemesync-api   - View application logs"
echo "  pm2 restart schemesync-api - Restart application"
echo "  sudo systemctl status nginx - Check nginx status"
echo ""
echo "🔧 Configuration files:"
echo "  Application: /opt/schemesync"
echo "  Nginx: /etc/nginx/sites-available/schemesync"
echo "  PM2: /opt/schemesync/ecosystem.config.js"
echo "  Environment: /opt/schemesync/.env"
echo ""
echo "📚 Next steps:"
echo "1. Update DNS to point to this server's IP"
echo "2. Setup SSL certificate (Let's Encrypt recommended)"
echo "3. Configure monitoring and alerts"
echo "4. Test all API endpoints"
echo ""
echo "🎉 SchemeSync is ready to help citizens discover government schemes!"