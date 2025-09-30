# Task 06: Deploy to Cloud (Production)

**Difficulty:** Intermediate-Advanced
**Estimated Time:** 4-6 hours
**Prerequisites:** Task 05 completed, cloud provider account

## Goal

Deploy the Claude Orchestrator system to a cloud platform for production use. This task covers multiple deployment options.

## Learning Objectives

By completing this task, you will learn:
- How to deploy NestJS applications to cloud platforms
- How to set up managed Redis and PostgreSQL
- How to configure environment variables for production
- How to set up Docker containers in production
- How to implement basic security measures

## Deployment Options

Choose one of the following deployment strategies based on your needs and budget:

1. **Option A:** DigitalOcean (Simplest, $10-20/month)
2. **Option B:** AWS (Most flexible, $5-15/month with free tier)
3. **Option C:** fly.io (Modern, $0-10/month)
4. **Option D:** Self-hosted VPS (Full control)

## Option A: DigitalOcean Deployment

### Step 1: Set Up DigitalOcean Account

```bash
# Install doctl (DigitalOcean CLI)
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init
```

### Step 2: Create Managed Redis

```bash
# Create Redis cluster
doctl databases create claude-redis \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Get connection details
doctl databases connection claude-redis

# Note the connection string:
# redis://default:password@host:port
```

### Step 3: Create Managed PostgreSQL

```bash
# Create PostgreSQL cluster
doctl databases create claude-postgres \
  --engine pg \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Create database
doctl databases db create <database-id> orchestrator

# Get connection details
doctl databases connection <database-id>
```

### Step 4: Create Droplet for Orchestrator

```bash
# Create droplet
doctl compute droplet create claude-orchestrator \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region nyc3 \
  --ssh-keys <your-ssh-key-id>

# Get droplet IP
doctl compute droplet list
```

### Step 5: Configure Droplet

```bash
# SSH into droplet
ssh root@<droplet-ip>

# Install Docker Compose
apt update
apt install -y docker-compose

# Clone repository
git clone https://github.com/your-username/claude-orchestrator.git
cd claude-orchestrator

# Create .env file
cat > .env << 'EOF'
# Production configuration
NODE_ENV=production

# Redis (from managed Redis)
REDIS_HOST=your-redis-host
REDIS_PORT=25061
REDIS_PASSWORD=your-redis-password

# Database (from managed PostgreSQL)
DB_TYPE=postgres
DB_HOST=your-postgres-host
DB_PORT=25060
DB_USERNAME=doadmin
DB_PASSWORD=your-postgres-password
DB_DATABASE=orchestrator

# Orchestrator
PORT=3000

# Queue
QUEUE_NAME=claude-tasks
MAX_CONCURRENT_JOBS=5

# API Security (generate strong key)
API_KEY=$(openssl rand -hex 32)

# Logging
LOG_LEVEL=info
EOF

# Build and start services
docker-compose --profile production up -d --build

# Check status
docker-compose ps
docker-compose logs -f orchestrator
```

### Step 6: Set Up Nginx Reverse Proxy

```bash
# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/claude-orchestrator << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/claude-orchestrator /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Set up SSL with Let's Encrypt
certbot --nginx -d your-domain.com
```

### Step 7: Deploy Worker (Separate Droplet)

```bash
# Create worker droplet
doctl compute droplet create claude-worker-1 \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region nyc3 \
  --ssh-keys <your-ssh-key-id>

# SSH into worker droplet
ssh root@<worker-droplet-ip>

# Clone and configure
git clone https://github.com/your-username/claude-orchestrator.git
cd claude-orchestrator

# Create .env
cat > .env << 'EOF'
# Worker configuration
WORKER_ID=cloud-worker-1
WORKER_TYPE=cloud

# Redis (same as orchestrator)
REDIS_HOST=your-redis-host
REDIS_PORT=25061
REDIS_PASSWORD=your-redis-password

# Queue
QUEUE_NAME=claude-tasks
POLL_INTERVAL=5
HEARTBEAT_INTERVAL=10

# Logging
LOG_LEVEL=info
EOF

# Build and start worker
cd apps/worker
docker build -t claude-worker .
docker run -d --name worker --env-file ../../.env claude-worker

# Check logs
docker logs -f worker
```

## Option B: AWS Deployment

### Step 1: Set Up AWS Resources

```bash
# Install AWS CLI
pip install awscli

# Configure AWS
aws configure

# Create security group
aws ec2 create-security-group \
  --group-name claude-orchestrator \
  --description "Security group for Claude Orchestrator"

# Open ports
aws ec2 authorize-security-group-ingress \
  --group-name claude-orchestrator \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name claude-orchestrator \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name claude-orchestrator \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0
```

### Step 2: Create ElastiCache Redis

```bash
# Create Redis cache
aws elasticache create-cache-cluster \
  --cache-cluster-id claude-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1

# Get endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id claude-redis \
  --show-cache-node-info
```

### Step 3: Create RDS PostgreSQL

```bash
# Create database
aws rds create-db-instance \
  --db-instance-identifier claude-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password <your-secure-password> \
  --allocated-storage 20

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier claude-postgres
```

### Step 4: Launch EC2 Instance

```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name claude-key \
  --query 'KeyMaterial' \
  --output text > claude-key.pem

chmod 400 claude-key.pem

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name claude-key \
  --security-groups claude-orchestrator \
  --user-data file://setup-script.sh

# Get instance IP
aws ec2 describe-instances \
  --filters "Name=key-name,Values=claude-key" \
  --query 'Reservations[0].Instances[0].PublicIpAddress'
```

### Step 5: Deploy Using ECS (Alternative)

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name claude-orchestrator

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster claude-orchestrator \
  --service-name orchestrator \
  --task-definition orchestrator:1 \
  --desired-count 1
```

Create `task-definition.json`:
```json
{
  "family": "orchestrator",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "orchestrator",
      "image": "your-ecr-repo/orchestrator:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "REDIS_HOST",
          "value": "your-redis-endpoint"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/orchestrator",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Option C: fly.io Deployment

### Step 1: Install flyctl

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login
```

### Step 2: Deploy Orchestrator

```bash
cd apps/orchestrator

# Create fly.toml
cat > fly.toml << 'EOF'
app = "claude-orchestrator"
primary_region = "ewr"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
EOF

# Deploy
flyctl launch

# Set secrets
flyctl secrets set \
  REDIS_PASSWORD=your-password \
  DB_PASSWORD=your-db-password \
  API_KEY=your-api-key

# Check status
flyctl status
flyctl logs
```

### Step 3: Create Redis on fly.io

```bash
# Create Redis instance
flyctl redis create

# Connect to Redis
flyctl redis connect

# Get connection string
flyctl redis status claude-redis
```

### Step 4: Deploy Worker

```bash
cd apps/worker

# Create fly.toml for worker
cat > fly.toml << 'EOF'
app = "claude-worker"
primary_region = "ewr"

[build]
  dockerfile = "Dockerfile"

[env]
  WORKER_TYPE = "cloud"

# No HTTP services needed for worker
EOF

# Deploy
flyctl launch

# Set secrets
flyctl secrets set \
  REDIS_PASSWORD=your-password \
  WORKER_ID=cloud-worker-1

# Scale workers
flyctl scale count 3
```

## Option D: Self-Hosted VPS

### Step 1: Provision VPS

Choose any VPS provider (Hetzner, Linode, Vultr, etc.) and create a Ubuntu 22.04 server.

### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install -y docker-compose

# Install Node.js (for local worker)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Create non-root user
adduser claude
usermod -aG sudo claude
usermod -aG docker claude

# Switch to new user
su - claude
```

### Step 3: Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-username/claude-orchestrator.git
cd claude-orchestrator

# Create production .env
nano .env
# Configure all environment variables

# Build and start
docker-compose --profile production up -d --build

# Check status
docker-compose ps
docker-compose logs
```

## Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Generate strong API keys
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (UFW or cloud firewall)
- [ ] Set up SSH key authentication (disable password auth)
- [ ] Enable Redis authentication
- [ ] Use database SSL connections
- [ ] Set up VPN for worker connections (optional)

### Monitoring
- [ ] Set up log aggregation (Papertrail, Loggly)
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Create alerting rules
- [ ] Monitor Redis and database metrics

### Backup
- [ ] Enable automated database backups
- [ ] Set up Redis persistence (RDB or AOF)
- [ ] Document recovery procedures
- [ ] Test backup restoration

### Performance
- [ ] Configure connection pooling
- [ ] Enable Redis caching where appropriate
- [ ] Set up CDN for dashboard (Cloudflare)
- [ ] Optimize database indexes
- [ ] Configure rate limiting

### Scaling
- [ ] Document how to add more workers
- [ ] Plan for horizontal orchestrator scaling
- [ ] Consider Redis cluster for HA
- [ ] Set up database read replicas (if needed)

## Environment Variables for Production

```bash
# .env.production
NODE_ENV=production

# Redis
REDIS_HOST=your-production-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# Database
DB_TYPE=postgres
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USERNAME=orchestrator
DB_PASSWORD=<strong-password>
DB_DATABASE=orchestrator

# Orchestrator
PORT=3000

# API Security
API_KEY=<generated-with-openssl-rand-hex-32>

# Queue
QUEUE_NAME=claude-tasks
MAX_CONCURRENT_JOBS=5

# Logging
LOG_LEVEL=info

# Optional: Monitoring
SENTRY_DSN=your-sentry-dsn
```

## Cost Estimates

### DigitalOcean
- Managed Redis (1GB): $15/month
- Managed PostgreSQL (1GB): $15/month
- Orchestrator Droplet (2GB): $12/month
- Worker Droplet (1GB): $6/month
- **Total: ~$48/month**

### AWS (with free tier)
- ElastiCache t3.micro: $13/month
- RDS t3.micro: $16/month
- EC2 t3.small: $17/month
- **Total: ~$46/month** (first year with free tier credits)

### fly.io
- Orchestrator (shared-cpu-1x): $2/month
- Redis: $2/month
- Workers (3x shared-cpu-1x): $6/month
- **Total: ~$10/month**

### Self-Hosted VPS
- VPS (4GB RAM): $10-20/month
- Domain: $12/year
- **Total: ~$11-21/month**

## Monitoring and Maintenance

### Set Up Health Checks

```bash
# Create health check script
cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash

# Check orchestrator
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ Orchestrator is healthy"
else
  echo "❌ Orchestrator is down"
  docker-compose restart orchestrator
fi

# Check Redis
if redis-cli -h localhost -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
  echo "✅ Redis is healthy"
else
  echo "❌ Redis is down"
fi

# Check workers
worker_count=$(redis-cli -a $REDIS_PASSWORD KEYS "worker:*:heartbeat" | wc -l)
echo "Active workers: $worker_count"

if [ $worker_count -eq 0 ]; then
  echo "⚠️  No active workers!"
fi
EOF

chmod +x /usr/local/bin/health-check.sh

# Add to crontab (every 5 minutes)
crontab -e
# Add line:
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/health-check.log 2>&1
```

### Log Rotation

```bash
cat > /etc/logrotate.d/claude-orchestrator << 'EOF'
/var/log/claude-orchestrator/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 claude claude
    sharedscripts
    postrotate
        docker-compose restart orchestrator
    endscript
}
EOF
```

## Troubleshooting Production Issues

### Check Service Status
```bash
# Docker containers
docker-compose ps

# System resources
htop
df -h

# Network connections
netstat -tlnp

# Application logs
docker-compose logs -f --tail=100 orchestrator
```

### Common Issues

**Issue: High memory usage**
```bash
# Check container memory
docker stats

# Adjust memory limits in docker-compose.yml
```

**Issue: Database connections exhausted**
```bash
# Check active connections
# PostgreSQL
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Increase connection pool size in config
```

**Issue: Workers not connecting**
```bash
# Check Redis connectivity
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Check firewall rules
ufw status

# Check worker logs
docker logs worker
```

## Next Steps

Proceed to **Task 07: Testing and Documentation**

Your system is now running in production! 🚀