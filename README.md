# BucketSpace

**Open-source, secure personal cloud storage engine powered exclusively by Telegram MTProto with verifiable cryptographic storage integrity and zero-knowledge client-side encryption.**

---

## What BucketSpace Does

BucketSpace turns your private Telegram cloud into a high-performance, unlimited, zero-subscription personal cloud storage system.

- **Telegram as Cloud Storage Engine**: Store multi-gigabyte files directly in your Telegram Saved Messages / private channel via native MTProto 2.0 and Bot API transports.
- **Zero-Knowledge Client-Side Encryption**: Files and chunks are encrypted with AES-256-GCM before transport. Encryption keys never leave your device.
- **Adaptive Multi-Part Chunking**: Large files are sliced into deterministic, bounded chunks with parallel multi-part ingestion.
- **100% Verifiable Integrity**: Every chunk is SHA-256 hashed and verified upon upload, download, and reassembly.
- **Own Your Data**: Runs entirely locally or self-hosted. Zero recurring cloud fees or vendor lock-in.

---

## Architecture

```
BucketSpace
│
├── Storage Layer
│   ├── Telegram MTProto 2.0 Storage Provider (GramJS)
│   ├── Telegram Bot API Fallback Provider
│   └── In-Memory Ephemeral Provider (Testing / Sandbox)
│
├── Reliability Layer
│   ├── SHA-256 Chunk Verification
│   ├── Deterministic Reassembly Engine
│   └── Circuit Breaker & Backpressure
│
├── Security Layer
│   ├── AES-256-GCM Envelope Encryption
│   ├── OWASP scrypt Key Derivation (N=131072)
│   ├── Hashed Share Tokens (SHA-256)
│   ├── Path Traversal Sandboxing
│   └── SQLite Append-Only Audit Logging
│
└── Database & Indexing Layer
    ├── SQLite Files & Chunks Index
    ├── Chunk Location Registry
    ├── Storage Routing Policy Engine
    └── Sync State Machine Ledger
```

---

## Important Design Decisions

### Telegram as Dedicated Storage Backend
BucketSpace supports two Telegram transport modes with dynamic capability negotiation:
- **MTProto 2.0 Client Mode (GramJS)**: Direct connection to Telegram's cloud using user credentials (`StringSession`), supporting streaming multi-gigabyte files (up to 2,000,000,000 bytes per document) with bounded 512 KB slice windows.
- **Bot API Mode**: Standard bot-based transfers with Telegram's documented limits (50 MB upload, 20 MB download).

Telegram is leveraged as a high-durability, zero-cost cloud storage backbone.

### Security Model
- **Storage access** = Application-enforced
- **File deletion** = Application-enforced (cascading purge across chunks and shares)
- **Sharing permissions** = Application-enforced (256-bit hashed tokens at rest)
- **Master credentials** = Application-enforced (AES-256-GCM + scrypt vault)

### Disaster Recovery Playbook
If your local machine or BucketSpace host suffers hardware failure, your filesystem is **fully recoverable**:

```
Disaster Recovery Workflow:
Original Host ──► Export Snapshot ──► Host Dies ──► Fresh Machine ──► Restore SQLite ──► Reconnect Telegram ──► Audit & Verify Chunks ──► 100% Recovered
```

1. **Restore Metadata Backup**: Import the exported JSON/SQLite snapshot onto your clean machine.
2. **Reconnect Telegram**: Provide your Telegram session / bot credentials.
3. **Run Integrity Audit**: BucketSpace's `BackupManager` audits all chunk references against Telegram.
4. **Instant Access**: Verified byte-identical file downloads resume immediately.

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
pnpm dev
```

Web UI: `http://localhost:3000`

---

## Repository Structure

```
BucketSpace/
├── src/
│   ├── app/                 # Next.js 15 App Router & REST API routes
│   ├── components/          # React UI components & modals
│   ├── lib/                 # Browser state store & ZIP streaming helpers
│   ├── modules/
│   │   ├── db/              # SQLite metadata repository & audit logging
│   │   ├── security/        # AES-256-GCM envelope vault & scrypt hashing
│   │   └── storage/         # Telegram MTProto adapter, chunker, routing & redundancy
│   └── shared/              # Canonical domain contracts, IDs & byte utilities
├── tests/                   # Deterministic test suites (chunker, encryption, share, SQLite, auth)
└── context/                 # Architectural specifications & security runbooks
```

---

## Security Documentation

BucketSpace's security architecture is fully documented in `/context`:
- [`SECURITY_AUDIT.md`](context/SECURITY_AUDIT.md) — Security Audit Report & OWASP Cryptographic Storage compliance.
- [`THREAT_MODEL.md`](context/THREAT_MODEL.md) — Threat model and trust boundaries.
- [`SECURITY_INVARIANTS.md`](context/SECURITY_INVARIANTS.md) — Executable security invariants.
- [`SECURITY_RUNBOOK.md`](context/SECURITY_RUNBOOK.md) — Incident response, master key rotation, and disaster recovery runbooks.
- [`TELEGRAM_CREDENTIALS_GUIDE.md`](context/TELEGRAM_CREDENTIALS_GUIDE.md) — Step-by-step guide for Telegram MTProto API keys.

---

## License

Distributed under the **MIT License**.

