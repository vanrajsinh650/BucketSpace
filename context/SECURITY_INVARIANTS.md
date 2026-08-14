# BucketSpace 1.0 Security Invariants (S1–S24)

Every security invariant in BucketSpace is an **executable architectural rule** verified in automated regression test suites.

---

## The 24 Master Security Invariants

- **INVARIANT S1**: The LLM cannot access storage providers directly.
- **INVARIANT S2**: The LLM cannot decide authorization.
- **INVARIANT S3**: Unauthorized file IDs are excluded **BEFORE** FTS/vector retrieval.
- **INVARIANT S4**: Unauthorized content never reaches the LLM context.
- **INVARIANT S5**: The LLM cannot delete, replace, migrate, purge, share, rekey, or modify files.
- **INVARIANT S6**: Provider credentials never appear in frontend state, URLs, logs, error messages, analytics, or public responses.
- **INVARIANT S7**: Telegram MTProto sessions are treated as **HIGH-SENSITIVITY** secrets (encrypted at rest, never logged).
- **INVARIANT S8**: BucketSpace encryption keys are never stored in Telegram.
- **INVARIANT S9**: Provider credentials and file-encryption keys are independent.
- **INVARIANT S10**: Compromising Telegram must NOT automatically reveal plaintext BucketSpace-encrypted file contents.
- **INVARIANT S11**: Deleting local metadata must not silently delete provider payloads.
- **INVARIANT S12**: Purging a logical file must revoke all shares and remove all persistent/ephemeral derived artifacts.
- **INVARIANT S13**: A provider failure cannot silently mark unverified data as healthy.
- **INVARIANT S14**: A corrupted chunk can never be served as verified content.
- **INVARIANT S15**: A failed repair cannot overwrite the only healthy copy.
- **INVARIANT S16**: A backup must clearly distinguish metadata/index from payload bytes.
- **INVARIANT S17**: Restoration must verify provider references and checksums.
- **INVARIANT S18**: Duplicate detection cannot silently destroy data.
- **INVARIANT S19**: "Replace" must be an explicit user-authorized operation.
- **INVARIANT S20**: All public share access is authenticated by cryptographically strong tokens and all configured limits are enforced atomically.
- **INVARIANT S21**: Sensitive error messages never disclose credentials, session strings, provider references, encryption keys, or local secret material.
- **INVARIANT S22**: All file parsing is bounded by memory, output, recursion, and time limits.
- **INVARIANT S23**: Provider-specific object limits are enforced at the provider boundary, not as arbitrary global BucketSpace limits.
- **INVARIANT S24**: Security failures fail closed.
