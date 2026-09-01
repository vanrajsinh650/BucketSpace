# BUCKETSPACE — CODEBASE CLEANUP, DEDUPLICATION & SIMPLIFICATION AUDIT REPORT
**Timestamp**: 2026-09-01T23:08:00+05:30  
**Repository**: `/home/vanrajsinh/Projects/BucketSpace`  
**Status**: AUDIT COMPLETE — REFACTOR PLAN READY

---

## Executive Summary

A comprehensive inventory and audit of the entire BucketSpace codebase was performed. The codebase implements a zero-knowledge personal cloud storage system using Telegram MTProto 2.0 with bounded chunking, cryptographic hashing, SQLite metadata indexing, disaster recovery, and policy-based routing.

While the core architecture is robust and tests currently pass (`pnpm type-check` and `pnpm test` green, Next.js production build green), multiple milestones of AI-assisted iterative development have left behind:
1. **Unused legacy provider adapters and contracts** (an obsolete Bot API `LegacyTelegramStorageAdapter` and `LegacyIStorageProvider` superseded by MTProto 2.0).
2. **Abandoned schema definitions and enterprise mock panels** (unimported enterprise cost analytics, compliance export modals, unused CRDT resolvers, presigned upload schemas).
3. **Duplicated utility logic** (multiple identical implementations of `concatBuffers` / byte slice concatenation across 5 files).
4. **Duplicate type definitions** (`ShareLink` defined with conflicting shapes in `shared/domain/transfers.ts` vs `storage/share/share-provider.interface.ts`).
5. **Architectural / folder fragmentation** (redundant `src/modules/storage/router/` vs `src/modules/storage/routing/` directories).
6. **Latent logic bug in disaster recovery verification** (`BackupManager.verifyRestoredInstallation` checks `!exists` instead of `!exists.exists` on `ChunkStat`).
7. **Redundant dual download paths** (`TransferOrchestrator.downloadFile` vs `downloadFileMultiProvider` duplicating ~70 lines of identical streaming and checksum logic).

---

## Phase 1 — Codebase Inventory Summary

| Category | Count | Files / Subsystems |
|---|---|---|
| **Source Modules** | 35 | `src/modules/db`, `src/modules/security`, `src/modules/storage` |
| **Shared Contracts & Domain** | 16 | `src/shared/domain/*`, `src/shared/schemas/*`, `src/shared/utils/*` |
| **React Components & UI** | 26 | `src/components/*`, `src/components/enterprise/*`, `src/components/storage-rules/*`, `src/components/sync/*` |
| **Pages & Routes** | 7 | `src/app/page.tsx`, `src/app/s/[token]`, `src/app/share/[token]`, API routes (`healthz`, `send-code`, `verify-code`, `verify-2fa`) |
| **Store & Lib Helpers** | 4 | `src/lib/storage-store.ts`, `src/lib/utils.ts`, `src/lib/zip-builder.ts`, `src/hooks/useWebSocketSync.ts` |
| **Test Suites** | 5 | `tests/chunker.test.ts`, `tests/encryption.test.ts`, `tests/share-engine.test.ts`, `tests/sqlite-metadata.test.ts`, `tests/telegram-auth.test.ts` |

---

## 1. Dead Code Candidates

| ID | File | Current Code | Problem | Proposed Canonical Implementation | Risk | Dependencies | Expected Benefit | Test Coverage | Action |
|---|---|---|---|---|---|---|---|---|---|
| DC-01 | `src/modules/storage/provider.interface.ts` | `LegacyIStorageProvider`, `UploadPartPayload`, `UploadPartResult` | Obsolete legacy interface from early Bot API draft; only imported by dead `telegram.adapter.ts`. | Use canonical `IStorageProvider` in `src/shared/domain/providers.ts`. | Very Low | `telegram.adapter.ts` | Eliminates confusion about canonical provider contract. | None (not called) | **DELETE** |
| DC-02 | `src/modules/storage/telegram.adapter.ts` | `LegacyTelegramStorageAdapter` | Unused legacy Telegram Bot API adapter. Production uses `TelegramStorageAdapter` (MTProto 2.0) and `HttpTelegramStorageAdapter`. | Use `TelegramStorageAdapter` in `src/modules/storage/telegram/telegram-storage-provider.ts`. | Very Low | `provider.interface.ts`, `stream.utils.ts` | Removes 240 lines of dead code. | Covered by MTProto tests | **DELETE** |
| DC-03 | `src/modules/storage/stream.utils.ts` | `streamToBuffer` | Helper only imported by deleted `telegram.adapter.ts`. | Not needed. | Very Low | `telegram.adapter.ts` | Removes 41 lines of dead utility code. | None | **DELETE** |
| DC-04 | `src/shared/constants/providers.enum.ts` | `enum ProviderType`, `enum ObjectStatus` | Not imported anywhere in `src/`. Provider IDs are string literals `'telegram'`, `'in-memory'`, etc. | Canonical provider domain contracts in `src/shared/domain/providers.ts`. | Very Low | None | Removes dead enum file and cleans `@/shared` export namespace. | None | **DELETE** |
| DC-05 | `src/shared/crdt.ts` | `resolveLWWConflict`, `MetadataMutationPayload`, `FieldState` | Unused CRDT conflict resolution experiment. Only referenced by unused `useWebSocketSync.ts`. | Not used in current single-user / SQLite ledger architecture. | Very Low | `useWebSocketSync.ts` | Eliminates unused sync mechanism. | None | **DELETE** |
| DC-06 | `src/shared/schemas/upload.schema.ts` | `DirectUploadPresignSchema`, `TelegramChunkUploadSchema` | Zod schemas from an abandoned presigned upload experiment. Never imported by API or frontend. | Request validation in API routes directly. | Very Low | None | Removes 22 lines of dead schema code. | None | **DELETE** |
| DC-07 | `src/shared/schemas/sync.schema.ts` | `CreateSyncPolicySchema`, `TriggerSyncJobSchema` | Zod schemas for multi-bucket sync policies. Never imported anywhere. | Folder auto-sync daemon contracts in `src/shared/domain/sync-events.ts`. | Very Low | None | Removes dead schema code. | None | **DELETE** |
| DC-08 | `src/shared/schemas/enterprise.schema.ts` | `CreateLifecycleRuleSchema`, `ComplianceExportQuerySchema`, cost types | Zod schemas and types for enterprise multi-cloud cost / SOC2 export. Unused. | SQLite audit logs in `src/modules/db/sqlite/audit-log-repository.ts`. | Very Low | None | Removes 95 lines of dead enterprise schema code. | None | **DELETE** |
| DC-09 | `src/components/enterprise/CostAnalyticsPanel.tsx` | `CostAnalyticsPanel` component | Unused UI panel for multi-cloud cost calculations. Not rendered anywhere in `page.tsx` or tabs. | `AnalysisTab.tsx` is the actual storage analysis tab. | Very Low | None | Removes 260 lines of unmounted UI mock code. | None | **DELETE** |
| DC-10 | `src/components/enterprise/GovernanceAuditModal.tsx` | `GovernanceAuditModal` component | Unused modal for SOC2/HIPAA compliance export. Not rendered anywhere. | `AuditLogRepository` in DB layer. | Very Low | None | Removes unmounted UI mock code. | None | **DELETE** |
| DC-11 | `src/components/sync/SyncPolicyPanel.tsx` | `SyncPolicyPanel` component | Unused panel for multi-bucket sync scheduling. Never imported. | `FolderSyncModal.tsx` is the actual working sync daemon UI. | Very Low | None | Removes unmounted UI code. | None | **DELETE** |
| DC-12 | `src/components/media/HLSVideoPlayer.tsx` | `HLSVideoPlayer` component | Unused HLS video player. `FilePreviewModal.tsx` directly renders `<video>` streams. | `FilePreviewModal.tsx`. | Very Low | None | Removes unused media player. | None | **DELETE** |
| DC-13 | `src/hooks/useWebSocketSync.ts` | `useWebSocketSync` hook | WebSocket client hook pointing to external port 4000. Not imported by any component. | Folder auto-sync daemon in `src/modules/storage/sync/`. | Very Low | `src/shared/crdt.ts` | Removes 197 lines of dead hook code. | None | **DELETE** |

---

## 2. Duplicate Functions & Logic

| ID | File | Current Code | Problem | Proposed Canonical Implementation | Risk | Dependencies | Expected Benefit | Test Coverage | Action |
|---|---|---|---|---|---|---|---|---|---|
| DF-01 | `src/modules/storage/redundancy/replication-engine.ts`<br>`src/modules/storage/redundancy/repair-engine.ts`<br>`src/modules/storage/registry/provider-registry.ts`<br>`src/modules/storage/telegram/telegram-storage-provider.ts`<br>`src/lib/storage-store.ts` | `concatBuffers(buffers: Uint8Array[]): Uint8Array` duplicated in 5 separate locations. | Same byte buffer concatenation logic copied with slight variations across engines and store. | Create canonical `concatByteArrays(chunks: Uint8Array[]): Uint8Array` in `src/shared/utils/byte-utils.ts` and import everywhere. | Low | Redundancy engines, store | Eliminates 5 duplicate helper functions; establishes 1 standard zero-copy concatenation utility. | Covered by test suites | **CONSOLIDATE** |
| DF-02 | `src/modules/storage/transfer/transfer-orchestrator.ts` | `downloadFile` and `downloadFileMultiProvider` | `downloadFile` duplicates 90% of `downloadFileMultiProvider` (chunk iteration, streaming, hashing, verification, draining writeStream). | `downloadFileMultiProvider` is strictly more general (resolves chunk provider dynamically). `downloadFile` should delegate directly or use shared stream assembler. | Low | Transfer Orchestrator | Eliminates 60 lines of duplicate transfer pipeline; ensures unified integrity verification across all download modes. | Covered by chunker & transfer tests | **SIMPLIFY** |
| DF-03 | `src/modules/db/sqlite/sqlite-metadata-repository.ts` | `listFiles()` and `searchFiles()` do N+1 queries (`SELECT id` followed by individual `getFileById()` in a loop). | Inefficient N+1 SQLite queries that fetch files and chunks one-by-one in serial iterations. | Batch fetch files and their chunks using standard SQLite query + group mapping. | Low | SqliteMetadataRepository | Dramatically improves listing and search performance while maintaining exact same signature and return type. | `tests/sqlite-metadata.test.ts` | **OPTIMIZE** |
| DF-04 | `src/modules/storage/resilience/backup-manager.ts` (line 127) | `const exists = await provider.hasChunk(c.providerRef); if (!exists) { missingChunks++; }` | **BUG**: `hasChunk` returns `{ exists: boolean }`. `!exists` is always `false` on objects, meaning missing chunks are never detected. | Fix to `if (!exists || !exists.exists)`. | Low | BackupManager | Restores correct integrity verification during disaster recovery audit. | Testable via BackupManager | **FIX BUG** |

---

## 3. Duplicate Types & Contracts

| ID | File | Current Code | Problem | Proposed Canonical Implementation | Risk | Dependencies | Expected Benefit | Test Coverage | Action |
|---|---|---|---|---|---|---|---|---|---|
| DT-01 | `src/shared/domain/transfers.ts` vs `src/modules/storage/share/share-provider.interface.ts` | `ShareLink` defined twice with incompatible fields (`token` vs `shareId` + `url`). | Type confusion across modules consuming share links. | Unify `ShareLink` contract in `src/shared/domain/transfers.ts` with `token: string; url?: string; fileId: FileId | string; ...` and re-export in `share-provider.interface.ts`. | Low | ShareEngine, TokenShareProvider, UI | Single canonical `ShareLink` type throughout the codebase. | `tests/share-engine.test.ts` | **CONSOLIDATE** |
| DT-02 | `src/modules/storage/contracts/storage-provider.ts` | Empty wrapper re-exporting `IStorageProvider`, `PutChunkInput`, etc. from `@/shared`. | Unnecessary extra layer that only re-exports from `@/shared`. | Export directly from `@/shared` or keep minimal alias for backwards compatibility. | Very Low | Storage provider consumers | Removes redundant file / indirection. | `tests/*.test.ts` | **SIMPLIFY** |

---

## 4. Over-Abstraction & Structural Consolidation

| ID | File | Current Code | Problem | Proposed Canonical Implementation | Risk | Dependencies | Expected Benefit | Test Coverage | Action |
|---|---|---|---|---|---|---|---|---|---|
| OA-01 | `src/modules/storage/router/` vs `src/modules/storage/routing/` | `src/modules/storage/router/storage-router.ts` in separate folder from `src/modules/storage/routing/storage-policy-engine.ts` and `rule-matcher.ts`. | Arbitrary split between "router" and "routing" folders. | Move `storage-router.ts` into `src/modules/storage/routing/` and remove empty `router/` folder. Re-export cleanly from `src/modules/storage/index.ts`. | Low | Storage consumers | Consolidates all routing and policy engine logic in one cohesive module folder. | Verified by build & typecheck | **MOVE & CONSOLIDATE** |
| OA-02 | `src/modules/storage/routing/rule-matcher.ts` | `matchesRule` function exported but never used. | Dead exported function. | Remove `matchesRule` or integrate cleanly. | Very Low | StoragePolicyEngine | Cleans up unused export. | Verified by typecheck | **SIMPLIFY** |

---

## 5. Documentation & Metadata Cleanups

| ID | File | Current Code | Problem | Proposed Canonical Implementation | Action |
|---|---|---|---|---|---|
| DOC-01 | `README.md` (lines 108-122) | Shows outdated monorepo layout `apps/api`, `apps/cli`, `apps/web`, `packages/*`. | Mismatches actual unified Next.js + modular architecture (`src/modules/*`, `src/shared/*`, `src/app/*`). | Update README directory diagram to reflect real clean structure. | **UPDATE** |
| DOC-02 | `package.json` | Ignored `pnpm.onlyBuiltDependencies` producing pnpm warnings. | Outdated pnpm config location. | Clean up `pnpm` section in `package.json`. | **UPDATE** |

---

## Refactoring Execution Groups (Phased Plan)

### **Group 1: Dead Code Removal & Namespace Cleanup**
- Delete unreferenced legacy adapters:
  - `src/modules/storage/provider.interface.ts`
  - `src/modules/storage/telegram.adapter.ts`
  - `src/modules/storage/stream.utils.ts`
- Delete unreferenced experimental schemas, hooks, and mock UI panels:
  - `src/shared/constants/providers.enum.ts`
  - `src/shared/crdt.ts`
  - `src/shared/schemas/upload.schema.ts`
  - `src/shared/schemas/sync.schema.ts`
  - `src/shared/schemas/enterprise.schema.ts`
  - `src/hooks/useWebSocketSync.ts`
  - `src/components/enterprise/CostAnalyticsPanel.tsx`
  - `src/components/enterprise/GovernanceAuditModal.tsx`
  - `src/components/sync/SyncPolicyPanel.tsx`
  - `src/components/media/HLSVideoPlayer.tsx`
- Clean `src/shared/index.ts` re-exports.

### **Group 2: Canonical Byte Utility & Deduplication**
- Create `src/shared/utils/byte-utils.ts` with `concatByteArrays(chunks: Uint8Array[]): Uint8Array`.
- Replace all ad-hoc `concatBuffers` loops in `replication-engine.ts`, `repair-engine.ts`, `provider-registry.ts`, `telegram-storage-provider.ts`, and `storage-store.ts`.

### **Group 3: Type Consolidation & Structural Cleanliness**
- Consolidate `ShareLink` definition across `src/shared/domain/transfers.ts` and `src/modules/storage/share/share-provider.interface.ts`.
- Move `src/modules/storage/router/storage-router.ts` into `src/modules/storage/routing/storage-router.ts` and delete obsolete `src/modules/storage/router/` folder.
- Update `src/modules/storage/index.ts`.

### **Group 4: Transfer Orchestrator & Bug Fixes**
- Simplify `TransferOrchestrator.downloadFile` to reuse the multi-provider streaming reassembly pipeline without code duplication.
- Fix `exists.exists` check in `BackupManager.verifyRestoredInstallation`.
- Optimize `SqliteMetadataRepository.listFiles` and `searchFiles` to avoid N+1 queries.

### **Group 5: Documentation & Configuration Alignment**
- Update `README.md` architecture diagram to match the actual codebase structure.
- Clean up `package.json` pnpm configuration.

### **Group 6: Full Verification Suite**
- Run `pnpm type-check`
- Run `pnpm test`
- Run `pnpm build` (Next.js production build)
- Verify zero security or integrity regressions.
- Generate `CODEBASE_CLEANUP_FINAL.md`.
