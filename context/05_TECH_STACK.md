# Technology Stack & Selection Justification (05_TECH_STACK.md)

## 1. Executive Summary & Selection Philosophy
Every technology in **BucketSpace** is selected based on performance, developer productivity, type safety, operational simplicity, and AI agent compatibility.

---

## 2. Core Tech Stack Decision Matrix

| Tier | Chosen Technology | Version | Primary Purpose | Key Alternatives Considered & Rejected |
|---|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | `15.x` | React 19 SSR, Server Components, Streaming UI | Vite SPA (no SSR/SEO), Remix (weaker ecosystem). |
| **Styling Engine** | Vanilla CSS + Tailwind | `3.4.x` | Design token utility styling, high-performance UI | Styled Components (runtime CSS overhead). |
| **State Management** | Zustand + TanStack Query | `v5 / v5` | Client stores + Server cache management | Redux Toolkit (verbose boilerplate). |
| **Backend API Gateway** | Fastify + TypeScript | `v4.x / 5.5` | High-throughput HTTP API, schema validation | Express (10x slower throughput, callback patterns). |
| **Primary Database** | PostgreSQL + `pgvector` | `16.x` | Relational metadata + 512/1536-dim vector index | MongoDB (poor relational integrity for RBAC). |
| **Cache & Queue Bus** | Redis | `7.2.x` | Pub/Sub, session cache, BullMQ job queue | RabbitMQ (unnecessary extra ops complexity). |
| **Full-Text Search** | Meilisearch | `1.8.x` | Sub-50ms instant typahead keyword search | Elasticsearch (heavy JVM RAM consumption). |
| **OR / Query Builder** | Prisma ORM | `5.x` | End-to-end TypeScript types, migration engine | TypeORM (fragile migrations), Drizzle (less mature). |
| **AI Inference Engine** | ONNX Runtime / Python | `1.18.x` | In-process CLIP & Whisper model execution | Calling external OpenAI API for every file (expensive). |

---

## 3. Technology Tier Deep Dives & Tradeoff Analysis

### 3.1 Frontend Tier: Next.js 15 App Router & React 19
- **Why Chosen**: Next.js 15 provides React Server Components (RSC) allowing zero-bundle-size server rendering for initial bucket tree rendering, combined with Streaming SSR for fast visual layout paints.
- **Benefits**: Seamless integration with edge middleware for route protection; native support for streaming API routes.
- **Tradeoffs**: Stricter boundary separation required between `'use client'` interactive UI components and Server Components.

### 3.2 Backend Gateway: Fastify + Zod Validation
- **Why Chosen**: Fastify delivers over 45,000 req/sec throughput compared to Express (~10,000 req/sec), leveraging JSON schema compilation via `ajv` and Zod type inference.
- **Benefits**: Native TypeScript integration, plug-in encapsulation model, built-in CORS and Rate-Limiting hooks.

### 3.3 Database Tier: PostgreSQL 16 with `pgvector`

```sql
-- Architectural Schema Baseline for Vector Search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE object_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_objects(id) ON DELETE CASCADE,
    embedding_clip vector(512),      -- Visual CLIP embedding
    embedding_text vector(1536),     -- Document/Whisper text embedding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fast HNSW Index for cosine distance semantic search
CREATE INDEX idx_embeddings_clip_hnsw 
ON object_embeddings USING hnsw (embedding_clip vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

- **Why Chosen**: Eliminates the operational fragmentation of running a separate vector database (e.g., Pinecone/Weaviate) alongside a relational database. PostgreSQL handles metadata constraints, tenant isolation, and vector similarity in a single ACID transaction.

---

## 4. Allowed Dependencies & Lock Rules

To prevent supply-chain vulnerabilities and package bloat, all dependencies MUST comply with the following whitelist rules:

```json
{
  "approvedDependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "fastify": "^4.28.0",
    "zod": "^3.23.0",
    "prisma": "^5.16.0",
    "@tanstack/react-query": "^5.50.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.395.0",
    "bullmq": "^5.8.0",
    "ioredis": "^5.4.0"
  },
  "forbiddenDependencies": [
    "express",
    "lodash",
    "moment",
    "axios"
  ]
}
```

> [!IMPORTANT]
> Use native `fetch()` instead of `axios`. Use native `Date` / `date-fns` instead of `moment`. Use native ES6+ methods instead of `lodash`.

---

## 5. Cross-References
- System Architecture: [04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/04_SYSTEM_ARCHITECTURE.md)
- Database Schema Specification: [09_DATABASE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/09_DATABASE.md)
- Repository Structure: [06_REPOSITORY_STRUCTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/06_REPOSITORY_STRUCTURE.md)
