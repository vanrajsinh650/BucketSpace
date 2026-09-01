# Repository Structure & Codebase Architecture (06_REPOSITORY_STRUCTURE.md)

## 1. Architecture Summary
**BucketSpace** is structured as a streamlined, self-contained Next.js 15 full-stack application. It uses a single root workspace with domain-driven modules inside `src/`, eliminating monorepo overhead while preserving clean separation of concerns.

---

## 2. Directory Tree Map

```
BucketSpace/
├── src/
│   ├── app/                         # Next.js 15 App Router Routes & Handlers
│   │   ├── api/v1/                  # Built-in Route Handlers
│   │   │   ├── healthz/route.ts
│   │   │   └── telegram/auth/       # Telegram MTProto Authentication API
│   │   │       ├── send-code/route.ts
│   │   │       ├── verify-code/route.ts
│   │   │       └── verify-2fa/route.ts
│   │   ├── s/[token]/page.tsx       # Public Share Link Viewer
│   │   ├── globals.css              # Tailwind CSS & Theme Setup
│   │   ├── layout.tsx               # Root Shell Layout
│   │   └── page.tsx                 # Main Personal Cloud Drive Dashboard
│   ├── components/                  # React UI Components
│   │   ├── Header.tsx               # Minimalist Top Navigation & Quota Indicator
│   │   ├── Sidebar.tsx              # Vault Navigation & Provider Badges
│   │   ├── FileGrid.tsx             # File Grid & Folder Hierarchy Explorer
│   │   ├── FileCard.tsx             # Individual File Node Card
│   │   ├── UploadModal.tsx          # Multi-Part Chunked Uploader
│   │   ├── ProviderOnboardingModal.tsx # Telegram Connect Modal
│   │   ├── OnboardingLandingPage.tsx# High-Impact Hero Landing Page
│   │   └── ...                      # Modals, Video Player & Previews
│   ├── modules/                     # Core Business Domain Modules
│   │   ├── db/                      # SQLite Metadata & Ledger Storage
│   │   │   ├── database.ts
│   │   │   ├── sqlite-metadata-repository.ts
│   │   │   └── ...
│   │   ├── security/                # Cryptography & Vault Security
│   │   │   ├── envelope-vault.ts    # AES-256-GCM Zero-Knowledge Encryption
│   │   │   └── passcode-hasher.ts   # Scrypt Key Derivation
│   │   └── storage/                 # Telegram MTProto & File Chunk Engine
│   │       ├── telegram/            # GramJS MTProto 2.0 Client & Auth Service
│   │       ├── transfer/            # File Chunker & Transfer Orchestrator
│   │       └── redundancy/          # SHA-256 Integrity Verification & Recovery
│   ├── shared/                      # Shared Types, Zod Schemas & Domain Models
│   ├── hooks/                       # Custom React Hooks
│   └── lib/                         # Client Stores & Utility Helpers
│       ├── storage-store.ts         # Zustand Main Drive State
│       └── utils.ts                 # Classname & String Helpers
├── context/                         # Active Architectural Specifications & Docs
├── package.json                     # Standalone Next.js App Dependencies & Scripts
├── tsconfig.json                    # Path-Mapped TypeScript Configuration (@/*)
├── next.config.js                   # Next.js 15 Configuration
├── tailwind.config.js               # Tailwind Styling Rules
└── README.md                        # Project Setup & Guide
```

---

## 3. Key Design Principles
1. **Single Unified Process**: Run `pnpm dev` or `npm run dev` to start the entire web dashboard and Telegram API backend together on port 3000.
2. **Clean Path Aliases**: All imports use standard `@/*` paths (e.g. `@/modules/storage`, `@/modules/security`, `@/components`).
3. **Pure Telegram Focus**: Zero multi-cloud or AI bloat; focused purely on Telegram MTProto 2.0 unlimited personal storage.
