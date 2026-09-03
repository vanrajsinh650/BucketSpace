# BucketSpace — Production Deployment Guide

This document specifies the verified deployment architecture, configuration parameters, and operational runbook for deploying BucketSpace across **Vercel** (Frontend) and **Render** (Telegram MTProto Backend).

---

## 1. Architecture Overview

BucketSpace employs a distributed deployment topology separating stateless frontend assets from long-running MTProto socket operations:

```
┌────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend)                    │
│                                                        │
│  - Static & SSR Next.js Pages (/, /s/[token])          │
│  - Client-Side AES-256-GCM Zero-Knowledge Encryption   │
│  - WebCrypto SHA-256 Digest Calculations               │
│  - Browser File Slicing (16 MB Chunks)                 │
│  - localStorage Metadata & Resumable Upload State      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / Multipart Stream
                            ▼
┌────────────────────────────────────────────────────────┐
│               RENDER (Telegram Backend)                │
│                                                        │
│  - Long-running Node.js 22 Web Service                 │
│  - MTProto 2.0 TCP Connection Pool (GramJS)            │
│  - 6-Worker Parallel MTProto Part Streaming            │
│  - Private Storage Vault Provisioning                  │
│  - CORS Middleware (restricting access to Vercel)      │
│  - Liveness Health Endpoint (/api/health)              │
└───────────────────────────┬────────────────────────────┘
                            │ MTProto 2.0 Encrypted Transport
                            ▼
┌────────────────────────────────────────────────────────┐
│                 TELEGRAM DATA CENTERS                  │
│                                                        │
│  - 📦 BucketSpace Vault (Archived Private Channel)     │
│  - Unbounded Cloud Object Storage                      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Vercel Setup (Frontend)

1. Connect the GitHub repository to [Vercel](https://vercel.com).
2. Framework Preset: **Next.js** (auto-detected).
3. Root Directory: `./`
4. Node.js Version: **22.x** (configured via `.nvmrc` and `engines`).
5. **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://<your-render-service>.onrender.com` | Target Render backend URL for Telegram APIs |
6. Click **Deploy**.

---

## 3. Render Setup (Telegram MTProto Backend)

1. In [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service** (or use the included `render.yaml` Blueprint).
2. Connect your GitHub repository.
3. **Configuration Settings**:
   - **Name**: `bucketspace-backend`
   - **Language**: `Node`
   - **Region**: Select closest to your users (e.g. `Oregon`, `Frankfurt`)
   - **Branch**: `main`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Plan**: `Starter` (or higher — requires persistent Node process for connection pooling)
   - **Health Check Path**: `/api/health`
4. **Environment Variables**:
   | Variable | Value | Classification | Description |
   | :--- | :--- | :--- | :--- |
   | `TELEGRAM_API_ID` | `<your-api-id>` | **SERVER SECRET** | App API ID from my.telegram.org |
   | `TELEGRAM_API_HASH` | `<your-api-hash>` | **SERVER SECRET** | App API Hash from my.telegram.org |
   | `CORS_ORIGINS` | `https://<your-app>.vercel.app,http://localhost:3000` | Config | Comma-separated allowed Vercel origins |
   | `UPLOAD_TIMEOUT_MS` | `300000` | Config | Upload socket timeout in ms (default: 5 min) |
   | `NODE_ENV` | `production` | Config | Production environment flag |
   | `NODE_VERSION` | `22` | Config | Pinned Node.js 22 runtime |

---

## 4. Environment Variable Specification

### Public Client Variables (Vercel & Local)
These variables are prefixed with `NEXT_PUBLIC_` and may be bundled into browser JavaScript:
- `NEXT_PUBLIC_API_URL`: Origin of the backend service handling Telegram chunk routing. In development, leave empty to use the same-origin proxy.

### Server Secrets (Render Only)
These variables are strictly private and must **never** be prefixed with `NEXT_PUBLIC_` or committed:
- `TELEGRAM_API_ID`: Numeric Telegram developer ID.
- `TELEGRAM_API_HASH`: Hexadecimal Telegram developer secret hash.
- `CORS_ORIGINS`: Comma-separated list of allowed origins.
- `UPLOAD_TIMEOUT_MS`: Timeout for MTProto chunk uploads.

---

## 5. Build & Start Commands

```bash
# Package Installation
pnpm install

# TypeScript Typecheck
npm run type-check   # (tsc --noEmit)

# Automated Test Suite
npm run test

# Production Build
npm run build        # (next build)

# Production Startup (binds to 0.0.0.0 and respects $PORT)
npm run start        # (next start -H 0.0.0.0)
```

---

## 6. Health-Check Endpoints

BucketSpace exposes two lightweight liveness endpoints:
- **`GET /api/health`**: Dedicated Render health-check route. Returns HTTP 200 with server status and uptime in <5ms without touching Telegram.
- **`GET /api/v1/healthz`**: Standard container orchestration health probe.

Both endpoints return:
```json
{
  "status": "ok",
  "service": "bucketspace",
  "timestamp": "2026-09-03T09:00:00.000Z"
}
```

---

## 7. CORS Configuration

CORS is enforced via [`src/middleware.ts`](file:///home/vanrajsinh/Projects/BucketSpace/src/middleware.ts) across all `/api/:path*` routes:
- Origins are validated against `process.env.CORS_ORIGINS`.
- Supports exact origins (`https://bucketspace.vercel.app`) and wildcard subdomains (`*.vercel.app`).
- Preflight `OPTIONS` requests respond with `HTTP 204` and allowed headers (`Content-Type`, `Authorization`, `x-telegram-session`).
- Wildcard `Access-Control-Allow-Origin: *` is **never** used on authenticated routes.

---

## 8. Telegram Credentials & Security

1. **Obtaining Credentials**:
   - Go to [my.telegram.org](https://my.telegram.org).
   - Log in with your primary Telegram phone number.
   - Click **API development tools**.
   - Create an application to obtain `api_id` and `api_hash`.
2. **Security Rules**:
   - Never commit `.env` or `.env.local` to Git.
   - Never prefix Telegram credentials with `NEXT_PUBLIC_`.
   - Never send `api_hash` to the browser.
   - Authentication session strings are passed strictly via the `x-telegram-session` HTTP header, never in URL query strings.

---

## 9. Local Development Workflow

1. Clone repository and install dependencies:
   ```bash
   pnpm install
   ```
2. Copy configuration template:
   ```bash
   cp .env.example .env.local
   ```
3. Populate `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `.env.local`.
4. Start development server:
   ```bash
   pnpm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

---

## 10. Production Smoke Test

Run the automated pre-flight validation script before releasing:
```bash
./scripts/validate-production.sh
```
This script validates:
1. TypeScript compilation (`tsc --noEmit`)
2. Complete test suite (`npm run test`)
3. Production compilation (`npm run build`)
4. Background server startup on port `3999`
5. `/api/health` response verification
6. CORS preflight simulation
7. Unauthenticated request rejection

---

## 11. Known Architectural Limitations

1. **Single-User Session Model**:
   Telegram MTProto sessions are user-owned. Each browser stores its active `sessionString` in `localStorage` and passes it in the `x-telegram-session` header. The server pools connections by session token, ensuring multi-user isolation. However, there is no centralized multi-tenant database or team permission model.
2. **Ephemeral Shares in MVP**:
   The `/api/v1/shares` endpoint maintains active shares in memory (`globalThis`). A Render restart will reset active share tokens unless backed by persistent Redis or SQLite.
3. **Ephemeral SQLite**:
   The metadata repository defaults to `node:sqlite` in memory. Browser metadata is persisted client-side in `localStorage`. Disasters can be recovered via the Disaster Recovery JSON Snapshot feature in the UI.

