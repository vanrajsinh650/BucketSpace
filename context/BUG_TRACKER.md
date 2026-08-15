# BucketSpace Engineering Bug & Issue Tracker (BUG_TRACKER.md)

This document is the authoritative record of all functional bugs, integrity flaws, architectural defects, and UX errors identified during development and testing, along with their root causes, remediations, and automated regression tests.

---

## 1. Bug Registry

### BUG-001: Fake MTProto Pseudo-ID Stub & Empty Byte Generator
* **Component**: `packages/storage-adapters/src/telegram/telegram-storage-provider.ts`
* **Reported Issue**: Telegram MTProto mode was generating simulated random document IDs (`doc_${chunkId}_...`) without performing actual MTProto uploads, and `getChunk()` yielded empty `Uint8Array(0)` streams.
* **Root Cause**: Early development stub that simulated async upload success without connecting to Telegram DCs.
* **Remediation**:
  1. Replaced the stub with real GramJS `TelegramClient` and `StringSession` handling.
  2. Implemented real `uploadFile` (with 4 worker streams), `sendFile`, and `iterDownload` byte streaming.
  3. Added bounded 512 KB part chunking and `FloodWaitError` backoff handling.
* **Status**: **RESOLVED** (Pending live cloud credential validation)

---

### BUG-002: Subarray Backing-Buffer Offset Hash Mismatch
* **Component**: `apps/web/src/lib/storage-store.ts` (`calculateSha256`)
* **Reported Issue**: Multi-chunk file previews and downloads threw `Chunk 0 hash mismatch during preview reassembly!` and `Download Error: Chunk 0 hash mismatch during download!`, even though UI showed chunks verified.
* **Root Cause**:
  - `calculateSha256(data)` passed `data.buffer as ArrayBuffer` to `crypto.subtle.digest('SHA-256', ...)`.
  - When `fileBuffer.subarray(start, end)` creates a chunk slice, `chunk.buffer` references the entire 15+ MB file `ArrayBuffer`, ignoring `byteOffset` and `byteLength`.
  - **Upload time**: `chunk.hash` computed the hash of the **entire file**.
  - **Download time**: `provider.getChunk()` returned fresh standalone chunks where `chunk.buffer` equaled chunk size, computing the hash of the **chunk slice**.
  - Hashes failed to match on every multi-chunk file.
* **Remediation**:
  1. Updated `calculateSha256()` to strictly slice the underlying buffer using `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer`.
  2. Fixed `FilePreviewModal.tsx` Blob constructor which had a similar `.buffer` reference.
  3. Added dedicated regression suite asserting `SHA256(chunkSlice) !== SHA256(fullBuffer)` and verifying whole-file and chunk-level bit-for-bit equality across `InMemoryStorageProvider` and `LocalStorageAdapter`.
* **Regression Tests**: `packages/storage-adapters/test/subarray-slice-integrity.test.ts` (3 tests)
* **Status**: **RESOLVED**

---

### BUG-003: Next.js Production Build Desync & Hydration Loading Freeze
* **Component**: `apps/web/src/app/page.tsx`
* **Reported Issue**: Frontend stuck indefinitely displaying `Loading BucketSpace…` with no UI rendering.
* **Root Cause**:
  1. Running `next build` while `next dev` was active in the background updated the static chunk hashes on disk.
  2. Browser requests for `main-app.js` and `app-pages-internals.js` returned HTTP 404, preventing client-side JavaScript from executing.
  3. `page.tsx` initialized `store` inside `useEffect()`, which never fired because hydration was blocked.
* **Remediation**:
  1. Updated `page.tsx` to initialize `StorageStore` synchronously via `useState(() => StorageStore.getInstance())`.
  2. Cleared `.next` cache and restarted clean development server.
* **Status**: **RESOLVED**

---

### BUG-004: Duplicate Phone Number Preview Text in Telegram Onboarding
* **Component**: `apps/web/src/components/PhoneInputWithCountry.tsx`
* **Reported Issue**: Telegram connect screen displayed the user's phone number twice (once inside the input box and once below it as `+91 5169919191`).
* **Root Cause**: A redundant helper text footer element in `PhoneInputWithCountry.tsx` re-rendered the combined dial code and national digits below the field.
* **Remediation**: Removed the duplicate preview text element, leaving only the clean country selector button (`IN +91 ▾`) and single national number input.
* **Status**: **RESOLVED**

---

### BUG-005: Developer Jargon & Complex Capability Metrics in Consumer UI
* **Component**: `ProviderOnboardingModal.tsx`, `ProviderSettings.tsx`, `FilePreviewModal.tsx`
* **Reported Issue**: UI exposed developer-level internals (MTProto vs Bot API, API ID, API Hash, single object caps, parallel stream counts, latency in milliseconds, raw SHA-256 error messages).
* **Root Cause**: UI was initially structured as a storage-engine diagnostic console rather than a consumer cloud drive.
* **Remediation**:
  1. Redesigned Telegram onboarding to a simple 3-step flow (Phone → Code → 2FA Password if needed).
  2. Moved API ID/Hash to application configuration.
  3. Replaced raw error strings with human-friendly alerts and expandable `[Technical details]` sections.
  4. Added First-Run Onboarding Gate that blocks empty drive rendering until at least one provider is connected.
* **Status**: **RESOLVED**
