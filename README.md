# BucketSpace

<div align="center">

**Open-source, client-side encrypted personal cloud storage engine backed by Telegram MTProto.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-339933?logo=node.js)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-38%2F38_Passing-success)]()

</div>

---

## Overview

**BucketSpace** turns your private Telegram storage into an unlimited, high-performance personal cloud drive. 

Files are sliced and encrypted directly in your browser using standard **AES-256-GCM** before any data touches the network. Your master encryption key stays exclusively on your local device. The backend operates purely as an ephemeral MTProto relay, ensuring zero backend database lock-in and zero plaintext exposure.

- **Zero-Subscription Storage**: Uses your existing Telegram account as a resilient, free cloud storage layer.
- **Client-Side Encryption**: 256-bit AES-GCM encryption with unique random IVs per chunk executed via the Web Crypto API.
- **Adaptive 16 MB Chunking**: Multi-part streaming with deterministic reassembly and SHA-256 integrity verification.
- **Stateless Backend**: The Node.js server stores no database records, no user files, and no persistent credentials.
- **Modern Private Drive Interface**: Responsive file explorer, categorized navigation, search, share links, and procedural animated cloud aesthetics.

---

## Architecture & Data Flow

BucketSpace separates stateless frontend client encryption from long-running Telegram MTProto socket operations:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              1. CLIENT BROWSER (Vercel)                                │
│                                                                                        │
│   [ Selected File ] ──► [ 16 MB Chunk Slicing ] ──► [ Web Crypto AES-256-GCM ]         │
│                                                              │                         │
│   • Master Key stays strictly in localStorage                ▼                         │
│   • Random 12-byte IV per chunk                     Ciphertext Buffer                  │
│   • 128-bit integrity authentication tag            (Binary Payload)                   │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │
                                                │ HTTPS POST /api/v1/telegram/mtproto/chunk
                                                │ Header: x-telegram-session
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             2. BACKEND RELAY (Render)                                  │
│                                                                                        │
│   [ Validate Size (≤ 50 MB) ] ──► [ Connection Pool ] ──► [ GramJS 6-Worker Stream ]   │
│                                                              │                         │
│   • Zero backend database persistence                        ▼                         │
│   • Ephemeral session memory only                   MTProto 2.0 Encrypted              │
│   • Slices chunk into 512 KB physical parts         TCP Socket Stream                  │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │
                                                │ MTProto saveBigFilePart (Parallel Workers)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           3. STORAGE BACKBONE (Telegram)                               │
│                                                                                        │
│   [ Telegram Data Centers ] ──► [ #bucketspace-vault ] ──► [ Document Message ID ]    │
│                                                                                        │
│   • High-durability unlimited cloud storage                                            │
│   • Stored as encrypted documents in your private channel                              │
│   • Reconstructible anytime directly via your Telegram credentials                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Pipeline

| Stage | Execution Context | What Happens | Security & Privacy Guarantee |
| :--- | :--- | :--- | :--- |
| **1. Slice & Hash** | **Browser** | Slices file into 16 MB bounded chunks and calculates SHA-256 integrity hash. | Plaintext never leaves browser memory |
| **2. Encrypt** | **Browser** | Encrypts each chunk with AES-256-GCM using a unique 12-byte random IV. | Master key stays in `localStorage` |
| **3. Relay** | **Render Backend** | Streams binary ciphertext to Telegram via pooled GramJS MTProto workers. | Backend sees only encrypted bytes |
| **4. Store** | **Telegram Cloud** | Saved as document messages inside user's private `#bucketspace-vault` channel. | Telegram stores encrypted ciphertext |
| **5. Download** | **Browser** | Fetches encrypted chunks, validates SHA-256 hash, and decrypts with master key. | Bit-exact verification before save |

**Download & Reassembly Path**:
```
Telegram Vault ──► Backend Relay (Encrypted Chunks) ──► Browser Decryption (AES-256-GCM) ──► Saved File
```

---

## Key Features

| Capability | Technical Implementation | Guarantee |
| :--- | :--- | :--- |
| **Client Encryption** | Web Crypto API `AES-256-GCM` | Backend & Telegram never see plaintext payloads |
| **Chunking Engine** | Bounded 16 MB logical chunks (configurable to 4 / 32 MB) | Bypasses HTTP payload limits & allows parallel parts |
| **Integrity Checks** | Deterministic SHA-256 digest per chunk and whole file | Bit-exact reassembly and tamper detection |
| **Authentication** | MTProto 2.0 SRP authentication with 2FA support | Ephemeral in-memory login; session string stored in browser |
| **Public Sharing** | Ephemeral token-based share routes (`/s/[token]`) | Optional constant-time passcodes and instant revocation |
| **Zero Backend DB** | Ephemeral memory cache with client-side persistence | No user database to maintain, breach, or backup |

---

## Installation & Setup

Follow these straightforward steps to run BucketSpace locally on your machine.

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js**: `>= 22.0.0` ([Download Node.js](https://nodejs.org/))
- **pnpm**: `>= 9.0.0` (Install via `npm install -g pnpm` or Corepack)
- **Git**: Installed and configured

Verify your installed versions:
```bash
node -v   # Should be v22.x or higher
pnpm -v   # Should be 9.x or higher
```

---

### 2. Clone the Repository

```bash
git clone https://github.com/vanrajsinh650/BucketSpace.git
cd BucketSpace
```

---

### 3. Install Dependencies

Install project packages using pnpm:
```bash
pnpm install
```

---

### 4. Obtain Telegram API Credentials

BucketSpace connects to Telegram using official MTProto 2.0 user credentials. To generate your API keys:

1. Log in with your Telegram account at **[https://my.telegram.org](https://my.telegram.org)**.
2. Click **API development tools**.
3. Fill in the required fields:
   - **App title**: `BucketSpace` (or your preferred name)
   - **Short name**: `bucketspace`
   - **Platform**: `Web` or `Desktop`
4. Click **Create application**.
5. Copy your **`api_id`** (numeric) and **`api_hash`** (alphanumeric string).

> [!NOTE]
> These credentials identify your application with Telegram's MTProto servers. They are kept securely on the backend and are never exposed to the browser.

---

### 5. Configure Environment Variables

Copy the provided example environment file to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and enter your credentials:

```ini
# ============================================================
# BucketSpace — Local Configuration (.env.local)
# ============================================================

# Telegram MTProto API Credentials (from https://my.telegram.org)
TELEGRAM_API_ID="12345678"
TELEGRAM_API_HASH="0123456789abcdef0123456789abcdef"

# API URL (Leave blank for local development — browser uses same-origin)
NEXT_PUBLIC_API_URL=""

# Allowed CORS origins
CORS_ORIGINS="http://localhost:3000"

# Chunk upload socket timeout in milliseconds (default: 5 minutes)
UPLOAD_TIMEOUT_MS=300000

# Node Environment
NODE_ENV=development
```

---

### 6. Start the Development Server

Run the development server:

```bash
pnpm dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

1. Click **Get Started** or **Connect to Telegram**.
2. Enter your phone number (with country code, e.g. `+1...`).
3. Enter the verification code sent to your Telegram app.
4. If prompted, enter your Telegram 2FA cloud password.
5. Your private `#bucketspace-vault` channel is automatically initialized, and your encrypted drive is ready!

---

### 7. Run Verification & Tests

BucketSpace comes with an automated unit test suite covering chunking, encryption, integrity hashing, MTProto auth, routing, and sharing:

```bash
# Run all 38 automated test suites
pnpm test

# Check TypeScript static types
pnpm type-check

# Compile production build
pnpm build
```

---

## Production Deployment (Vercel + Render)

BucketSpace is optimized for a dual-host production topology:
- **Vercel**: Serves the Next.js frontend, static assets, and client-side encryption.
- **Render**: Runs the persistent Node.js service for Telegram MTProto socket connections.

### Deploying the Backend to Render

1. Create a new **Web Service** in [Render Dashboard](https://dashboard.render.com).
2. Connect your `BucketSpace` repository.
3. Configure settings:
   - **Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Health Check Path**: `/api/health`
4. Set Environment Variables in Render:
   - `TELEGRAM_API_ID`: Your Telegram API ID
   - `TELEGRAM_API_HASH`: Your Telegram API Hash
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`
   - `NODE_ENV`: `production`
5. Note your Render service URL (e.g. `https://bucketspace-backend.onrender.com`).

### Deploying the Frontend to Vercel

1. Import the `BucketSpace` repository into [Vercel](https://vercel.com).
2. Framework Preset: **Next.js** (auto-detected).
3. Set Environment Variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: `https://bucketspace-backend.onrender.com` (your Render URL)
4. Click **Deploy**.

For detailed deployment instructions and production configuration, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Security Model

- **Client-Side Cryptography**: File encryption uses standard AES-256-GCM with unique 12-byte initialization vectors generated via `window.crypto.getRandomValues`.
- **Key Isolation**: Master encryption keys are stored exclusively in browser `localStorage` (`bucketspace_master_encryption_key`). Neither the backend relay nor Telegram servers receive the key.
- **No Database Footprint**: The backend does not maintain a database of file catalogs, user passwords, or phone numbers. All file metadata resides on the user's client device.
- **Strict Session Scoping**: The backend processes Telegram operations via per-request `x-telegram-session` headers with zero cross-tenant session sharing.
- **Origin-Enforced CORS**: The backend rejects API requests from unauthorized web origins.

Detailed security documentation is available in the `/context` directory:
- [`context/SECURITY_AUDIT.md`](context/SECURITY_AUDIT.md) — Cryptographic architecture and audit findings.
- [`context/THREAT_MODEL.md`](context/THREAT_MODEL.md) — Threat modeling and security boundaries.
- [`context/SECURITY_INVARIANTS.md`](context/SECURITY_INVARIANTS.md) — Enforced system invariants.

---

## Repository Structure

```
BucketSpace/
├── src/
│   ├── app/                 # Next.js 15 App Router pages, layouts, and API routes
│   │   ├── api/v1/          # Telegram auth, MTProto chunk, vault, and share routes
│   │   ├── privacy/         # Dedicated /privacy disclosure route
│   │   ├── s/ & share/      # Public token share preview & download routes
│   │   ├── layout.tsx       # Root layout, fonts, and accessibility skip-link
│   │   └── page.tsx         # Main application entry point & onboarding gate
│   ├── components/          # Modular UI components (modals, file grid, clouds, sidebar)
│   ├── lib/                 # Storage store, Web Crypto SHA-256, error humanizer
│   ├── modules/
│   │   ├── security/        # Client-side AES-256-GCM encryption service
│   │   └── storage/         # Telegram MTProto adapter, connection pool & routing
│   ├── shared/              # Domain types, byte utilities, and chunk definitions
│   └── middleware.ts        # Production CORS origin validation middleware
├── tests/                   # 38 unit test suites (chunking, crypto, auth, shares)
├── context/                 # Architecture specifications, runbooks, and project state
├── LICENSE                  # Apache License 2.0
├── PRIVACY.md               # Technical Privacy Policy & data handling disclosures
├── DEPLOYMENT.md            # Production Vercel + Render deployment specification
└── package.json             # Pinned dependencies & runtime scripts
```

---

## Privacy Policy & Legal

- **Open Source License**: BucketSpace is released under the **[Apache License 2.0](LICENSE)**.
- **Privacy Disclosures**: Our technical data handling practices are transparently documented in **[`PRIVACY.md`](PRIVACY.md)** and accessible in-app at **[`/privacy`](src/app/privacy/page.tsx)**.
- **Notice**: BucketSpace is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Telegram FZ-LLC or Telegram Messenger Inc.

---

## Author & Contact

Developed by **Vanraj Solanki**  
- **Email**: [vanrajsolanki2875@gmail.com](mailto:vanrajsolanki2875@gmail.com)  
- **GitHub**: [@vanrajsinh650](https://github.com/vanrajsinh650)
