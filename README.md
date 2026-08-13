# BucketSpace

**Open-source, provider-agnostic personal cloud and memory system with verifiable storage integrity, redundancy, hybrid search, and source-grounded AI.**

---

## What BucketSpace Does

BucketSpace is a personal storage system that turns multiple cloud providers into a single, searchable, AI-aware file system.

- **Store files across any provider**: Telegram, Local Disk, S3/R2, Supabase — through a single unified interface.
- **Search by meaning, not just filename**: Hybrid BM25 + semantic vector search with Reciprocal Rank Fusion.
- **Ask questions about your files**: Source-grounded AI assistant with enforced refusal, provenance citations, and post-generation claim validation.
- **Verify everything**: Every chunk is SHA-256 hashed, replicated, and continuously verified. Corrupted data is auto-repaired from verified replicas.
- **Own your data**: Runs entirely locally. No external accounts required. Ollama for local LLM inference.

---

## Architecture

```
BucketSpace
│
├── Storage Layer
│   ├── Telegram Storage Backend
│   ├── Local Disk (Sandboxed)
│   ├── AWS S3 / Cloudflare R2
│   └── Supabase Storage
│
├── Reliability Layer
│   ├── SHA-256 Chunk Verification
│   ├── Active Replication
│   ├── Automatic Repair
│   └── Circuit Breaker & Backpressure
│
├── Security Layer
│   ├── AES-256-GCM Envelope Encryption
│   ├── OWASP scrypt Key Derivation (N=131072)
│   ├── Hashed Share Tokens (SHA-256)
│   ├── Path Traversal Sandboxing
│   └── Audit Logging
│
├── Content Intelligence
│   ├── PDF Text Extraction (Page Provenance)
│   ├── OCR (Confidence + Bounding Box)
│   ├── Audio/Video Transcription (Timestamps)
│   └── SQLite FTS5 Full-Text Index
│
├── Search Layer
│   ├── SQLite FTS5 BM25 (Lexical)
│   ├── 384-Dim Semantic Vectors (Cosine)
│   └── Reciprocal Rank Fusion (RRF)
│
└── AI Assistant
    ├── Application-Level Authorization (Pre-LLM)
    ├── RAG Context Builder
    ├── LLM Abstraction (Ollama / Mock)
    ├── Source-Grounded Citations
    ├── Enforced Refusal ("I don't know")
    ├── Prompt Injection Defense-in-Depth
    ├── Post-Generation Claim Validation
    └── Citation Verification (vs. SQLite DB)
```

---

## Important Design Decisions

### Telegram as Storage Backend
BucketSpace uses Telegram as one of several storage providers. The Telegram Bot API has documented limits (50 MB upload, 20 MB download via `getFile`). BucketSpace's chunked transfer engine works within these limits. Telegram is a storage backend, not "infinite storage."

### AI Grounding & Hallucination Policy
BucketSpace provides **source-grounded responses with enforced refusal, prompt-injection defense in depth, and post-generation claim validation.** It does not claim "zero hallucination." No current system can mathematically guarantee that an LLM will never produce an unsupported statement. BucketSpace constrains, detects, and rejects unsupported output through multiple validation layers.

### Authorization & Security Model
The LLM is **an untrusted text generator with zero authority over storage, permissions, sharing, deletion, or credentials**. The application resolves which files a user is permitted to access, and passes only authorized file IDs to the search engine. The LLM only ever sees chunks from files the user is authorized to access.

- **Storage access** = Application-enforced
- **Authorization** = Application-enforced (pre-retrieval filtering)
- **File deletion** = Application-enforced (cascading purge across FTS, vectors, and shares)
- **Sharing permissions** = Application-enforced (256-bit hashed tokens at rest)
- **Master credentials** = Application-enforced (AES-256-GCM + scrypt vault)

### File Extraction Pipeline Bounds
To prevent resource exhaustion and decompression bombs, content ingestion follows a bounded processing model:
```
compressed input ──► parser ──► bounded memory ──► bounded extracted output ──► bounded processing time
```

---

## Quick Start

### Prerequisites
- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0

### Install & Run

```bash
git clone https://github.com/vanrajsinh650/BucketSpace.git
cd BucketSpace
pnpm install
pnpm type-check
pnpm --filter "@bucketspace/web" dev
```

Web UI: `http://localhost:3000`

### Run Tests

```bash
pnpm --filter "@bucketspace/storage-adapters" test
```

---

## Repository Structure

```
BucketSpace/
├── apps/
│   ├── api/                 # Fastify REST API
│   ├── cli/                 # CLI Interface
│   └── web/                 # Next.js 15 Web UI
├── packages/
│   ├── shared/              # Domain Contracts & Types
│   ├── security/            # Encryption & Key Derivation
│   ├── db/                  # SQLite Metadata, FTS5, Vector Store
│   └── storage-adapters/    # Provider Adapters, Search, AI, Trust
└── context/                 # Architectural Documentation
```

---

## Milestone History

| Version | Milestone | Tests |
| :--- | :--- | :--- |
| V0 | Storage Foundation | 11 |
| V1 / V1.5 | Multi-Provider + SQLite Search | 16 |
| V2 | Routing, Migration, Sharing | 22 |
| V2.2 | Storage Policy Engine | 28 |
| V2.3 | Replication, Verification, Repair | 34 |
| V2.4 | AES-256-GCM Encryption, Circuit Breaker | 42 |
| V2.5 | Threat-Model Hardening, Audit Logging | 47 |
| V3.0 | Content Ingestion & Provenance Pipeline | 52 |
| V3.1 | Hybrid RRF Search (BM25 + Semantic) | 57 |
| V3.2 | Grounded RAG Assistant | 62 |
| V3.3 | AI Trust & Citation Validation | 66 |
| V3.4 | Adversarial Hardening & 100+ Benchmark | 69 |
| **1.0 RC** | **Authorization Hardening & Release Candidate** | **73** |
| **1.0 RC Audit** | **Final Release Validation & Concurrency Hardening** | **92** |

---

## Current Status

BucketSpace is a **feature-complete 1.0 Release Candidate undergoing final release validation**. Feature development is frozen in favor of release engineering, clean setup verification, migration testing, and invariant auditing.

---

## Security Considerations

- **Encryption**: AES-256-GCM with per-file Data Encryption Keys, wrapped under master passphrase via OWASP scrypt.
- **Share Tokens**: 256-bit random tokens, stored hashed (SHA-256) at rest.
- **Path Traversal**: Canonical `path.resolve` + strict root prefix validation.
- **Prompt Injection**: Defense-in-depth (pattern matching, Unicode normalization, exfiltration detection). Treated as one security layer, not a complete boundary.
- **Authorization**: Application-enforced, never delegated to the LLM.

---

## License

Distributed under the **MIT License**.
