# Technology Stack & Selection Justification (05_TECH_STACK.md)

## 1. Executive Summary & Selection Philosophy
Every technology in **BucketSpace** is selected based on performance, security, zero-cost self-hosting, developer productivity, and local privacy.

---

## 2. Core Tech Stack Decision Matrix

| Tier | Chosen Technology | Version | Primary Purpose | Key Alternatives Considered & Rejected |
|---|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | `15.x` | React 19, Server Components, Streaming UI | Vite SPA (no SSR/SEO). |
| **Styling Engine** | Tailwind CSS | `3.4.x` | Minimalist monochrome design tokens | Styled Components (runtime overhead). |
| **State Management** | Zustand | `v5.x` | Client reactive store and provider management | Redux Toolkit (verbose boilerplate). |
| **Backend API Gateway** | Fastify + TypeScript | `v4.x` | High-throughput local REST API & Telegram bridge | Express (slower throughput). |
| **Primary Database** | SQLite (`node:sqlite` / `better-sqlite3`) | `3.x` | Local ACID metadata, WAL mode, foreign keys | PostgreSQL (heavy external daemon requirement). |
| **Storage Backend** | Telegram MTProto (GramJS) & Bot API | `2.x` | Unlimited zero-cost private cloud storage | AWS S3 / Cloudflare R2 (recurring monthly cost). |
| **Encryption Engine** | WebCrypto / Node Crypto | Native | AES-256-GCM envelope encryption & scrypt | Third-party crypto libraries (higher attack surface). |

---

## 3. Technology Tier Deep Dives

### 3.1 Storage Layer: GramJS MTProto 2.0
- **Why Chosen**: GramJS connects directly to Telegram's distributed MTProto 2.0 datacenters via TCP/WebSockets, bypassing the 50MB Bot API limitation and supporting up to 2GB per document chunk with parallel part uploads.
- **Benefits**: Infinite storage with zero infrastructure bill.

### 3.2 Database Layer: Embedded SQLite with WAL Mode
- **Why Chosen**: Embedded SQLite runs in-process with zero external server dependencies, providing ACID transactional integrity with sub-millisecond query latencies.
- **Benefits**: Portable database snapshots that can be exported, backed up, and restored on any machine.

---

## 4. Cross-References
- System Architecture: [04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/04_SYSTEM_ARCHITECTURE.md)
- Database Schema Specification: [09_DATABASE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/09_DATABASE.md)
- Repository Structure: [06_REPOSITORY_STRUCTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/06_REPOSITORY_STRUCTURE.md)

