# BucketSpace 1.0 Vulnerability Findings & Remediation Inventory

Every vulnerability found during the red-team audit is recorded here with its root cause, severity, impact, remediation, and regression test.

---

### SEC-01: Plaintext Share Token in Stored Record Structure
- **Severity**: HIGH
- **Component**: `packages/storage-adapters/src/share/token-share-provider.ts`
- **Attack Scenario**: An attacker who dumps the `this.shares` map or SQLite table could read the `shareId` property which contained the unhashed raw token string, allowing them to bypass access restrictions and download shared files.
- **Root Cause**: `shareLink.shareId` was assigned `rawToken` for caller convenience, but the object was stored directly in the at-rest map.
- **Remediation**: `shareId` is assigned an opaque hash prefix `share_<hash>`, and only `tokenHash` is stored at rest. `rawToken` is returned only once to the creator.
- **Regression Test**: `packages/storage-adapters/test/v1.0-security-redteam.test.ts` (Invariant S20)
- **Status**: **RESOLVED**

---

### SEC-02: Next.js Client-side Secret Environment Prefix
- **Severity**: MEDIUM
- **Component**: `apps/web/src/lib/storage-store.ts`
- **Attack Scenario**: Public users inspecting client-side JS bundles in a production deployment could extract `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` if defined in `.env`.
- **Root Cause**: `NEXT_PUBLIC_` prefix bakes environment variables into browser JavaScript bundles.
- **Remediation**: Removed `NEXT_PUBLIC_` secret references from `storage-store.ts`. Enforced server-side API or encrypted SQLite vault for provider credentials.
- **Regression Test**: `pnpm --filter "@bucketspace/web" build` + secret scanning.
- **Status**: **RESOLVED**

---

### SEC-03: Telegram MTProto StringSession High-Sensitivity Protection
- **Severity**: HIGH
- **Component**: `packages/storage-adapters/src/telegram/telegram-storage-provider.ts`
- **Attack Scenario**: An attacker stealing a `StringSession` could execute arbitrary MTProto operations under the user's Telegram identity.
- **Root Cause**: `StringSession` encodes the full user authentication key and server salt.
- **Remediation**: `StringSession` is encrypted using `EnvelopeEncryptionVault` (AES-256-GCM + scrypt master key) before persistence; never exposed to browser state, URLs, or error logs.
- **Regression Test**: `packages/storage-adapters/test/v1.0-security-redteam.test.ts` (Invariant S7, S10)
- **Status**: **RESOLVED**

---

### SEC-04: LocalDisk Path Traversal & Symlink Escape
- **Severity**: HIGH
- **Component**: `packages/storage-adapters/src/local/local-storage-provider.ts`
- **Attack Scenario**: Malicious chunk ID containing `../../../../etc/passwd` or symlink pointing outside the root directory.
- **Root Cause**: Unsandboxed filesystem path resolution.
- **Remediation**: `resolveSandboxedPath` enforces `targetPath.startsWith(normalizedRoot + path.sep)` and `fs.realpathSync`.
- **Regression Test**: `packages/storage-adapters/test/v1.0-security-redteam.test.ts` (Invariant S21, S24)
- **Status**: **RESOLVED**

---

### SEC-05: Decompression & Parser Resource Exhaustion
- **Severity**: HIGH
- **Component**: `packages/storage-adapters/src/content/pdf-extractor.ts`, `plain-text-extractor.ts`
- **Attack Scenario**: Giant or infinite streams uploaded to exhaust server memory and trigger OOM crashes.
- **Root Cause**: Unbounded chunk extraction in stream reader.
- **Remediation**: Hard 50 MB extraction limit, stream size bounds, null-byte filtering (`\0`), and graceful error handling.
- **Regression Test**: `packages/storage-adapters/test/v1.0-security-redteam.test.ts` (Invariant S22)
- **Status**: **RESOLVED**

---

### SEC-06: Cross-Tenant RAG Retrieval Leakage & Prompt Injection
- **Severity**: HIGH
- **Component**: `packages/storage-adapters/src/ai/assistant-service.ts`, `hybrid-search-engine.ts`
- **Attack Scenario**: Prompt injection embedded in stored document attempts to query unauthorized files or override system instructions.
- **Root Cause**: Relying on the LLM to filter unauthorized context after retrieval.
- **Remediation**: Application-level authorization excludes unauthorized file IDs **before** FTS/vector search. `PromptInjectionGuard` strips adversarial tokens; `ClaimValidator` audits source citations post-generation.
- **Regression Test**: `packages/storage-adapters/test/v1.0-security-redteam.test.ts` (Invariant S1, S2, S3, S4, S5)
- **Status**: **RESOLVED**
