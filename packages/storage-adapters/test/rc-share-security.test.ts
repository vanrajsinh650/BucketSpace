import assert from 'node:assert';
import test from 'node:test';
import { TokenShareProvider } from '../src/share/token-share-provider';
import { ScryptPasscodeHasher } from '@bucketspace/security';

/* ─── 1.0 RC: Share Security & High Concurrency Race Hardening Suite ─── */

test('1.0 RC Share Security — 100 Concurrent Requests on maxDownloads = 1 (Exactly 1 Succeeds)', async () => {
  const shareProvider = new TokenShareProvider();
  const link = await shareProvider.createShareLink('file-sensitive-100', {
    maxDownloads: 1,
  });

  const rawToken = link.shareId;

  // Fire 100 parallel download requests simultaneously
  const results = await Promise.all(
    Array.from({ length: 100 }, () => shareProvider.consumeDownload(rawToken))
  );

  const successCount = results.filter((s) => s === true).length;
  const failureCount = results.filter((s) => s === false).length;

  assert.strictEqual(successCount, 1, 'Exactly 1 request must succeed when maxDownloads = 1');
  assert.strictEqual(failureCount, 99, 'Remaining 99 requests must be rejected');

  // Verify subsequent call also fails
  const followUp = await shareProvider.consumeDownload(rawToken);
  assert.strictEqual(followUp, false);
});

test('1.0 RC Share Security — 50 Concurrent Requests on maxDownloads = 5 (Exactly 5 Succeed)', async () => {
  const shareProvider = new TokenShareProvider();
  const link = await shareProvider.createShareLink('file-cap-5', {
    maxDownloads: 5,
  });

  const rawToken = link.shareId;

  // Fire 50 parallel download requests
  const results = await Promise.all(
    Array.from({ length: 50 }, () => shareProvider.consumeDownload(rawToken))
  );

  const successCount = results.filter((s) => s === true).length;
  const failureCount = results.filter((s) => s === false).length;

  assert.strictEqual(successCount, 5, 'Exactly 5 requests must succeed');
  assert.strictEqual(failureCount, 45, 'Remaining 45 requests must be rejected');
});

test('1.0 RC Share Security — Expired Share Tokens are immediately rejected', async () => {
  const shareProvider = new TokenShareProvider();
  // Create link that expired 10 seconds ago
  const link = await shareProvider.createShareLink('file-expired', {
    expiresInSeconds: -10,
  });

  const rawToken = link.shareId;

  const retrieved = await shareProvider.getShareLink(rawToken);
  assert.strictEqual(retrieved, null, 'Expired link must return null on getShareLink');

  const consumed = await shareProvider.consumeDownload(rawToken);
  assert.strictEqual(consumed, false, 'Expired link must reject download consumption');
});

test('1.0 RC Share Security — Revoked Share Tokens are immediately purged', async () => {
  const shareProvider = new TokenShareProvider();
  const link = await shareProvider.createShareLink('file-to-revoke');
  const rawToken = link.shareId;

  // Verify active
  const activeLink = await shareProvider.getShareLink(rawToken);
  assert.ok(activeLink !== null);

  // Revoke link
  const revoked = await shareProvider.revokeShareLink(rawToken);
  assert.strictEqual(revoked, true);

  // Verify purged
  const postRevoke = await shareProvider.getShareLink(rawToken);
  assert.strictEqual(postRevoke, null);

  const consumed = await shareProvider.consumeDownload(rawToken);
  assert.strictEqual(consumed, false);
});

test('1.0 RC Share Security — Passcode Protected Links with OWASP scrypt verification', async () => {
  const shareProvider = new TokenShareProvider();
  const hasher = new ScryptPasscodeHasher();
  const correctPasscode = 'SuperSecretPass#2026';
  const hashedPasscode = await hasher.hashPasscode(correctPasscode);

  const link = await shareProvider.createShareLink('file-passcode-protected', {
    passcodeHash: hashedPasscode,
  });

  const rawToken = link.shareId;

  // Verifier using constant-time scrypt comparison
  const verifier = (input: string) => async (stored: string) => {
    return hasher.verifyPasscode(input, stored);
  };

  // Attempt download with WRONG passcode
  const wrongAttempt = await shareProvider.consumeDownload(rawToken, verifier('WrongPassword123'));
  assert.strictEqual(wrongAttempt, false, 'Wrong passcode must be rejected');

  // Attempt download with NO passcode verifier
  const noVerifierAttempt = await shareProvider.consumeDownload(rawToken);
  assert.strictEqual(noVerifierAttempt, false, 'Missing passcode must be rejected');

  // Attempt download with CORRECT passcode
  const correctAttempt = await shareProvider.consumeDownload(rawToken, verifier(correctPasscode));
  assert.strictEqual(correctAttempt, true, 'Correct passcode must succeed');
});

test('1.0 RC Share Security — Opaque Reference Privacy (Zero Provider Secrets in Share Link)', async () => {
  const shareProvider = new TokenShareProvider();
  const link = await shareProvider.createShareLink('file-private-xyz');

  // Assert shareLink does not expose Telegram chat_id, message_id, local paths, or internal tokens
  const serialized = JSON.stringify(link);
  assert.ok(!serialized.includes('chat_id'), 'ShareLink must not leak chat_id');
  assert.ok(!serialized.includes('message_id'), 'ShareLink must not leak message_id');
  assert.ok(!serialized.includes('s3_key'), 'ShareLink must not leak s3 keys');
  assert.ok(!serialized.includes('storageRoot'), 'ShareLink must not leak local paths');
});
