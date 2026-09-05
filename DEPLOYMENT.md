# 🚀 Deployment Guide

Complete guide for deploying Society Function Management System to production.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Deployment](#local-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Security Configuration](#security-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

### Security
- [ ] Change JWT_SECRET to a strong random value
- [ ] Set NODE_ENV to 'production'
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure CORS for your domain
- [ ] Set strong database password
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Set up backup strategy
- [ ] Review all user permissions
- [ ] Enable audit logging

### Performance
- [ ] Enable gzip compression
- [ ] Configure caching headers
- [ ] Enable CDN for static files
- [ ] Optimize database queries
- [ ] Set up connection pooling
- [ ] Configure load balancing
- [ ] Set resource limits
- [ ] Monitor memory usage
- [ ] Plan scaling strategy

### Data
- [ ] Backup existing database
- [ ] Plan data migration
- [ ] Test restore procedures
- [ ] Document data schema
- [ ] Set retention policies
- [ ] Configure log rotation

## Local Deployment

### 1. Production Setup

```bash
# Clone/navigate to project
cd /path/to/society-management

# Install dependencies
npm install

# Create production environment file
cp .env.example .env
# Edit .env with production values
nano .env
```

### 2. Environment Configuration

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-very-strong-random-secret-key-here
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
BCRYPT_ROUNDS=12
```

### 3. Start Application

```bash
# Using npm
npm start

# Or using PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "society-management" --instances max
pm2 startup
pm2 save
```

### 4. Verify Deployment

```bash
# Check if server is running
curl http://localhost:5000/api/society

# Monitor with PM2
pm2 monit
```

## Docker Deployment

### Prerequisites
- Docker (19.03+)
- Docker Compose (1.25+)

### 1. Build Docker Image

```bash
# Build the image
docker build -t society-management:latest .

# Or use docker-compose
docker-compose build
```

### 2. Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f society-management

# Stop services
docker-compose down
```

### 3. Docker Compose Environment

Create `.env` file in project root:

```env
JWT_SECRET=your-production-secret
NODE_ENV=production
PORT=5000
```

### 4. Volumes and Persistence

```bash
# Create volumes for persistence
docker volume create society-uploads
docker volume create society-database

# Check volumes
docker volume ls
```

## Cloud Deployment

### AWS Deployment

#### Option 1: EC2 + RDS

```bash
# 1. Launch EC2 instance (Ubuntu 20.04 LTS)
# 2. SSH into instance
ssh -i key.pem ubuntu@your-instance-ip

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone repository
git clone https://github.com/yourusername/society-management.git
cd society-management

# 5. Install dependencies
npm install

# 6. Install PM2
sudo npm install -g pm2

# 7. Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'society-management',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# 8. Start application
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

#### Option 2: AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli --upgrade --user

# Initialize Elastic Beanstalk
eb init -p node.js-18 society-management

# Create .ebextensions/nodejs.config
mkdir -p .ebextensions

cat > .ebextensions/nodejs.config << 'EOF'
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeVersion: 18.x
  aws:autoscaling:launchconfiguration:
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
EOF

# Deploy
eb create society-management-env
eb deploy
```

### Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Procfile
echo "web: node server.js" > Procfile

# Create app
heroku create society-management

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### DigitalOcean Deployment

```bash
# 1. Create Droplet (Ubuntu 20.04)
# 2. SSH into droplet
ssh root@your-droplet-ip

# 3. Update system
apt update && apt upgrade -y

# 4. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# 5. Install Nginx
apt-get install -y nginx

# 6. Clone and setup application
cd /var/www
git clone https://github.com/yourusername/society-management.git
cd society-management
npm install --production

# 7. Configure Nginx
cat > /etc/nginx/sites-available/society-management << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 8. Enable site
ln -s /etc/nginx/sites-available/society-management /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 9. Install PM2 and start app
npm install -g pm2
pm2 start server.js --name society-management
pm2 startup
pm2 save
```

## Security Configuration

### SSL/TLS Setup with Let's Encrypt

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Configure auto-renewal
certbot renew --dry-run
```

### Nginx with SSL

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Database Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily database backup

BACKUP_DIR="/var/backups/society-db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="/path/to/society.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp $DB_FILE $BACKUP_DIR/society_$TIMESTAMP.db
gzip $BACKUP_DIR/society_$TIMESTAMP.db

# Keep only last 30 days
find $BACKUP_DIR -name "society_*.db.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/society_$TIMESTAMP.db.gz s3://your-bucket/backups/
```

### Automated Backup with Cron

```bash
# Add to crontab
crontab -e

# Backup daily at 2 AM
0 2 * * * /path/to/backup.sh

# Verify backup schedule
crontab -l
```

## Monitoring & Maintenance

### Health Checks

```bash
#!/bin/bash
# health-check.sh

HEALTH_ENDPOINT="http://localhost:5000/api/society"
RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ $RESPONSE_CODE -eq 200 ]; then
    echo "Application is healthy"
else
    echo "Application is unhealthy (Status: $RESPONSE_CODE)"
    # Restart application
    pm2 restart society-management
fi
```

### Logging Setup

```javascript
// Add to server.js for enhanced logging
const fs = require('fs');
const path = require('path');

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const log = `${timestamp} ${req.method} ${req.path} ${res.statusCode}\n`;
    fs.appendFile(path.join(logDir, 'app.log'), log, (err) => {
        if (err) console.error(err);
    });
    next();
});
```

### Monitoring Tools

Install monitoring tools:

```bash
# PM2 Plus (Recommended)
pm2 install pm2-auto-pull
pm2 install pm2-logrotate

# Or use New Relic
npm install newrelic --save

# Or use DataDog
npm install dd-trace
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs society-management

# Check port availability
lsof -i :5000

# Kill process on port
kill -9 $(lsof -t -i:5000)
```

### Database Connection Issues

```bash
# Check database file
ls -la society.db

# Reset database
rm society.db
pm2 restart society-management
```

### High Memory Usage

```bash
# Monitor memory
pm2 monit

# Increase max memory
pm2 restart society-management --max-memory-restart 1G
```

### SSL Certificate Issues

```bash
# Check certificate
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout

# Renew certificate
certbot renew --force-renewal

# Test renewal
certbot renew --dry-run
```

## Production Checklist

- [ ] Database backed up
- [ ] SSL certificate installed
- [ ] CORS configured for your domain
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backups automated
- [ ] Health checks configured
- [ ] Firewall rules set
- [ ] Load balancer configured
- [ ] CDN enabled for static files
- [ ] Error pages customized
- [ ] Documentation updated
- [ ] Support contacts listed
- [ ] Disaster recovery plan ready

## Rollback Procedure

```bash
# If deployment fails, rollback
git log --oneline
git revert <commit-hash>

# Or restore from backup
pm2 stop society-management
cp /backups/society.db ./society.db
pm2 start society-management
```

---

**For production support and updates, maintain regular backups and monitoring.**
