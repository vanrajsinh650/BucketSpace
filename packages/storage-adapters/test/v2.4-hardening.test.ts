import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { EnvelopeEncryptionVault, ScryptPasscodeHasher } from '@bucketspace/security';
import { StorageRule } from '@bucketspace/shared';
import {
  ProviderCircuitBreaker,
  StorageRouter,
  TokenShareProvider,
  TransferQueue,
} from '../src';

/* ─── V2.4 Hardening & Security Master Test Suite ─── */

test('V2.4 — Security: AES-256-GCM Envelope Encryption & Ciphertext Tampering Rejection', () => {
  const vault = new EnvelopeEncryptionVault();
  const secretToken = 'tg-bot-token-9988776655:AAEEFFGGHHIIJJKKLL';
  const passphrase = 'SuperSecretMasterPassphrase2026!';

  // Encrypt payload
  const encrypted = vault.encryptCredential(secretToken, passphrase);
  assert.strictEqual(encrypted.v, 1);
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.kekSalt);
  assert.ok(encrypted.encryptedDek);

  // Decrypt with correct passphrase
  const decrypted = vault.decryptCredential(encrypted, passphrase);
  assert.strictEqual(decrypted, secretToken);

  // Tamper ciphertext by modifying 1 character
  const tamperedCiphertext =
    encrypted.ciphertext.substring(0, 4) +
    (encrypted.ciphertext[4] === 'a' ? 'b' : 'a') +
    encrypted.ciphertext.substring(5);

  const tamperedPayload = { ...encrypted, ciphertext: tamperedCiphertext };

  // Expect tamper rejection
  assert.throws(
    () => vault.decryptCredential(tamperedPayload, passphrase),
    /Authentication\/Decryption failed/
  );
});

test('V2.4 — Security: IV Uniqueness (50 Encryptions -> Zero Reused Nonces)', () => {
  const vault = new EnvelopeEncryptionVault();
  const secret = 's3-secret-key-xyz123';
  const passphrase = 'MasterPassphrase!2026';

  const payloadIvs = new Set<string>();
  const dekIvs = new Set<string>();

  for (let i = 0; i < 50; i++) {
    const enc = vault.encryptCredential(secret, passphrase);
    payloadIvs.add(enc.payloadIv);
    dekIvs.add(enc.dekIv);
  }

  // 50 encryptions must yield 50 unique nonces
  assert.strictEqual(payloadIvs.size, 50);
  assert.strictEqual(dekIvs.size, 50);
});

test('V2.4 — Security: DEK Isolation & Wrong Master Passphrase Rejection', () => {
  const vault = new EnvelopeEncryptionVault();
  const secret1 = 'cred-1';
  const secret2 = 'cred-2';
  const masterKey = 'CorrectPassphrase!123';

  const enc1 = vault.encryptCredential(secret1, masterKey);
  const enc2 = vault.encryptCredential(secret2, masterKey);

  // Different credentials must have independent DEKs
  assert.notStrictEqual(enc1.encryptedDek, enc2.encryptedDek);

  // Wrong master passphrase must fail
  assert.throws(
    () => vault.decryptCredential(enc1, 'WrongMasterPassphrase!999'),
    /Authentication\/Decryption failed/
  );
});

test('V2.4 — Security: OWASP scrypt Passcode Hashing (N=131072, r=8, p=1)', async () => {
  const hasher = new ScryptPasscodeHasher();
  const passcode = 'UserSecretPasscode2026';

  const hash = await hasher.hashPasscode(passcode);
  assert.ok(hash.startsWith('$scrypt$N=131072,r=8,p=1$'));

  // Valid passcode check
  const valid = await hasher.verifyPasscode(passcode, hash);
  assert.strictEqual(valid, true);

  // Invalid passcode check
  const invalid = await hasher.verifyPasscode('WrongPasscode', hash);
  assert.strictEqual(invalid, false);
});

test('V2.4 — Share Security: Expiration Boundary & Max Downloads Race Condition (20 Concurrent -> Exactly 5)', async () => {
  const shareProvider = new TokenShareProvider();
  const hasher = new ScryptPasscodeHasher();

  const passcode = 'SharePasscode123';
  const passcodeHash = await hasher.hashPasscode(passcode);

  // Create link with max 5 downloads and 60 second expiration
  const share = await shareProvider.createShareLink('file-123', {
    passcodeHash,
    maxDownloads: 5,
    expiresInSeconds: 60,
  });

  // Verify passcode checker
  const passcodeVerifier = (storedHash: string) => hasher.verifyPasscode(passcode, storedHash);

  // Simulate 20 concurrent download requests
  const tasks = Array.from({ length: 20 }, () =>
    shareProvider.consumeDownload(share.shareId, passcodeVerifier)
  );

  const results = await Promise.all(tasks);
  const successes = results.filter((r) => r === true).length;
  const rejections = results.filter((r) => r === false).length;

  // Race condition safety check: EXACTLY 5 successful downloads, 15 rejected
  assert.strictEqual(successes, 5);
  assert.strictEqual(rejections, 15);

  // Expiration boundary check (past expiration timestamp -> rejected)
  const expiredShare = await shareProvider.createShareLink('file-456', {
    expiresInSeconds: -1, // Expired in the past
  });
  const expiredResult = await shareProvider.consumeDownload(expiredShare.shareId);
  assert.strictEqual(expiredResult, false);
});

test('V2.4 — Circuit Breaker: Policy-Authoritative Fallback & Recovery State Machine', async () => {
  const cb = new ProviderCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
  const router = new StorageRouter('local-disk', undefined, cb);

  router.clearRules();
  // Rule 1 (Priority 100): Photos to Telegram
  const telegramRule: StorageRule = {
    id: 'r1',
    name: 'Photos to Telegram',
    priority: 100,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'telegram' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Rule 2 (Priority 50): Photos to Local Disk (policy-authorized fallback)
  const localRule: StorageRule = {
    id: 'r2',
    name: 'Photos to Local Disk Fallback',
    priority: 50,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'local-disk' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  router.addRule(telegramRule);
  router.addRule(localRule);

  const photoFile = { name: 'snap.jpg', mimeType: 'image/jpeg', size: 1000 };

  // 1. Normal state (CLOSED): Routes to Telegram (Priority 100)
  assert.strictEqual(router.resolveProviderId(photoFile), 'telegram');

  // 2. Trip Telegram circuit -> state OPEN
  cb.trip('telegram', 'Telegram 429 Too Many Requests');
  assert.strictEqual(cb.getState('telegram'), 'OPEN');

  // 3. Router evaluates policy: Telegram circuit is OPEN, so policy engine picks next authorized rule (Local Disk)
  assert.strictEqual(router.resolveProviderId(photoFile), 'local-disk');

  // 4. Wait for reset timeout -> transition to HALF_OPEN
  await new Promise((res) => setTimeout(res, 120));
  assert.strictEqual(cb.getState('telegram'), 'HALF_OPEN');

  // 5. Successful probe in HALF_OPEN -> transitions back to CLOSED
  cb.reset('telegram');
  assert.strictEqual(cb.getState('telegram'), 'CLOSED');
  assert.strictEqual(router.resolveProviderId(photoFile), 'telegram');
});

test('V2.4 — Transfer Queue: Max 4 Active Streams Concurrency Backpressure', async () => {
  const queue = new TransferQueue({ concurrency: 4 });
  let maxObservedActive = 0;
  let completedTasks = 0;

  const runTask = (id: number) =>
    queue.execute(async () => {
      const currentActive = queue.getActiveCount();
      if (currentActive > maxObservedActive) {
        maxObservedActive = currentActive;
      }
      // Simulate chunk transfer delay
      await new Promise((res) => setTimeout(res, 20));
      completedTasks++;
      return id;
    });

  // Launch 20 concurrent transfer tasks
  const tasks = Array.from({ length: 20 }, (_, i) => runTask(i));
  await Promise.all(tasks);

  assert.strictEqual(completedTasks, 20);
  assert.ok(maxObservedActive <= 4, `Max observed active streams was ${maxObservedActive}, expected <= 4`);
});

test('V2.4 — Architectural Isolation Audit: Zero AI Dependencies in Storage Adapters', () => {
  const adaptersDir = path.join(__dirname, '../src');
  const files = getFilesRecursive(adaptersDir).filter(
    (p) =>
      !p.includes(path.join('src', 'content')) &&
      !p.includes('content') &&
      !p.includes(path.join('src', 'search')) &&
      !p.includes('search') &&
      !p.includes(path.join('src', 'ai')) &&
      !p.includes('ai')
  );

  const aiKeywords = ['IContentExtractor', 'IAIIndex', 'embeddings', 'ocr', 'semanticSearch'];

  for (const filePath of files) {
    // Skip domain boundary contract exports if any
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const keyword of aiKeywords) {
      assert.strictEqual(
        content.includes(keyword),
        false,
        `File '${path.basename(filePath)}' violates AI isolation boundary by containing '${keyword}'`
      );
    }
  }
});

/** Helper to list all TypeScript files in a directory */
function getFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else if (file.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}
