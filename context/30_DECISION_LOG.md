# Architectural Decision Log & ADR Registry (30_DECISION_LOG.md)

## 1. Executive Summary & ADR Protocol
This document records all critical architectural decisions for **BucketSpace**. Future engineering decisions MUST follow the standard Architectural Decision Record (ADR) template defined herein and be appended to this log.

---

## 2. ADR Template

```markdown
### ADR-XXX: [Title of Decision]
- **Date**: YYYY-MM-DD
- **Status**: [Proposed | Accepted | Superseded | Rejected]
- **Deciders**: [Architect Name / Engineering Lead]

#### Context & Problem Statement
Describe the engineering challenge, technical constraints, or business requirements prompting this decision.

#### Decision
State the exact technical architecture or technology choice adopted.

#### Rationale & Benefits
Explain WHY this option was chosen over alternatives.

#### Tradeoffs & Risks
Document known performance, operational, or financial tradeoffs.

#### Alternatives Considered
List alternative designs or frameworks evaluated and why they were rejected.
```

---

## 3. Baseline Architectural Decision Records (ADRs)

### ADR-001: Direct-to-Cloud Presigned Upload Architecture
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Principal Software Architect
- **Context**: Payload traffic for multi-gigabyte video renders and raw dataset uploads saturated API Gateway RAM and network bandwidth when proxied through web servers.
- **Decision**: All object uploads execute directly from client browser Web Workers to cloud storage endpoints (AWS S3, R2) using presigned multipart URLs.
- **Rationale**: Reduces API Gateway CPU/RAM overhead to near zero. Enables direct line-speed client uploads.
- **Tradeoffs**: Requires complex frontend state handling for chunk retries and backend webhook completion confirmation hooks.

---

### ADR-002: Unified PostgreSQL + `pgvector` Engine
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Systems Designer & AI Lead
- **Context**: Running a separate vector database (e.g. Pinecone) alongside a relational metadata database creates dual-write synchronization bugs and extra DevOps cost.
- **Decision**: Use a single PostgreSQL 16 database with `pgvector` HNSW indexes for metadata, workspace permissions, audit logs, and 512/1536-dimensional AI vector embeddings.
- **Rationale**: Guarantees ACID transactional integrity. Simplifies deployment to a single database cluster.
- **Tradeoffs**: Requires database tuning (`HNSW` params) for vector queries as row counts exceed 10 million.

---

### ADR-003: Next.js 15 App Router & React Server Components
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Product Architect & Frontend Lead
- **Context**: Client-side single-page applications suffer from slow initial directory render times when rendering massive bucket trees.
- **Decision**: Adopt Next.js 15 App Router with React Server Components (RSC) and Streaming SSR.
- **Rationale**: Ships zero client JS for static layout components. Enables fast initial HTML streams for file trees.

---

### ADR-004: Fastify API Gateway Monolithic Monorepo Structure
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Staff Software Engineer
- **Context**: Premature microservices overhead slows down early feature iteration.
- **Decision**: Deploy a single modular monolith API Gateway using Fastify inside a pnpm monorepo layout.
- **Rationale**: 45,000 req/sec Fastify performance with zero network latency overhead between internal domain modules.

---

### ADR-005: BullMQ + Redis Background Worker Processing
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Systems Designer
- **Context**: Heavy AI vector embedding calculations (CLIP/Whisper) block API Gateway request threads.
- **Decision**: Offload all asynchronous tasks (embedding generation, video transcoding, bucket sync) to BullMQ job queues backed by Redis.

---

### ADR-006: Multimodal Vector Embedding (CLIP ViT-L/14 + Whisper)
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: AI Engineering Lead
- **Context**: Keyword search fails to find visual media or audio assets without manual metadata tagging.
- **Decision**: Deploy CLIP ViT-L/14 (visual) and Whisper (speech-to-text) background workers to automatically compute semantic embeddings for uploaded assets.

---

### ADR-007: Zero-Trust Encryption & Vault Envelope Key Management
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Security Architect
- **Context**: Multi-cloud bucket credentials (S3 keys, R2 tokens) stored in plaintext pose severe data leak risks.
- **Decision**: Enforce AES-256-GCM envelope encryption for all provider credentials using master keys managed by HashiCorp Vault / AWS KMS.

---

### ADR-008: Meilisearch Integration for Sub-50ms Lexical Search
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Principal Architect
- **Context**: PostgreSQL `LIKE` queries on filename columns degrade under heavy text search loads.
- **Decision**: Integrate Meilisearch as an auxiliary fast-path search index for exact keyword and prefix auto-complete queries.

---

### ADR-009: Web Worker Multithreaded Browser Uploads
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Frontend Lead
- **Context**: Hashing 10GB file payloads on the main browser UI thread freezes UI responsiveness and drops frame rates.
- **Decision**: Execute file chunking, SHA-256 hashing, and S3 PUT requests inside dedicated Web Worker threads.

---

### ADR-010: Dark Glassmorphic Design System with Tailwind CSS Tokens
- **Date**: 2026-08-04
- **Status**: Accepted
- **Deciders**: Product Architect & UI Lead
- **Context**: Standard cloud console interfaces feel dated, visually busy, and exhausting during long sessions.
- **Decision**: Adopt a modern dark glassmorphic UI design system utilizing Tailwind CSS design tokens and Inter typography.

---

## 4. Cross-References
- Master Context Hub: [00_README.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/00_README.md)
- Product Vision: [01_PRODUCT_VISION.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/01_PRODUCT_VISION.md)
- System Architecture: [04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/04_SYSTEM_ARCHITECTURE.md)
