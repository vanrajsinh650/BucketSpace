# BucketSpace Project State & Active Memory (PROJECT_STATE.md)

This document is the **Active Project Memory** for **BucketSpace**. It reflects the **verified codebase reality** across architecture, storage contracts, security boundaries, and production readiness.

---

## 1. Core Product Thesis & Mission

> **"BucketSpace is an open-source personal cloud storage platform powered by Telegram MTProto 2.0. It transforms private Telegram cloud storage into a personal drive featuring deterministic chunking, cryptographic SHA-256 bit integrity, and credential envelope encryption without artificial app-level quotas."**

### Core Principles & Architecture
1. **Telegram Cloud Storage Backbone**: Files are segmented into chunks and stored in a private Telegram channel (`📦 BucketSpace Vault`) using native MTProto 2.0 protocols via GramJS.
2. **Deterministic 4 MB Chunking**: Files are partitioned in the browser into safe 4 MB chunks (`File.slice()`), avoiding browser memory spikes during uploads.
3. **Cryptographic SHA-256 Bit Integrity**: Every chunk and reassembled file is hashed using WebCrypto SHA-256 to ensure byte-exact data integrity against corruption and bitrot.
4. **Credential Envelope Encryption**: User master keys and sensitive credentials are encrypted using OWASP-compliant AES-256-GCM envelope encryption with scrypt key derivation (`src/modules/security/envelope-vault.ts`).
5. **No Artificial App Quotas**: BucketSpace imposes no application-level storage cap. Usable storage is bounded only by Telegram's platform limits (2 GB per chunk, platform availability, and service Terms of Service).

---

## 2. Verified Repository Architecture

The project is structured as a **single full-stack Next.js 15 application** under the root directory:

```
BucketSpace/
├── src/
│   ├── app/                                 # Next.js 15 App Router & API Endpoints
│   │   ├── api/v1/                          # REST API Endpoints
│   │   │   ├── healthz/route.ts             # Health check probe
│   │   │   ├── shares/route.ts              # Public share token creation & listing
│   │   │   ├── shares/[token]/route.ts      # Share verification & revocation
│   │   │   ├── telegram/auth/               # MTProto phone, SMS & 2FA handlers
│   │   │   │   ├── send-code/route.ts
│   │   │   │   ├── verify-code/route.ts
│   │   │   │   └── verify-2fa/route.ts
│   │   │   ├── telegram/mtproto/chunk/      # Binary chunk upload/download/delete
│   │   │   │   └── route.ts
│   │   │   └── telegram/vault/route.ts      # Private channel provisioning
│   │   ├── s/[token]/page.tsx               # Public download & share landing page
│   │   ├── layout.tsx                       # Root layout & Geist typography
│   │   └── page.tsx                         # Main Drive web dashboard
│   ├── components/                          # UI Components & Active Dialog Modals
│   │   ├── BulkActionBar.tsx                # Floating multi-select actions
│   │   ├── DuplicateConflictModal.tsx       # Collision resolution & auto-numbering
│   │   ├── FileCard.tsx                     # Drive file card with context actions
│   │   ├── FileGrid.tsx                     # Grid & List view layout
│   │   ├── FileInfoModal.tsx                # File chunk & hash inspection modal
│   │   ├── FilePreviewModal.tsx             # Media preview (Images, Video, PDF)
│   │   ├── Header.tsx                       # Search, upload, & account status
│   │   ├── MoveFileModal.tsx                # File rename & category relocation
│   │   ├── OnboardingLandingPage.tsx        # Authentication & initial onboarding
│   │   ├── PhoneInputWithCountry.tsx        # International telephone input
│   │   ├── ProviderOnboardingModal.tsx      # Provider connection modal
│   │   ├── ProviderSettings.tsx             # Connection health & snapshot backup/restore
│   │   ├── RedundancyModal.tsx              # Chunk replica status & self-healing
│   │   ├── ShareModal.tsx                   # Share link generator with passcode
│   │   ├── Sidebar.tsx                      # Category navigation & storage usage
│   │   ├── UploadModal.tsx                  # File upload dialog & drag-drop
│   │   └── storage-rules/                   # Storage routing policy panel & dry-run
│   ├── lib/                                 # Client State & Core Utilities
│   │   ├── storage-store.ts                 # Reactive StorageStore singleton & Telegram adapter
│   │   ├── utils.ts                         # Formatting & styling helpers
│   │   └── zip-builder.ts                   # In-memory streaming ZIP archiver
│   ├── modules/                             # Domain Modules
│   │   ├── db/                              # SQLite schema, migrations, & metadata repository
│   │   ├── security/                        # AES-256-GCM Envelope Encryption Vault
│   │   └── storage/                         # Telegram MTProto service & transfer manager
│   └── shared/                              # Shared TypeScript domain contracts & types
├── tests/                                   # Unit and Integration Test Suites
├── context/                                 # Project Knowledge & Audit Records
│   ├── PROJECT_STATE.md                     # Active Project State (this document)
│   ├── PROJECT_STATE_AUDIT.md               # Claim-by-claim verification audit
│   └── SECRET_EXPOSURE_REVIEW.md            # Secret exposure audit & rotation protocol
├── package.json                             # Single package: bucketspace@1.0.0
└── next.config.js                           # Next.js configuration & server bundles
```

---

## 3. Verified Security & Threat Model

### 1. Telegram Credentials Handling
- `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` are loaded strictly at runtime from server environment variables (`.env.local`).
- If missing or invalid, `resolveTelegramCredentials()` throws an explicit configuration error.
- **Historical Exposure Notice**: API credentials committed in historical commits (`ed841ec`, `96ec98a`) are documented in `SECRET_EXPOSURE_REVIEW.md` and require upstream rotation at `my.telegram.org`.

### 2. Session Lifecycle & Storage
- When authenticated via MTProto OTP/2FA, GramJS generates a `sessionString`.
- **Client Persistence**: The session string is stored in browser `localStorage` (`bucketspace_active_provider`) so users remain signed in across page refreshes.
- **Transport Security**: The browser supplies the session token to internal API routes via the `x-telegram-session` HTTP request header.
- **Server Scope**: The session string is utilized in-memory by backend GramJS connection pools and is never logged to disk, stdout, or public responses.

### 3. Encryption Boundaries & Threat Model
- **Client-Side File Encryption (`ClientEncryptionService`)**:
  - Every 4 MB logical chunk is encrypted directly in the browser with **AES-256-GCM** before transmission.
  - Chunk Format: `[12-byte random IV | AES-256-GCM Ciphertext | 16-byte Auth Tag]`.
  - The master key resides strictly on the client device and is **never** transmitted to Telegram or the backend server.
  - **Telegram Account Compromise Resistance**: If an attacker gains access to the user's Telegram account or downloads the channel objects, they only obtain encrypted ciphertext blobs and cannot decrypt without the client-side master key.
- **Credential & Key Vault**: `EnvelopeEncryptionVault` (`src/modules/security/envelope-vault.ts`) implements AES-256-GCM envelope encryption with scrypt key derivation ($N=131072, r=8, p=1$) for master passwords and sensitive credential payloads.
- **Tamper Detection**: Any modification of stored ciphertext or authentication tags in Telegram immediately fails WebCrypto decryption with an `AuthenticationError`.

---

## 4. Verified Transfer, Storage, & Backup Model

### 1. Chunking & Concurrency Invariants
- **BucketSpace Logical Chunks**: Sliced at **4 MB boundaries** via `File.slice()`.
- **Browser Queue**: Concurrently dispatches up to 3 chunks in parallel (`CONCURRENCY = 3`).
- **Telegram MTProto Parts**: Backend GramJS streams each 4 MB chunk to Telegram Data Centers in **512 KB wire parts** using 6 socket workers.

### 2. Storage Vault Channel (`📦 BucketSpace Vault`)
- Discovers or creates a single private channel dedicated to BucketSpace.
- Mutes notifications and archives the channel to Telegram Archive (`folderId: 1`), keeping personal chats uncluttered.
- Employs a mutex lock (`vaultPromises`) to prevent race-condition channel duplicates during parallel cold-start uploads.

### 3. Backup & Disaster Recovery Limits
- `StorageStore.exportDriveSnapshot()` produces a **Metadata Registry Snapshot** (`.json`).
- **Contents**: File metadata, chunk indices, SHA-256 checksums, and Telegram message references.
- **Constraint**: The snapshot does **NOT** contain raw binary file payloads. Restoring metadata on a new device requires the original chunks to remain accessible in the Telegram channel.

### 4. Data Loss Model
- If Telegram is the sole storage location and the Telegram channel/account is deleted, BucketSpace cannot reconstruct the missing binary data from metadata alone. Secondary replicas or offline backups prevent this single-point-of-failure.

---

## 5. Verified Active Feature Matrix

| Feature | Component / Module | Verified Status |
| :--- | :--- | :---: |
| **MTProto Login & 2FA** | `OnboardingLandingPage.tsx`, `telegram-auth-service.ts` | **Active & Verified** |
| **Parallel Chunk Upload** | `UploadModal.tsx`, `storage-store.ts`, `/api/v1/telegram/mtproto/chunk` | **Active & Verified** |
| **Integrity Checksums** | WebCrypto SHA-256 in `storage-store.ts` & `FileChunker` | **Active & Verified** |
| **Media Preview** | `FilePreviewModal.tsx` (Images, Video streaming, PDF) | **Active & Verified** |
| **File Inspector** | `FileInfoModal.tsx` (Chunk breakdown & SHA-256 hashes) | **Active & Verified** |
| **File Move / Rename** | `MoveFileModal.tsx` | **Active & Verified** |
| **Duplicate Resolution** | `DuplicateConflictModal.tsx` (Auto-numbering & Overwrite) | **Active & Verified** |
| **Multi-Select & Bulk ZIP** | `BulkActionBar.tsx`, `zip-builder.ts` | **Active & Verified** |
| **Public Link Sharing** | `ShareModal.tsx`, `/s/[token]/page.tsx`, `/api/v1/shares` | **Active & Verified** |
| **Routing Policy Rules** | `StorageRulesPanel.tsx`, `RulePreview.tsx`, `StoragePolicyEngine` | **Active & Verified** |
| **Snapshot Backup/Restore** | `ProviderSettings.tsx`, `StorageStore.exportDriveSnapshot` | **Active & Verified** |
| **Connection Health Check** | `ProviderSettings.tsx`, `telegram-auth-service.ts` | **Active & Verified** |
| **Sandbox Demo Mode** | `InMemoryStorageProvider`, `storage-store.ts` | **Active & Verified** |

---

## 6. Build & Test Verification

- **Unit & Integration Tests:** 32/32 passing across 8 test suites (`tsx --test tests/**/*.test.ts`).
- **TypeScript Type Check:** 0 errors (`tsc --noEmit`).
- **Next.js Production Build:** 100% successful (`next build`).
- **Secret Scan:** 0 literal secrets in tracked files.

---

## 7. Upload Pipeline Performance & Chunk Architecture Evaluation

- **Browser Concurrency:** 5 parallel upload workers.
- **Configurable Chunk Sizing:** Defaults to 4 MB safe chunks; cleanly configurable to 16 MB or 32 MB via `StorageStore.setUploadChunkSize()` or per-call `options.chunkSize`.
- **Resumable Metadata Integrity:** Resumable sessions store the active `chunkSize` per session, guaranteeing that reloaded uploads resume with identical chunk boundaries.
- **Heterogeneous Chunk Coexistence:** Verified that files created with 4 MB, 16 MB, and 32 MB chunks download, decrypt, and reassemble seamlessly in the same drive without changes to the download engine.
- **GramJS Semantic Thresholds Verified:**
  - 4 MB: `isLarge = false`, uses `upload.saveFilePart` (`Api.InputFile`), 128 KB physical parts (33 parts per chunk).
  - 16 MB: `isLarge = true`, uses `upload.saveBigFilePart` (`Api.InputFileBig`), 128 KB physical parts (129 parts per chunk).
  - 32 MB: `isLarge = true`, uses `upload.saveBigFilePart` (`Api.InputFileBig`), 128 KB physical parts (257 parts per chunk).
- **MTProto Workers:** 6 parallel socket workers per chunk (GramJS internal lockstep batching).
- **Memory & Copy Optimizations:** Zero-copy SHA-256 buffer view reuse; direct `Blob` construction in `putChunk` without intermediate `concatByteArrays` cloning.
- **Security Invariant:** Client-side AES-256-GCM envelope preserved; download plaintext fallback strictly enforced with SHA-256 verification.
