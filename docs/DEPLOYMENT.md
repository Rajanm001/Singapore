# Deployment Guide

> Production deployment for the Knowledge & Workflow Engine

Deploy the platform to production using Docker, configure environment variables, and set up monitoring.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Production Considerations](#production-considerations)
5. [Scaling Strategies](#scaling-strategies)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum Production Specifications:**
- **CPU**: 2 cores (4+ recommended)
- **RAM**: 4 GB (8+ GB recommended)
- **Storage**: 20 GB SSD (for application, logs, and database)
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)

**Software Requirements:**
- **Docker**: 20.10+ ([Install Docker](https://docs.docker.com/engine/install/))
- **Docker Compose**: 2.0+ ([Install Compose](https://docs.docker.com/compose/install/))
- **Node.js**: 18.0+ (for local development)
- **PostgreSQL**: 15+ (managed or self-hosted)
- **Redis**: 7+ (managed or self-hosted)

### Network Requirements

**Required Ports:**
- `3000`: Workflow Engine API (HTTP)
- `5432`: PostgreSQL (internal or external)
- `6379`: Redis (internal or external)

**Firewall Configuration:**
```bash
# Allow HTTP traffic
sudo ufw allow 3000/tcp

# Allow PostgreSQL (if external)
sudo ufw allow 5432/tcp

# Allow Redis (if external)
sudo ufw allow 6379/tcp
```

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file:

```env
#############################################
# Application Configuration
#############################################

# Environment
NODE_ENV=production

# Server
PORT=3000
HOST=0.0.0.0

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

#############################################
# Database Configuration
#############################################

# PostgreSQL Connection
DATABASE_URL=postgresql://workflow_user:STRONG_PASSWORD@postgres:5432/workflow_engine
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

#############################################
# Cache Configuration
#############################################

# Redis Connection
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD
REDIS_TLS=true

#############################################
# AI Services Configuration
#############################################

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Anthropic Claude (alternative)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Vector Database (Pinecone example)
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX=knowledge-engine

# Embedding Service
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIMENSIONS=1536

#############################################
# Security Configuration
#############################################

# API Authentication
JWT_SECRET=GENERATE_RANDOM_SECRET_HERE
JWT_EXPIRY=24h

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

#############################################
# Workflow Engine Configuration
#############################################

# Execution Limits
MAX_WORKFLOW_DURATION_MS=300000
MAX_CONCURRENT_EXECUTIONS=50
MAX_RETRY_ATTEMPTS=3

# Resource Limits
MAX_MEMORY_MB=512
MAX_CPU_PERCENT=80

#############################################
# Monitoring & Observability
#############################################

# Application Performance Monitoring
APM_ENABLED=true
APM_SERVICE_NAME=knowledge-workflow-engine
APM_SERVER_URL=https://apm.yourdomain.com

# Error Tracking (Sentry example)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Metrics (Prometheus)
METRICS_ENABLED=true
METRICS_PORT=9090
```

### Generating Secure Secrets

```powershell
# Generate JWT secret (PowerShell)
$secret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "JWT_SECRET=$secret"

# Generate PostgreSQL password
$dbPassword = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
Write-Host "DATABASE_PASSWORD=$dbPassword"
```

### Environment Variable Validation

The application validates required environment variables on startup:

```typescript
// Fails fast if critical variables are missing
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'OPENAI_API_KEY',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

---

## Docker Deployment

### Building Production Image

```powershell
# Clone repository
git clone https://github.com/yourorg/knowledge-workflow-engine.git
cd knowledge-workflow-engine

# Build production image
docker build -t knowledge-workflow-engine:latest .

# Tag for registry
docker tag knowledge-workflow-engine:latest yourregistry.com/knowledge-workflow-engine:1.0.0
docker tag knowledge-workflow-engine:latest yourregistry.com/knowledge-workflow-engine:latest

# Push to registry
docker push yourregistry.com/knowledge-workflow-engine:1.0.0
docker push yourregistry.com/knowledge-workflow-engine:latest
```

### Docker Compose Deployment

**1. Create production docker-compose file:**

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  workflow-engine:
    image: yourregistry.com/knowledge-workflow-engine:1.0.0
    container_name: workflow-engine
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    networks:
      - workflow-network
    volumes:
      - workflow-logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    container_name: workflow-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: workflow_engine
      POSTGRES_USER: workflow_user
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - workflow-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U workflow_user -d workflow_engine"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: workflow-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - workflow-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Optional: Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: workflow-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - workflow-engine
    networks:
      - workflow-network

networks:
  workflow-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  workflow-logs:
```

**2. Start production services:**

```powershell
# Create .env.production file first (see Environment Configuration)

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f workflow-engine

# Stop services
docker-compose -f docker-compose.production.yml down
```

### Kubernetes Deployment (Advanced)

**Deployment manifest example:**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-engine
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: workflow-engine
  template:
    metadata:
      labels:
        app: workflow-engine
    spec:
      containers:
      - name: workflow-engine
        image: yourregistry.com/knowledge-workflow-engine:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: workflow-secrets
        - configMapRef:
            name: workflow-config
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## Production Considerations

### Database Setup

**1. Initialize PostgreSQL schema:**

```sql
-- init-db.sql
CREATE DATABASE workflow_engine;

\c workflow_engine;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create tables
CREATE TABLE organizations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflows (
  id VARCHAR(255) PRIMARY KEY,
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(id, version)
);

CREATE TABLE workflow_executions (
  id VARCHAR(255) PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  input_payload JSONB,
  output_payload JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workflows_org ON workflows(organization_id);
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_created ON workflow_executions(created_at DESC);
```

**2. Run migrations:**

```powershell
# Connect to database
$env:DATABASE_URL = "postgresql://workflow_user:password@localhost:5432/workflow_engine"

# Run initialization script
docker exec -i workflow-postgres psql -U workflow_user -d workflow_engine < init-db.sql
```

### Backup Strategy

**Automated PostgreSQL backups:**

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/workflow-engine"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/workflow_engine_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
docker exec workflow-postgres pg_dump -U workflow_user workflow_engine | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

**Schedule with cron:**

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/workflow-backup.log 2>&1
```

---

## Scaling Strategies

### Horizontal Scaling

**Docker Compose scaling:**

```powershell
# Scale to 3 workflow engine instances
docker-compose -f docker-compose.production.yml up -d --scale workflow-engine=3

# Add load balancer (Nginx) configuration
```

**Load balancer configuration (Nginx):**

```nginx
# nginx.conf
upstream workflow_backend {
    least_conn;
    server workflow-engine-1:3000;
    server workflow-engine-2:3000;
    server workflow-engine-3:3000;
}

server {
    listen 80;
    server_name workflow.yourdomain.com;

    location / {
        proxy_pass http://workflow_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Vertical Scaling

**Increase container resources:**

```yaml
# docker-compose.production.yml
services:
  workflow-engine:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Database Scaling

**PostgreSQL read replicas:**

```yaml
services:
  postgres-replica:
    image: postgres:15-alpine
    environment:
      POSTGRES_PRIMARY_HOST: postgres
      POSTGRES_REPLICATION_MODE: replica
    volumes:
      - postgres-replica-data:/var/lib/postgresql/data
```

---

## Monitoring & Observability

### Health Checks

**Application health endpoint:**

```typescript
// healthcheck.js
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});
req.end();
```

### Prometheus Metrics

**Expose metrics endpoint:**

```typescript
// metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const workflowExecutionCounter = new Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['status', 'workflow_id']
});

export const workflowDurationHistogram = new Histogram({
  name: 'workflow_duration_seconds',
  help: 'Workflow execution duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Logging Best Practices

**Structured JSON logging for production:**

```typescript
logger.info('Workflow execution started', {
  workflowId: 'refund_policy_v1',
  organizationId: 'org_123',
  executionId: 'exec_456',
  correlationId: 'req_789',
  timestamp: new Date().toISOString()
});
```

**Log aggregation with ELK Stack:**

```yaml
# docker-compose.monitoring.yml
services:
  elasticsearch:
    image: elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: logstash:8.10.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.10.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

---

## Security

### HTTPS/TLS Configuration

**Generate SSL certificates (Let's Encrypt):**

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d workflow.yourdomain.com

# Auto-renewal (added to cron)
sudo certbot renew --dry-run
```

### Environment Secret Management

**Use Docker secrets:**

```yaml
# docker-compose.production.yml
services:
  workflow-engine:
    secrets:
      - jwt_secret
      - openai_api_key

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  openai_api_key:
    file: ./secrets/openai_api_key.txt
```

**Use external secret management (AWS Secrets Manager, HashiCorp Vault):**

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const secret = await client.send(
  new GetSecretValueCommand({ SecretId: "workflow-engine/production" })
);

const secrets = JSON.parse(secret.SecretString);
process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
```

### Network Security

**Docker network isolation:**

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access

services:
  nginx:
    networks:
      - frontend
  
  workflow-engine:
    networks:
      - frontend
      - backend
  
  postgres:
    networks:
      - backend  # Only accessible from backend network
```

---

## Troubleshooting

### Common Issues

**1. Container fails to start:**

```powershell
# Check container logs
docker logs workflow-engine

# Check for port conflicts
netstat -ano | findstr :3000

# Verify environment variables
docker exec workflow-engine env
```

**2. Database connection errors:**

```powershell
# Test PostgreSQL connection
docker exec -it workflow-postgres psql -U workflow_user -d workflow_engine

# Check network connectivity
docker network inspect workflow-network

# Verify credentials
cat .env.production | grep DATABASE
```

**3. High memory usage:**

```powershell
# Check container resource usage
docker stats workflow-engine

# Increase memory limit
docker update --memory 2g workflow-engine
```

**4. Workflow execution timeouts:**

```env
# Increase timeout in .env.production
MAX_WORKFLOW_DURATION_MS=600000  # 10 minutes
```

### Debug Mode

```powershell
# Enable debug logging
$env:LOG_LEVEL = "debug"

# Restart container
docker-compose restart workflow-engine

# Follow debug logs
docker-compose logs -f workflow-engine | Select-String "DEBUG"
```

### Performance Profiling

```typescript
// Enable Node.js profiling
node --prof dist/index.js

// Analyze profile
node --prof-process isolate-0x*.log > profile.txt
```

---

## Support

For production support and enterprise features, contact:
- **Email**: support@yourcompany.com
- **Slack**: #workflow-engine-support
- **Docs**: https://docs.yourcompany.com/workflow-engine

---

**Last Updated**: January 2024  
**Version**: 1.0.0
