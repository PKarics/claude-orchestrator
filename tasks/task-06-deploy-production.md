# AAI-006: Deploy to Production

**Type:** Task
**Priority:** Medium
**Story Points:** 8
**Sprint:** Deployment
**Dependencies:** AAI-005

## Description

Deploy the Claude Orchestrator system to a cloud platform. Set up managed Redis and PostgreSQL, configure production environment, and ensure system is accessible via HTTPS.

## Acceptance Criteria

- [ ] Managed Redis instance created
- [ ] PostgreSQL database created (or keep SQLite)
- [ ] Orchestrator deployed and accessible via HTTPS
- [ ] At least one cloud worker deployed and running
- [ ] Environment variables configured for production
- [ ] Health endpoint returns healthy status
- [ ] SSL certificate configured
- [ ] System handles real traffic

## Technical Specification

### Platform Options

Choose one:
- **DigitalOcean**: Easiest, ~$20/month
- **AWS**: Most flexible, ~$15/month with free tier
- **fly.io**: Modern, ~$10/month

This guide uses DigitalOcean for simplicity.

## Implementation - DigitalOcean

### 1. Create Redis Database

```bash
# Via UI: Databases → Create → Redis
# OR via CLI:
doctl databases create claude-redis \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Get connection string
doctl databases connection claude-redis
# Save: redis://user:password@host:port
```

### 2. Create Droplet

```bash
# Create droplet with Docker
doctl compute droplet create claude-orchestrator \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region nyc3 \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header)

# Get IP address
doctl compute droplet list
# Note the IP address
```

### 3. Configure Server

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Install Docker Compose
apt update
apt install -y docker-compose git

# Clone repository
git clone https://github.com/your-username/claude-orchestrator.git
cd claude-orchestrator
```

### 4. Configure Production Environment

Create `.env` file:
```bash
NODE_ENV=production

# Redis from managed database
REDIS_HOST=your-redis-host
REDIS_PORT=25061
REDIS_PASSWORD=your-redis-password

# Database (SQLite or PostgreSQL)
DB_TYPE=sqlite
DB_DATABASE=/app/data/tasks.db

# Orchestrator
PORT=3000

# Queue
QUEUE_NAME=claude-tasks

# Security - generate new key
API_KEY=$(openssl rand -hex 32)

LOG_LEVEL=info
```

### 5. Build and Start Services

```bash
# Build images
docker-compose build orchestrator

# Start services
docker-compose up -d orchestrator

# Check logs
docker-compose logs -f orchestrator
```

### 6. Configure Nginx Reverse Proxy

```bash
# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/claude << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/claude /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Setup SSL
certbot --nginx -d your-domain.com
```

### 7. Deploy Worker

```bash
# Option A: On same droplet
docker-compose up -d worker

# Option B: Separate worker droplet
doctl compute droplet create claude-worker-1 \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region nyc3

# SSH to worker droplet and configure
```

### 8. Configure Worker Environment

Create worker `.env`:
```bash
WORKER_ID=cloud-worker-1
WORKER_TYPE=cloud

REDIS_HOST=your-redis-host
REDIS_PORT=25061
REDIS_PASSWORD=your-redis-password

QUEUE_NAME=claude-tasks
LOG_LEVEL=info
```

Start worker:
```bash
cd claude-orchestrator/apps/worker
docker build -t worker .
docker run -d --name worker --env-file ../../.env --restart unless-stopped worker
```

## Alternative: fly.io Deployment

### 1. Install flyctl

```bash
brew install flyctl  # macOS
# or
curl -L https://fly.io/install.sh | sh  # Linux

flyctl auth login
```

### 2. Deploy Orchestrator

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
  REDIS_PASSWORD=xxx \
  API_KEY=xxx

# Check status
flyctl status
flyctl logs
```

### 3. Create Redis

```bash
flyctl redis create
# Get connection string
flyctl redis status
```

### 4. Deploy Worker

```bash
cd apps/worker

# Create fly.toml
cat > fly.toml << 'EOF'
app = "claude-worker"
primary_region = "ewr"

[build]
  dockerfile = "Dockerfile"
EOF

flyctl launch
flyctl secrets set REDIS_PASSWORD=xxx WORKER_ID=cloud-1
flyctl scale count 2  # Run 2 workers
```

## Testing Production Deployment

```bash
# Test health
curl https://your-domain.com/health

# Create task
curl -X POST https://your-domain.com/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(\"production test\")","prompt":"test"}'

# Check stats
curl https://your-domain.com/tasks/stats

# Check workers
curl https://your-domain.com/workers
```

## Security Checklist

- [ ] Changed default Redis password
- [ ] Generated strong API key
- [ ] HTTPS/SSL configured
- [ ] Firewall rules configured
- [ ] SSH key authentication only
- [ ] Updated all secrets
- [ ] Regular backups configured

## Monitoring Setup

### Enable Logging

```bash
# Configure log rotation
cat > /etc/logrotate.d/claude << 'EOF'
/var/log/claude/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
EOF
```

### Health Check Cron

```bash
# Add to crontab
*/5 * * * * curl -f https://your-domain.com/health || systemctl restart docker
```

## Subtasks

- [ ] AAI-006-1: Create managed Redis instance
- [ ] AAI-006-2: Create and configure droplet
- [ ] AAI-006-3: Deploy orchestrator with Docker
- [ ] AAI-006-4: Configure Nginx reverse proxy
- [ ] AAI-006-5: Setup SSL certificate
- [ ] AAI-006-6: Deploy worker instance
- [ ] AAI-006-7: Configure monitoring and alerts
- [ ] AAI-006-8: Test production system

## Definition of Done

- System accessible via HTTPS
- Orchestrator responding to requests
- At least one worker processing tasks
- Health check returns healthy
- SSL certificate valid
- All secrets secured
- Monitoring configured