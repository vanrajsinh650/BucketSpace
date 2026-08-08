# 🚀 BucketSpace — 100% Open-Source AI-First Multi-Cloud Drive

**BucketSpace** is an ultra-secure, high-performance, open-source **Telegram Cloud Drive & Multi-Cloud Storage Workspace** built with Next.js 15, Fastify, PostgreSQL (pgvector), and pnpm monorepo architecture.

---

## ✨ Features

- 📁 **Telegram Private Channel Storage**: Use Telegram private channels as an encrypted, unlimited cloud drive storage layer.
- ☁️ **Universal Multi-Cloud Adapters**: Unified `IStorageProvider` interface supporting **Telegram**, **Google Cloud Storage (GCP)**, **Azure Blob Storage**, and **AWS S3 / Cloudflare R2**.
- 🎬 **HLS Video Streaming**: Dynamic `.m3u8` video playlist and TS segment streaming for instant in-browser preview without downloading full files.
- ⚡ **Real-Time WebSocket Presence & CRDT**: Fastify WebSocket server supporting multi-user presence badges, dynamic live cursors, and Last-Write-Wins (LWW) conflict resolution.
- 🧠 **Multimodal AI Intelligence**:
  - **Whisper Speech-to-Text**: Automatic transcription of audio & video files.
  - **Document OCR**: Text extraction from PDFs and image documents.
  - **`pgvector` Cosine Semantic Search**: Search files by concept, content, or natural language query.
- 🔄 **Automated Cross-Cloud Bucket Sync**: Declarative bucket replication policies and automated background sync jobs across storage providers.
- 📊 **Enterprise Automation & Governance**:
  - **Multi-Cloud Cost Analytics Engine**: Real-time storage cost breakdown and auto-optimization recommendations.
  - **Lifecycle Policy Engine**: Automated file age/size migration rules and soft-deletion tiering.
  - **SOC 2 & HIPAA Cryptographic Compliance Exporters**: SHA-256 HMAC tamper-evident audit log export.

---

## 🛠️ Repository Architecture

```text
BucketSpace/
├── apps/
│   ├── api/            # Fastify REST & WebSocket API Gateway
│   └── web/            # Next.js 15 App Router + Tailwind Glassmorphic UI
├── packages/
│   ├── db/             # Prisma DB Schema & pgvector Client
│   ├── shared/         # Zod Schemas & Shared Types/Utilities
│   └── storage-adapters/ # Universal Provider Adapters (Telegram, GCP, Azure, S3)
└── context/            # Architectural & Project Documentation Hub
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `>= 22.0.0`
- **pnpm**: `>= 9.0.0`
- **PostgreSQL**: PostgreSQL 16+ with `pgvector` extension enabled.

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/vanrajsinh650/BucketSpace.git
   cd BucketSpace
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` with your PostgreSQL database connection string and Telegram Bot token.*

4. **Initialize Database**:
   ```bash
   pnpm --filter ./packages/db db:push
   ```

5. **Type Check & Lint**:
   ```bash
   pnpm type-check
   ```

6. **Start Development Servers**:
   ```bash
   pnpm dev
   ```
   * Web Workspace: `http://localhost:3000`
   * API Gateway & WebSocket: `http://localhost:4000`

---

## 🛡️ License

Distributed under the **MIT License**. Open-source and free for all to use, modify, and distribute.
