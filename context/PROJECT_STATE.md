# BucketSpace Project State & Active Memory (PROJECT_STATE.md)

This document is the **Active Project Memory** for **BucketSpace**. It tracks high-level project goals, active architectural rules, roadmap state, and production-readiness requirements.

When architecture, goals, or rules change, this document MUST be updated, removing deprecated architectural patterns and establishing new baseline decisions.

---

## 1. Core Product Thesis & Vision

> **"BucketSpace is an open-source personal file system that unifies storage from multiple providers into one searchable, shareable drive. The storage provider is infrastructure. BucketSpace is the experience."**

### Product Principles
1. **Unified Personal Drive**: Users see a single Google Drive-style file hierarchy (`My Drive/Photos/...`). The storage backend (Telegram, S3, R2, Supabase, Local Disk) is metadata attached to each file.
2. **Provider Independence**: Storage providers are interchangeable infrastructure adapters underneath the BucketSpace core layer.
3. **Layered Intelligence**:
   - **Normal Search** (Default, No API Key): Instant structured metadata search across filenames, mime-types, extensions, sizes, dates, extracted text, and tags.
   - **Optional AI Search** (User Brings Key / Local Model): Open-source pluggable AI search layer supporting OpenAI, Gemini, Claude, OpenRouter, or local Ollama.
4. **Provider-Agnostic File Sharing**: Share links resolve `/s/:token -> fileId -> provider -> providerRef -> stream file` regardless of where bytes are stored.
5. **Storage Redundancy Policies**: Multi-provider routing & background replication (e.g. Primary: Telegram, Backup: R2).

### V0 Scope & Discipline
For V0, we strictly resist adding AI, sharing, multi-provider routing, or OCR. V0 focuses exclusively on establishing a rock-solid foundation:
> **add file → upload → metadata → close/reopen app → find file → download → verify bytes → recover from interruption → delete/restore**

---

## 2. Active Engineering Behavioral Rules

1. **Automated Git Commit and Push Protocol**:
   - Whenever any task or coding request is completed, automatically stage all changes (`git add .`), commit with a descriptive message, and push to the remote repository (`git push origin <branch>`).
2. **Active Architectural State Maintenance**:
   - Keep `context/PROJECT_STATE.md` and the `/context` documentation hub in sync with all architectural decisions, goal changes, and system rules.
   - Instantly remove deprecated architecture sections when replacement patterns are adopted.
   - Omit casual conversation; retain only technical goals, rules, and architecture specs.
3. **Human-Centric Clean Code & Modular Feature Structure**:
   - Every module must be intuitively grouped by feature functionality so any developer can easily understand the codebase.
   - Code must be clean, readable, self-documenting, and free from AI-style boilerplate bloat or unnecessarily complex abstractions.
4. **Architect-Led Development Workflow**:
   - The user is the architect. They explain what we're building, why, the algorithm, the architecture, alternatives, failure modes, and testing strategy.
   - Antigravity is the implementation agent. No giant prompt dumps. Each significant piece is understood before it is built.
   - Workflow: **Understand → Design → Decide → Implement → Test → Review → Continue**.

---

## 3. V0 Target Architecture

```
                    BUCKETSPACE V0
                          │
                    ┌─────▼─────┐
                    │ Desktop UI │
                    └─────┬─────┘
                          │
                    Local Application
                          │
             ┌────────────┼────────────┐
             │            │            │
          Metadata      Storage      Transfer
           SQLite       Engine        Manager
             │            │            │
             │      ┌─────▼─────┐      │
             │      │ Telegram  │      │
             │      │ Adapter   │      │
             │      └───────────┘      │
             │                         │
             └────────────┬────────────┘
                          │
                    Local File Index
```

### Key Design Decisions
- **Metadata Store**: SQLite (local, no external DB dependency).
- **Storage Engine**: Provider-agnostic interface. V0 implements only Telegram adapter.
- **Transfer Manager**: Handles chunking, upload/download orchestration, interruption recovery.
- **Provider Abstraction**: `StorageProvider` contract designed so future adapters (Local Disk, S3, GCP, Azure) slot in without refactoring.

---

## 4. Current Status & Progress Tracking

- **Active Phase**: **BucketSpace V0 — Local Personal Storage**
- **Completed Step 1**: **Core Domain Contracts & Storage Abstraction** ✅ ([Commit `284e160`](https://github.com/vanrajsinh650/BucketSpace/commit/284e160))
  - Stream-oriented `IStorageProvider` contract (`AsyncIterable<Uint8Array>`).
  - Nominal branded types (`FileId`, `ChunkId`, `ProviderId`) and domain error hierarchy.
  - Opaque provider references (`ProviderChunkRef` with `reference: unknown`).
  - `InMemoryStorageProvider` test adapter passing 100% unit tests.
- **Completed Step 2**: **Local SQLite Metadata Engine & Repository** ✅ ([Commit `5e4de9e`](https://github.com/vanrajsinh650/BucketSpace/commit/5e4de9e))
  - Native `node:sqlite` DB wrapper with `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`.
  - `files` and `chunks` schema with `CONSTRAINT uq_file_chunk UNIQUE (file_id, chunk_index)` and `INDEX idx_chunks_file_id`.
  - Prepared statements and atomic transactions for metadata operations.
  - `IMetadataRepository` implementation (`SqliteMetadataRepository`) passing database closing & reopening test.
- **Completed Step 3**: **The Transfer Engine & Recovery System** ✅ ([Commit `0ace85b`](https://github.com/vanrajsinh650/BucketSpace/commit/0ace85b))
  - `FileChunker` stream chunking and dual chunk/whole-file SHA-256 digest calculations without RAM buffer inflation.
  - `TransferOrchestrator` handling stream upload and verified reassembly download.
  - `RecoveryEngine` inspecting metadata vs provider states, resuming partial uploads cleanly (zero duplicate puts for verified chunks), and recovering from desynced provider data.
  - E2E unit & recovery test suite passing 100%.
- **Completed Step 4**: **Telegram Storage Adapter (`IStorageProvider`)** ✅ ([Commit `d5d0e1f`](https://github.com/vanrajsinh650/BucketSpace/commit/d5d0e1f))
  - `TelegramStorageAdapter` implementing stream-oriented `IStorageProvider` contract using Node 22 native `fetch`/`FormData`.
  - Configured 5MB default chunk size (respecting Bot API 20MB download limit).
  - Translates `putChunk`, `getChunk`, `hasChunk`, `deleteChunk` into Telegram Bot API endpoints (`sendDocument`, `getFile`, `deleteMessage`).
  - Stores opaque `TelegramRefData` (`chatId`, `messageId`, `fileId`) in SQLite.
  - Passes 100% full E2E upload -> DB restart -> download -> SHA-256 byte equality test suite and Telegram desync recovery test suite.
- **Next Step**: **Step 5 — End-to-End V0 CLI Verification & Final V0 Acceptance**.

---

## 5. Security & Reliability Directives
- **Data Integrity**: Every downloaded file must be byte-identical to the uploaded original. Verified via checksums.
- **Interruption Recovery**: Partial uploads/downloads must be resumable. No data loss on crash or network failure.
- **Credentials Protection**: Telegram bot tokens and session data stored securely in local config.
