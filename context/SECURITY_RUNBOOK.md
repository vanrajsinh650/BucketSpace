# BucketSpace 1.0 Security Operations Runbook

This runbook guides operators and developers on managing security incidents, credential rotations, session compromises, and disaster recovery.

---

## 1. Telegram Account Compromise Response

1. **Assess Encryption Mode**:
   - If files were stored with **Client-Side Encryption (Mode B)**: Stored files on Telegram are encrypted ciphertext under AES-256-GCM. The attacker cannot decrypt them without the master passphrase.
2. **Revoke Active Sessions in Official Telegram App**:
   - Open Telegram Settings $\rightarrow$ Devices $\rightarrow$ Terminate all other sessions.
3. **Re-key BucketSpace MTProto Session**:
   - In BucketSpace Settings $\rightarrow$ Reconnect Telegram $\rightarrow$ log in again with new phone SMS / 2FA code to issue a fresh `StringSession`.
4. **Trigger Redundancy Health Audit**:
   - Run `VerificationEngine.verifyAll()` to detect if any chunks were deleted from Telegram.
   - If chunks were deleted, trigger `RepairEngine.repairFile()` from replica providers (S3, Supabase, Local Disk).

---

## 2. Master Key Rotation Procedure

1. Open CLI or Settings: `bucketspace rekey <old-passphrase> <new-passphrase>`
2. `EnvelopeEncryptionVault.reEncryptCredentials(oldPass, newPass)`:
   - Decrypts each DEK using the old KEK (scrypt $N=131072$).
   - Derives a fresh KEK with a new 16-byte cryptographically random salt.
   - Re-encrypts each DEK with the new KEK.
   - **Zero Payload Re-encryption**: Large chunk blobs do not need to be re-downloaded or re-uploaded.

---

## 3. Disaster Recovery Restoration Procedure

1. **Restore Snapshot on Clean Machine**:
   - `bucketspace restore --snapshot <path-to-snapshot.json>`
2. **Re-enter Master Passphrase**:
   - Unlocks the SQLite credential vault.
3. **Re-connect Storage Providers**:
   - Probes provider endpoints and verifies chunk existence and SHA-256 hashes.
4. **Verify Database Integrity**:
   - Reconstructs FTS5 search index and vector index.
