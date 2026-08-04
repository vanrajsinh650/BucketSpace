# Infrastructure, Infrastructure as Code & Deployment (25_DEPLOYMENT.md)

## 1. Executive Summary & Infrastructure Strategy
**BucketSpace** infrastructure is managed entirely via **Terraform** (Infrastructure as Code) and containerized via multi-stage **Dockerfiles**. Next.js frontend builds deploy to Vercel/Edge CDN, while Fastify API Gateway and BullMQ background workers run on AWS ECS (Fargate) or Kubernetes (EKS).

---

## 2. Infrastructure Architecture & Container Topology

```mermaid
graph TD
    subgraph Edge CDN & Static Hosting Tier
        Vercel[Vercel Edge Network: Next.js 15 Web Workspace]
    end

    subgraph Containerized Microservices Tier (AWS ECS / Fargate)
        ALB[AWS Application Load Balancer] --> GatewayContainers[Fastify API Gateway Tasks (Min: 2, Max: 20)]
        GatewayContainers --> RedisCache[AWS ElastiCache Redis 7]
        WorkerContainers[BullMQ AI & Sync Worker Tasks] --> RedisCache
    end

    subgraph Cloud Persistence Tier
        GatewayContainers --> RDS[(AWS RDS PostgreSQL 16 + pgvector)]
        WorkerContainers --> RDS
        WorkerContainers -.-> CloudBuckets[External Buckets: S3 / Cloudflare R2]
    end

    Vercel -->|REST / WSS API Requests| ALB
```

---

## 3. Production Dockerfile Specifications (`apps/api/Dockerfile`)

```dockerfile
# Multi-Stage Build for Fastify API Gateway
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 1: Build Dependencies
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

COPY apps/api/ ./apps/api/
RUN pnpm --filter @bucketspace/api build

# Stage 2: Minimal Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/server.js"]
```

---

## 4. Terraform IaC Architecture Specs (`infra/main.tf`)

```hcl
# Primary Infrastructure Blueprint Baseline
module "rds_pgvector" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier           = "bucketspace-db-prod"
  engine               = "postgres"
  engine_version       = "16.2"
  family               = "postgres16"
  instance_class       = "db.r6g.xlarge"
  allocated_storage    = 200
  max_allocated_storage = 2000

  db_name  = "bucketspace"
  username = "bucketspace_admin"

  # Parameter group configuration for pgvector memory allocation
  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "vector"
    },
    {
      name  = "work_mem"
      value = "64MB"
    }
  ]
}
```

---

## 5. Cross-References
- DevOps Pipelines: [26_DEVOPS.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/26_DEVOPS.md)
- Observability Infrastructure: [23_OBSERVABILITY.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/23_OBSERVABILITY.md)
- System Architecture Topology: [04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/04_SYSTEM_ARCHITECTURE.md)
