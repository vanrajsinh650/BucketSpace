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
BucketSpace supports two Telegram transport modes with dynamic capability negotiation:
- **MTProto 2.0 Client Mode (GramJS)**: Direct connection to Telegram's cloud using user credentials (`StringSession`), supporting streaming multi-gigabyte files (up to 2,000,000,000 bytes per document) with bounded 512 KB slice windows.
- **Bot API Mode**: Standard bot-based transfers with Telegram's documented limits (50 MB upload, 20 MB download).

Telegram is treated as a high-durability cloud storage adapter, not "infinite storage." Durability is guaranteed through active multi-provider replication and self-healing verification.

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

### Disaster Recovery Playbook: "What Happens If My Laptop Dies?"
If your local machine or BucketSpace host suffers total hardware failure, your filesystem is **fully recoverable**:

```
Disaster Recovery Workflow:
Original Host ──► Export Snapshot ──► Host Dies ──► Fresh Machine ──► Restore SQLite ──► Reconnect Providers ──► Audit & Verify Chunks ──► 100% Recovered
```

1. **Restore Metadata Backup**: Import the exported JSON/SQLite snapshot onto your clean machine.
2. **Reconnect Storage Providers**: Provide your provider credentials (Telegram sessions/tokens, S3/R2 keys, Supabase URLs, local storage disks).
3. **Run Integrity Audit**: BucketSpace's `BackupManager` instantly audits all chunk references against the reconnected providers.
4. **Instant Access**: Full hybrid search, vector embeddings, and verified byte-identical file downloads resume immediately.

### Explicit Backup Scope: Metadata vs. File Bytes
To prevent confusion, BucketSpace maintains a strict distinction between metadata snapshots and storage payloads:

| Included in Backup Snapshot ✅ | NOT Included in Backup Snapshot ❌ |
| :--- | :--- |
| **SQLite Filesystem Index & File Records** | **Raw File Payload Bytes** |
| **Chunk Identifiers & Hash Checksums** | (Raw chunks reside securely across |
| **Provider Location Mappings & Refs** | Telegram, S3, Local Disk, & Supabase) |
| **FTS5 Full-Text Search Metadata** | |
| **384-Dim Vector Embeddings** | |
| **Storage Routing Rules & Policies** | |
| **Audit Logs & Historical Trails** | |

> [!NOTE]
> A BucketSpace metadata backup is an index backup, not a bulk storage dump. File durability is provided by BucketSpace's active multi-provider replication and self-repair engine.

---

## Quick Start

### Prerequisites
- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0

### Clean-Machine Setup & First-Run

```bash
# 1. Clone the repository
git clone https://github.com/vanrajsinh650/BucketSpace.git
cd BucketSpace

# 2. Install dependencies with frozen lockfile
pnpm install

# 3. Verify types and run test suites
pnpm type-check
pnpm test

# 4. Launch the local web interface
pnpm --filter "@bucketspace/web" dev
```

Web UI: `http://localhost:3000`

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
│   └── storage-adapters/    # Provider Adapters, Search, AI, Trust, Resilience
└── context/                 # Architectural Documentation & Project State
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
| **1.0 RC Final** | **Disaster Recovery, Residue Purge & Backup Hardening** | **94** |
| **1.0 RC MTProto** | **MTProto 2.0 Streaming Engine & Multi-Part Sizing** | **105** |
| **1.0 Security Freeze** | **24 Security Invariants (S1–S24) & Consolidated Red-Team Suite** | **114** |

---

## Security Documentation

BucketSpace's security architecture is fully documented in `/context`:
- [`SECURITY_AUDIT.md`](context/SECURITY_AUDIT.md) — 20-Phase Security Audit Report & OWASP Cryptographic Storage compliance.
- [`THREAT_MODEL.md`](context/THREAT_MODEL.md) — Threat model covering 15 threat actors (A–O) and trust boundaries.
- [`SECURITY_INVARIANTS.md`](context/SECURITY_INVARIANTS.md) — 24 executable security invariants (S1–S24).
- [`SECURITY_RUNBOOK.md`](context/SECURITY_RUNBOOK.md) — Incident response, master key rotation, and disaster recovery runbooks.
- [`SECURITY_FINDINGS.md`](context/SECURITY_FINDINGS.md) — Vulnerability inventory and remediation catalog.

---

## License

Distributed under the **MIT License**.


