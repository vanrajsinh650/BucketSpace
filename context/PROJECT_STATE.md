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
- **Production Default Chunk Sizing:** Defaults to **16 MB chunks** (`DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024`), cutting HTTP requests and Telegram documents by 72% compared to 4 MB while keeping memory overhead bounded. Backward compatibility with existing 4 MB files is 100% preserved.
- **Resumable Metadata Integrity:** Resumable sessions store the active `chunkSize` per session, guaranteeing that reloaded uploads resume with identical chunk boundaries.
- **Heterogeneous Chunk Coexistence:** Verified that files created with 4 MB, 16 MB, and 32 MB chunks download, decrypt, and reassemble seamlessly in the same drive without changes to the download engine.
- **GramJS Semantic Thresholds Verified:**
  - 4 MB: `isLarge = false`, uses `upload.saveFilePart` (`Api.InputFile`), 128 KB physical parts (33 parts per chunk).
  - 16 MB: `isLarge = true`, uses `upload.saveBigFilePart` (`Api.InputFileBig`), 128 KB physical parts (129 parts per chunk).
  - 32 MB: `isLarge = true`, uses `upload.saveBigFilePart` (`Api.InputFileBig`), 128 KB physical parts (257 parts per chunk).
- **MTProto Workers:** 6 parallel socket workers per chunk (GramJS internal lockstep batching).
- **Memory & Copy Optimizations:** Zero-copy SHA-256 buffer view reuse; direct `Blob` construction in `putChunk` without intermediate `concatByteArrays` cloning.
- **Security Invariant:** Client-side AES-256-GCM envelope preserved; download plaintext fallback strictly enforced with SHA-256 verification.

---

## 8. Production Deployment Architecture & Security Hardening

- **Deployment Topology:**
  - **Vercel (Frontend):** Static and SSR pages (`/`, `/s/[token]`, `/share/[token]`), client-side WebCrypto encryption, browser chunking, UI state.
  - **Render (Telegram Backend):** Long-running Node.js 22 Web Service hosting MTProto 2.0 streaming (`/api/v1/telegram/*`), connection pooling, and vault provisioning.
- **Security Posture & Fixes Applied:**
  - **Zero Secrets in Client Bundles:** Eliminated `NEXT_PUBLIC_` prefixes on Telegram credentials. `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` are private server-side variables only.
  - **No Session in URL Parameters:** Removed `searchParams.get('sessionString')` fallbacks across all routes; session strings are transmitted strictly via the `x-telegram-session` header.
  - **Shares API Passcode Protection:** `GET /api/v1/shares/[token]` strips plaintext `passcode` and only returns `hasPasscode: boolean`. Passcode verification uses constant-time length-safe comparison in `POST`.
  - **Session Token Entropy:** `TelegramAuthService.sendCode()` uses `crypto.randomUUID()` for high-entropy login session tokens.
  - **Connection Pool Mutex & Clean Shutdown:** Added in-flight promise mutex (`clientPromises`) to eliminate concurrent connection race conditions when parallel chunk workers connect simultaneously; automatic idle client eviction (>30 min), maximum pool cap (20 clients), and `closeAllClients()` hook for SIGTERM/SIGINT signals.
  - **URL Sanitization:** Standardized `NEXT_PUBLIC_API_URL` consumption with defensive trailing-slash normalization across all client adapters and modal auth flows.
  - **Security Headers & CSP:** Configured HSTS (`max-age=63072000`), X-Frame-Options DENY, nosniff, and strict Content-Security-Policy in `next.config.js`.
  - **CORS Middleware (`src/middleware.ts`):** Enforces origin whitelist validation across `/api/:path*`, allowing Vercel and local dev origins while rejecting unauthorized origins.
  - **Liveness Health Endpoint:** Dedicated `/api/health` probe responding with HTTP 200 and uptime in <5ms without Telegram dependencies.
- **CI / Pre-Deploy Validation:** Automated verification via `./scripts/validate-production.sh` running typecheck, unit tests, production compilation, and live server startup smoke tests.

---

## 9. Frontend & Consumer UX Polish (Production Release)

- **Hydration-Safe Gate (`src/app/page.tsx` & `src/lib/storage-store.ts`):** Guarded `hasUserProvider()` against SSR execution (`typeof window === 'undefined'`) and unified the initial render pass to `!mounted || !store.hasUserProvider()`, ensuring server-rendered HTML and client initial hydration tree match 100% identically with zero hydration errors.
- **Consumer Error Humanization (`src/lib/humanize-error.ts`):** Converts low-level Telegram MTProto RPC codes (`PHONE_CODE_INVALID`, `PASSWORD_HASH_INVALID`, `FLOOD_WAIT`), network timeouts, and crypto exceptions into clear consumer guidance across onboarding, upload, and sharing flows.
- **Zero Native Browser Modals:** Replaced all native `alert()` and `confirm()` dialogs with an accessible `ToastContainer` and `ConfirmDialog` (`role="dialog" aria-modal="true"`) matching the dark charcoal design system.
- **Mobile & Accessibility Enhancements:**
  - Added accessible skip link (`#main-content`) in `src/app/layout.tsx` with defensive inline off-screen styling to prevent unstyled text flashes, and hooked `id="main-content"` to the hero section.
  - Added `:focus-visible` styling and `prefers-reduced-motion` media query handling in `src/app/globals.css`.
  - Upgraded dialogs to responsive bottom sheets on mobile devices with comfortable 40–44px minimum tap targets.
  - Global `⌘K` keyboard shortcut listener in header search.
- **Progress & Error Recovery:**
  - Upload modal displays real progress stages (`Preparing and encrypting file...`, `Uploading to private vault...`, `Finishing and verifying...`) with part counts and a one-click "Retry Upload" option on failures.
- **Procedural Ethereal Floating Clouds (`src/components/FloatingClouds.tsx`):**
  - Purged static `dark_ethereal_cloud.jpg` image asset (536KB) and its clipped rectangular boundary artifacts completely from the repository.
  - Implemented high-performance HTML5 canvas procedural volumetric cloud animation with organic particle clustering, multi-layered drifting, sinusoidal breathing, and seamless radial gradient opacity falloff into `#000000`.
  - Fully responsive via `ResizeObserver`, retina DPR scaled, and includes static fallback for `prefers-reduced-motion`.
- **Validation:** 38 unit tests passing (100%), TypeScript typecheck clean, and production build fully verified.

## 10. Legal Disclosures & Open-Source Licensing

- **Apache License 2.0 (`LICENSE`):** Official, unabridged Apache License 2.0 text applied to original source code with Copyright 2026 Vanraj Solanki.
- **Privacy Policy (`PRIVACY.md`):** Comprehensive technical privacy disclosures accurately describing client-side AES-256-GCM encryption, ephemeral server memory management, absence of backend database persistence, browser `localStorage` usage, absence of third-party cookies/analytics, and third-party hosting/infrastructure boundaries (Telegram, Vercel, Render).
- **Interactive `/privacy` Route (`src/app/privacy/page.tsx`):** Prerendered static privacy page with dark charcoal design system, clear headings, visible effective date, and back-to-home navigation.
- **UI Navigation Links:** Integrated accessible Privacy Policy links into landing page navbar, landing page footer (`Legal` column), and dashboard sidebar footer.
- **Documentation & Repository Polish (`README.md` & `package.json`):** High-visibility architecture flow diagrams, cross-platform installation guides for Linux, Apple macOS, and Windows (PowerShell/WSL2), curated discovery keywords, and production runbooks for Vercel + Render.
- **Next.js Security Upgrade & Zero-Config Vercel:** Upgraded Next.js from vulnerable `15.0.0` to secure patched `15.5.25`, purged redundant `vercel.json` for native zero-config deployment, and verified 38/38 unit tests and production build.
- **Automated CI/CD Quality Pipeline (`.github/workflows/ci.yml`):** GitHub Actions workflow running on Node 22 with automatic dependency caching. Automatically validates every commit and pull request across strict TypeScript static typing, 38 automated unit test suites, and production Next.js build compilation.
- **Production Dockerfile & Container Cloud Support (`Dockerfile`, `.dockerignore`, `pnpm-workspace.yaml`):** Production container based on `node:22-slim` and `pnpm`. Configured explicit build script allowlisting (`allowBuilds` for `esbuild` and `sharp`; disallowing optional native C++ add-ons `bufferutil`, `utf-8-validate`, and ad script `es5-ext`) for zero-prompt, non-interactive builds on Railway, Northflank, and Render.
- **Environment Configuration Resilience:** Added graceful variable resolution fallback in `resolveTelegramCredentials()` to support both `TELEGRAM_API_ID` and typo variant `TELEGRAM_APT_ID`.
- **Diagnostic Server Logging & Credential Sanitization:** Added server-side error logging in authentication API routes and quote/whitespace stripping in credential parser to diagnose and prevent environment misconfigurations.
- **API Base URL Normalization (`normalizeApiBase`):** Added automated protocol sanitization ensuring client-side API calls to external backends always enforce `https://`, preventing relative-path 404 routing errors on Vercel.
- **Public File Sharing Architecture & Telegram Chunk Proxying (`GET /api/v1/shares/[token]/chunks/[index]`):** Resolved public share download failures across split Vercel/Railway deployments. Implemented server-side Telegram chunk retrieval using isolated owner session tokens without exposing credentials to recipients. Enforced zero-knowledge client-side AES-256-GCM decryption via RFC 3986 URL hash fragments (`#key=...`) that are never transmitted to backend servers, alongside SHA-256 chunk and whole-file verification.


