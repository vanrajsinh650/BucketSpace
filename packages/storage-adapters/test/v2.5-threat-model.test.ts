import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { sanitizeFilename } from '@bucketspace/shared';
import { EnvelopeEncryptionVault } from '@bucketspace/security';
import { createSqliteDatabase, AuditLogRepository } from '@bucketspace/db';
import { TokenShareProvider } from '../src';

/* ─── V2.5 Security & Threat Model Test Suite ─── */

test('V2.5 — Path Traversal Rejection & Storage Sandboxing', async () => {
  // Test directory traversal sanitization
  assert.strictEqual(sanitizeFilename('../../../../etc/passwd'), 'passwd');
  assert.strictEqual(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe');
});

test('V2.5 — Share Tokens Hashed at Rest (256-bit Random Token & SHA-256 Invariant)', async () => {
  const shareProvider = new TokenShareProvider();
  const fileId = 'file-sec-999';

  const share = await shareProvider.createShareLink(fileId);

  // 1. Raw token length check: 256-bit = 32 bytes = 64 hex chars
  assert.strictEqual(share.shareId.length, 64);

  // 2. Computed SHA-256 token hash
  const computedHash = TokenShareProvider.hashToken(share.shareId);
  assert.ok(computedHash);

  // 3. Raw token is NOT stored plain text in the internal storage map
  const internalMap = (shareProvider as unknown as { shares: Map<string, unknown> }).shares;
  assert.strictEqual(internalMap.has(share.shareId), false);
  assert.strictEqual(internalMap.has(computedHash), true);

  // 4. Verification & download consume via raw token
  const retrieved = await shareProvider.getShareLink(share.shareId);
  assert.ok(retrieved);
  assert.strictEqual(retrieved?.fileId, fileId);

  // 5. Revocation via raw token removes the hashed entry
  const revoked = await shareProvider.revokeShareLink(share.shareId);
  assert.strictEqual(revoked, true);
  assert.strictEqual(internalMap.has(computedHash), false);
});

test('V2.5 — Filename Sanitization & Control Character Guardrails', () => {
  // 1. Null byte & directory traversal stripping
  assert.strictEqual(
    sanitizeFilename('../../../dangerous\x00file.png'),
    'dangerousfile.png'
  );

  // 2. Windows reserved filename protection
  assert.strictEqual(sanitizeFilename('CON.txt'), '_CON.txt');
  assert.strictEqual(sanitizeFilename('NUL'), '_NUL');
  assert.strictEqual(sanitizeFilename('aux.pdf'), '_aux.pdf');

  // 3. Control character stripping
  assert.strictEqual(
    sanitizeFilename('bad\x01\x1fcharacter.docx'),
    'badcharacter.docx'
  );

  // 4. Empty/whitespace fallback
  assert.strictEqual(sanitizeFilename('...   '), 'unnamed_file');
});

test('V2.5 — Audit Logging Subsystem (Append-Only SQLite Event Trail)', () => {
  const db = createSqliteDatabase(':memory:');
  const auditRepo = new AuditLogRepository(db);

  // Log events
  auditRepo.logEvent('UPLOAD', { fileId: 'f1', size: 1024 }, 'user-alice');
  auditRepo.logEvent('DOWNLOAD', { fileId: 'f1' }, 'user-bob');
  auditRepo.logEvent('SHARE_CREATED', { shareId: 's1', fileId: 'f1' }, 'user-alice');
  auditRepo.logEvent('CREDENTIAL_ROTATED', { providerId: 'telegram' }, 'SYSTEM');

  // Query total count
  assert.strictEqual(auditRepo.countEvents(), 4);
  assert.strictEqual(auditRepo.countEvents('UPLOAD'), 1);
  assert.strictEqual(auditRepo.countEvents('SHARE_CREATED'), 1);

  // Query events list
  const events = auditRepo.listEvents();
  assert.strictEqual(events.length, 4);

  // Filter by event type
  const uploads = auditRepo.listEvents({ eventType: 'UPLOAD' });
  assert.strictEqual(uploads.length, 1);
  assert.strictEqual(uploads[0].actor, 'user-alice');
  assert.strictEqual(uploads[0].details.fileId, 'f1');
});

test('V2.5 — Master Key Rotation & Credential Re-Encryption (Zero Payload Re-Encryption)', () => {
  const vault = new EnvelopeEncryptionVault();
  const credentialSecret = 's3-secret-access-key-998877665544332211';
  const oldPassphrase = 'OldMasterPassphrase2026!';
  const newPassphrase = 'NewMasterPassphrase2027!';

  // 1. Initial encryption
  const initialPayload = vault.encryptCredential(credentialSecret, oldPassphrase);

  // 2. Perform key rotation
  const rekeyedPayload = vault.rekeyCredential(initialPayload, oldPassphrase, newPassphrase);

  // 3. Verify ciphertext remains untouched
  assert.strictEqual(rekeyedPayload.ciphertext, initialPayload.ciphertext);

  // 4. Verify old passphrase CANNOT decrypt rekeyed credential
  assert.throws(
    () => vault.decryptCredential(rekeyedPayload, oldPassphrase),
    /Authentication\/Decryption failed/
  );

  // 5. Verify new passphrase CAN decrypt rekeyed credential
  const decrypted = vault.decryptCredential(rekeyedPayload, newPassphrase);
  assert.strictEqual(decrypted, credentialSecret);
});
