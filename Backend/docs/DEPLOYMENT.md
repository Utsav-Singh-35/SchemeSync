# SchemeSync Deployment Guide

## AWS EC2 Free Tier Deployment

### Prerequisites

1. **AWS Account** with EC2 access
2. **EC2 Instance** (t2.micro or t3.micro for free tier)
3. **Ubuntu 20.04 LTS** or newer
4. **Domain name** (optional but recommended)

### Quick Deployment

1. **Launch EC2 Instance**
   ```bash
   # Use Ubuntu 20.04 LTS AMI
   # Instance type: t2.micro (free tier eligible)
   # Security group: Allow HTTP (80), HTTPS (443), SSH (22)
   ```

2. **Connect to Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd schemesync/Backend
   ```

4. **Run Deployment Script**
   ```bash
   chmod +x deploy/aws-setup.sh
   ./deploy/aws-setup.sh
   ```

### Manual Deployment Steps

#### 1. System Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

#### 2. Application Setup
```bash
# Create application directory
sudo mkdir -p /opt/schemesync
sudo chown $USER:$USER /opt/schemesync
cd /opt/schemesync

# Copy application files
# (Upload your code here)

# Install dependencies
npm install --production

# Create environment file
cp .env.example .env
# Edit .env with production values

# Setup database
npm run setup-db
```

#### 3. Process Management
```bash
# Copy PM2 configuration
cp deploy/ecosystem.config.js .

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Nginx Configuration
```bash
# Copy nginx configuration
sudo cp deploy/nginx.conf /etc/nginx/sites-available/schemesync

# Enable site
sudo ln -s /etc/nginx/sites-available/schemesync /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Security Setup
```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Setup log rotation
sudo cp deploy/logrotate.conf /etc/logrotate.d/schemesync
```

### SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Environment Configuration

Create `/opt/schemesync/.env`:
```env
NODE_ENV=production
PORT=3000
DB_PATH=/opt/schemesync/data/schemesync.db
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
CRAWLER_ENABLED=true
CRAWLER_INTERVAL_HOURS=6
```

### Monitoring and Maintenance

#### Application Monitoring
```bash
# Check application status
pm2 status

# View logs
pm2 logs schemesync-api

# Restart application
pm2 restart schemesync-api

# Monitor resources
pm2 monit
```

#### System Monitoring
```bash
# Check nginx status
sudo systemctl status nginx

# Check disk usage
df -h

# Check memory usage
free -h

# Check system logs
sudo journalctl -u nginx -f
```

#### Database Backup
```bash
# Manual backup
./scripts/backup.sh

# Setup automated backups (cron)
crontab -e
# Add: 0 2 * * * /opt/schemesync/scripts/backup.sh
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Run these queries periodically
VACUUM;
ANALYZE;
REINDEX;
```

#### 2. Nginx Caching
```nginx
# Add to nginx configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

location /api/schemes/search {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    # ... other settings
}
```

#### 3. PM2 Cluster Mode
```javascript
// Update ecosystem.config.js for multiple instances
module.exports = {
  apps: [{
    name: 'schemesync-api',
    script: 'src/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster'
  }]
};
```

### Troubleshooting

#### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs schemesync-api
   
   # Check environment
   cat /opt/schemesync/.env
   
   # Check database
   ls -la /opt/schemesync/data/
   ```

2. **High memory usage**
   ```bash
   # Restart application
   pm2 restart schemesync-api
   
   # Check for memory leaks
   pm2 monit
   ```

3. **Database locked errors**
   ```bash
   # Check for long-running processes
   ps aux | grep node
   
   # Restart application
   pm2 restart schemesync-api
   ```

4. **Nginx errors**
   ```bash
   # Check nginx logs
   sudo tail -f /var/log/nginx/error.log
   
   # Test configuration
   sudo nginx -t
   ```

### Scaling Considerations

#### Vertical Scaling
- Upgrade to larger EC2 instance (t3.small, t3.medium)
- Increase memory and CPU allocation

#### Horizontal Scaling
- Use Application Load Balancer
- Deploy multiple EC2 instances
- Implement connection pooling for SQLite

#### Database Scaling
- Implement read replicas using SQLite WAL mode
- Optimize FTS5 indexing for larger datasets
- Implement database sharding if needed (while maintaining SQLite)

### Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSH key-based authentication
- [ ] SSL certificate installed
- [ ] Regular security updates
- [ ] Application logs monitored
- [ ] Database backups automated
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Environment variables secured
- [ ] Admin endpoints restricted

### Cost Optimization

#### Free Tier Limits
- EC2: 750 hours/month (t2.micro)
- EBS: 30GB storage
- Data Transfer: 15GB/month

#### Cost Monitoring
```bash
# Monitor disk usage
du -sh /opt/schemesync/
du -sh /var/log/

# Clean old logs
sudo logrotate -f /etc/logrotate.d/schemesync
```

### Backup and Recovery

#### Automated Backups
```bash
# Database backup script
./scripts/backup.sh

# System backup (optional)
sudo rsync -av /opt/schemesync/ /backup/schemesync/
```

#### Recovery Process
```bash
# Restore from backup
./scripts/restore.sh backup_file.db.gz

# Verify restoration
curl http://localhost:3000/health
```

This deployment guide ensures SchemeSync runs efficiently on AWS EC2 Free Tier while maintaining production-ready standards.