process.env.NODE_ENV = 'test';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { ClientEncryptionService } from '../src/modules/security/client-encryption';
import { calculateSha256 } from '../src/lib/storage-store';
import { normalizeApiBase } from '../src/lib/utils';
import { POST as saveShareRoute } from '../src/app/api/v1/shares/route';
import { GET as getShareRoute, POST as verifySharePasscodeRoute } from '../src/app/api/v1/shares/[token]/route';
import { GET as getShareChunkRoute } from '../src/app/api/v1/shares/[token]/chunks/[index]/route';
import { concatByteArrays } from '../src/shared';
import { TelegramSessionRegistry } from '../src/modules/storage/telegram-session-registry';
import { ShareStoreService } from '../src/modules/storage/share-store-service';

describe('Public File Sharing End-to-End Regression Suite', () => {
  // Test master encryption key
  let masterKey: CryptoKey;
  let masterKeyHex: string;

  it('setup: should generate client encryption key and export to hex', async () => {
    masterKey = await ClientEncryptionService.generateMasterKey();
    masterKeyHex = await ClientEncryptionService.exportKeyToHex(masterKey);
    assert.strictEqual(masterKeyHex.length, 64, 'Master key hex must be 64 characters (256-bit)');
  });

  // 1. Create share
  it('1. should create share record with chunks and client-side encryption key in URL hash', async () => {
    const rawPlaintext = new TextEncoder().encode('Hello, BucketSpace Zero-Knowledge Public Share!');
    const wholeFileHash = await calculateSha256(rawPlaintext);

    // Encrypt chunk with AES-256-GCM
    const encryptedChunk = await ClientEncryptionService.encryptChunk(rawPlaintext, masterKey);
    const chunkPlaintextHash = await calculateSha256(rawPlaintext);

    const shareToken = `tok_test_${Date.now()}`;
    const shareRecord = {
      token: shareToken,
      fileId: 'file_e2e_001',
      fileName: 'document.txt',
      fileSize: rawPlaintext.byteLength,
      mimeType: 'text/plain',
      wholeFileHash,
      chunks: [
        {
          id: 'chunk_0',
          index: 0,
          sizeBytes: encryptedChunk.byteLength,
          hash: chunkPlaintextHash,
          providerRef: {
            providerId: 'telegram',
            reference: { messageId: 9999, chatId: 'vault', size: encryptedChunk.byteLength },
          },
        },
      ],
      inMemoryChunks: [encryptedChunk],
      ownerSessionString: '1BVtsOKUBu0e...MOCK_TELEGRAM_SESSION_SECRET',
      createdAt: new Date().toISOString(),
    };

    // Save to share store
    const req = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shareRecord),
    });

    const res = await saveShareRoute(req);
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
  });

  // 2. Retrieve share using token
  it('2. should retrieve public share metadata using token', async () => {
    const token = 'tok_share_lookup_test';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_1',
        fileName: 'photo.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const res = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.fileName, 'photo.jpg');
    assert.strictEqual(data.hasPasscode, false);
  });

  // 3. Invalid token
  it('3. should return 404 for invalid or non-existent share token', async () => {
    const token = 'tok_non_existent_random_xyz';
    const req = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const res = await getShareRoute(req, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  // 4. Revoked / expired token
  it('4. should reject expired share tokens with 404/410', async () => {
    const token = 'tok_expired_test';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_exp',
        fileName: 'expired.pdf',
        fileSize: 500,
        mimeType: 'application/pdf',
        chunks: [],
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 1 min ago
      }),
    });
    await saveShareRoute(reqSave);

    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const res = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 404);
  });

  // 5. Passcode-protected share
  it('5. should indicate hasPasscode: true without leaking plaintext passcode in metadata', async () => {
    const token = 'tok_passcode_protected';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_pass',
        fileName: 'confidential.docx',
        fileSize: 2048,
        mimeType: 'application/msword',
        passcode: 'Secret123!',
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const res = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.hasPasscode, true);
    assert.strictEqual(data.passcode, undefined, 'Plaintext passcode must never be exposed');
  });

  // 6. Correct passcode
  it('6. should unlock full share metadata with correct passcode', async () => {
    const token = 'tok_passcode_auth';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_pass_ok',
        fileName: 'keys.pem',
        fileSize: 4096,
        mimeType: 'text/plain',
        passcode: 'BucketVault2026',
        chunks: [{ id: 'c0', index: 0 }],
      }),
    });
    await saveShareRoute(reqSave);

    const reqPost = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'BucketVault2026' }),
    });
    const res = await verifySharePasscodeRoute(reqPost, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.fileName, 'keys.pem');
  });

  // 7. Incorrect passcode
  it('7. should reject incorrect passcode with 401', async () => {
    const token = 'tok_passcode_reject';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_pass_no',
        fileName: 'keys.pem',
        fileSize: 4096,
        mimeType: 'text/plain',
        passcode: 'RealPassword',
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    const reqPost = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'WrongPassword' }),
    });
    const res = await verifySharePasscodeRoute(reqPost, { params: Promise.resolve({ token }) });
    assert.strictEqual(res.status, 401);
  });

  // 8. Public shared file metadata retrieval
  it('8. should return accurate file size, mime type, chunk count, and whole-file hash', async () => {
    const token = 'tok_meta_audit';
    const wholeFileHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_audit',
        fileName: 'dataset.csv',
        fileSize: 1048576,
        mimeType: 'text/csv',
        wholeFileHash,
        chunks: [
          { id: 'c0', index: 0, sizeBytes: 524288, hash: 'h0' },
          { id: 'c1', index: 1, sizeBytes: 524288, hash: 'h1' },
        ],
      }),
    });
    await saveShareRoute(reqSave);

    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const res = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    const data = await res.json();
    assert.strictEqual(data.fileSize, 1048576);
    assert.strictEqual(data.wholeFileHash, wholeFileHash);
    assert.strictEqual(data.chunks.length, 2);
  });

  // 9 & 10. Shared encrypted chunk retrieval, decryption, and byte-exact reconstruction
  it('9 & 10. should stream encrypted chunk from backend, decrypt with key from URL hash, and match original file byte-for-byte', async () => {
    const originalFileBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const wholeFileHash = await calculateSha256(originalFileBytes);

    // Encrypt chunk with AES-256-GCM
    const encryptedChunkBytes = await ClientEncryptionService.encryptChunk(originalFileBytes, masterKey);
    const chunkPlaintextHash = await calculateSha256(originalFileBytes);

    const token = 'tok_e2e_download_test';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_png',
        fileName: 'avatar.png',
        fileSize: originalFileBytes.byteLength,
        mimeType: 'image/png',
        wholeFileHash,
        chunks: [
          {
            id: 'c0',
            index: 0,
            sizeBytes: encryptedChunkBytes.byteLength,
            hash: chunkPlaintextHash,
            providerRef: { providerId: 'in-memory', reference: { key: 'mock' } },
          },
        ],
        inMemoryChunks: [encryptedChunkBytes],
      }),
    });
    await saveShareRoute(reqSave);

    // Step A: Recipient fetches chunk 0 from /api/v1/shares/[token]/chunks/0
    const reqChunk = new NextRequest(`http://localhost:3000/api/v1/shares/${token}/chunks/0`);
    const resChunk = await getShareChunkRoute(reqChunk, { params: Promise.resolve({ token, index: '0' }) });
    assert.strictEqual(resChunk.status, 200);

    const receivedEncryptedChunk = new Uint8Array(await resChunk.arrayBuffer());
    assert.deepStrictEqual(receivedEncryptedChunk, encryptedChunkBytes);

    // Step B: Recipient imports key from URL hash fragment and decrypts
    const recipientKey = await ClientEncryptionService.importKeyFromHex(masterKeyHex);
    const decryptedBytes = await ClientEncryptionService.decryptChunk(receivedEncryptedChunk, recipientKey);

    // Step C: Verify chunk hash integrity
    const decryptedHash = await calculateSha256(decryptedBytes);
    assert.strictEqual(decryptedHash, chunkPlaintextHash);

    // Step D: Verify whole-file reconstruction matches byte-for-byte
    assert.deepStrictEqual(decryptedBytes, originalFileBytes);
  });

  // 11. Vercel -> Railway API base URL behavior
  it('11. normalizeApiBase should enforce https:// and strip trailing slashes for Vercel -> Railway communication', () => {
    assert.strictEqual(normalizeApiBase('bucketspace-production.up.railway.app'), 'https://bucketspace-production.up.railway.app');
    assert.strictEqual(normalizeApiBase('bucketspace-production.up.railway.app/'), 'https://bucketspace-production.up.railway.app');
    assert.strictEqual(normalizeApiBase('https://bucketspace-production.up.railway.app///'), 'https://bucketspace-production.up.railway.app');
    assert.strictEqual(normalizeApiBase('http://localhost:3000/'), 'http://localhost:3000');
    assert.strictEqual(normalizeApiBase(''), '');
    assert.strictEqual(normalizeApiBase(undefined), '');
  });

  // 12. No Telegram session leakage
  it('12. should never leak ownerSessionString or telegramSession in GET or POST share endpoints', async () => {
    const token = 'tok_leakage_check';
    const secretSession = '1BVtsOKUBu0e_SUPER_SECRET_OWNER_TELEGRAM_SESSION_STRING';
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_sec',
        fileName: 'secret.txt',
        fileSize: 100,
        mimeType: 'text/plain',
        ownerSessionString: secretSession,
        telegramSession: secretSession,
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    // Test GET /api/v1/shares/[token]
    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const resGet = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    const jsonGet = await resGet.json();
    assert.strictEqual(jsonGet.ownerSessionString, undefined);
    assert.strictEqual(jsonGet.telegramSession, undefined);
    assert.strictEqual(JSON.stringify(jsonGet).includes(secretSession), false);

    // Test POST /api/v1/shares/[token]
    const reqPost = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resPost = await verifySharePasscodeRoute(reqPost, { params: Promise.resolve({ token }) });
    const jsonPost = await resPost.json();
    assert.strictEqual(jsonPost.ownerSessionString, undefined);
    assert.strictEqual(jsonPost.telegramSession, undefined);
    assert.strictEqual(JSON.stringify(jsonPost).includes(secretSession), false);
  });

  // 13. No plaintext fallback on decryption failure
  it('13. should reject corrupted or wrong-key ciphertext and never treat unauthenticated data as plaintext', async () => {
    const rawData = new TextEncoder().encode('Secret financial records');
    const encrypted = await ClientEncryptionService.encryptChunk(rawData, masterKey);

    // Wrong key
    const attackerKey = await ClientEncryptionService.generateMasterKey();
    await assert.rejects(
      async () => {
        await ClientEncryptionService.decryptChunk(encrypted, attackerKey);
      },
      /Client decryption failed|AuthenticationError/i,
      'Decryption with wrong key must throw error and never return ciphertext or garbage'
    );

    // Tampered ciphertext
    const tampered = new Uint8Array(encrypted);
    tampered[15] ^= 0xff; // Flip bits in ciphertext
    await assert.rejects(
      async () => {
        await ClientEncryptionService.decryptChunk(tampered, masterKey);
      },
      /Client decryption failed|AuthenticationError/i,
      'Tampered ciphertext must be cryptographically rejected'
    );
  });

  // ─── GitHub Issue #1 Security Regression Suite (Tests A - H) ───

  // A. Creating a share does NOT persist a raw Telegram session
  it('A. Creating a share does NOT persist a raw Telegram session', async () => {
    const rawSession = '1BVtsSession_Test_A_' + Date.now();
    const token = `tok_sec_test_a_${Date.now()}`;
    const req = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-session': rawSession,
      },
      body: JSON.stringify({
        token,
        fileId: 'file_sec_a',
        fileName: 'confidential_a.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        chunks: [],
      }),
    });

    const res = await saveShareRoute(req);
    assert.strictEqual(res.status, 200);

    const record = ShareStoreService.get(token);
    assert.ok(record, 'Share record must exist');
    assert.strictEqual((record as unknown as Record<string, unknown>).ownerSessionString, undefined, 'ownerSessionString must not exist on record');
    assert.strictEqual((record as unknown as Record<string, unknown>).telegramSession, undefined, 'telegramSession must not exist on record');
    assert.ok(record.ownerProviderRef, 'ownerProviderRef must be assigned');
    assert.notStrictEqual(record.ownerProviderRef, rawSession, 'ownerProviderRef must not be raw session');
    assert.strictEqual(record.ownerProviderRef.startsWith('tgsref_'), true, 'ownerProviderRef must be opaque ref');
  });

  // B. Persisted bucketspace_shares.json contains no ownerSessionString or telegramSession
  it('B. Persisted bucketspace_shares.json contains no ownerSessionString or telegramSession', async () => {
    const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? process.env.TEMP : '/tmp') || '/tmp';
    const SHARES_FILE = path.join(DATA_DIR, 'bucketspace_shares.json');

    assert.ok(fs.existsSync(SHARES_FILE), 'bucketspace_shares.json file must exist on disk');
    const rawContent = fs.readFileSync(SHARES_FILE, 'utf8');

    assert.strictEqual(rawContent.includes('ownerSessionString'), false, 'Persisted JSON must never contain ownerSessionString');
    assert.strictEqual(rawContent.includes('telegramSession'), false, 'Persisted JSON must never contain telegramSession');
  });

  // C. Public share retrieval can resolve the owner session through the runtime registry
  it('C. Public share retrieval can resolve the owner session through the runtime registry', async () => {
    const rawSession = '1BVtsSession_Test_C_' + Date.now();
    const token = `tok_sec_test_c_${Date.now()}`;
    const req = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-session': rawSession,
      },
      body: JSON.stringify({
        token,
        fileId: 'file_sec_c',
        fileName: 'doc_c.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        chunks: [],
      }),
    });
    await saveShareRoute(req);

    const record = ShareStoreService.get(token);
    assert.ok(record);
    assert.ok(record.ownerProviderRef);

    // Resolve through runtime registry
    const resolvedSession = TelegramSessionRegistry.resolve(record.ownerProviderRef);
    assert.strictEqual(resolvedSession, rawSession, 'Runtime registry must resolve correct owner session');
  });

  // D. Removing the runtime Telegram session causes share retrieval to fail safely
  it('D. Removing the runtime Telegram session causes share retrieval to fail safely', async () => {
    const rawSession = '1BVtsSession_Test_D_' + Date.now();
    const token = `tok_sec_test_d_${Date.now()}`;
    const ref = TelegramSessionRegistry.register(rawSession);

    // Save record with ownerProviderRef and a mock telegram chunk
    ShareStoreService.set({
      token,
      fileId: 'file_sec_d',
      fileName: 'test_d.bin',
      fileSize: 512,
      mimeType: 'application/octet-stream',
      ownerProviderRef: ref,
      createdAt: new Date().toISOString(),
      chunks: [
        {
          id: 'chunk_0',
          index: 0,
          providerRef: {
            providerId: 'telegram',
            reference: { messageId: 101, chatId: 'vault' },
          },
        },
      ],
    });

    // Remove the session from runtime registry
    const removed = TelegramSessionRegistry.remove(ref);
    assert.strictEqual(removed, true, 'Session must be removed from registry');

    // Attempt to download chunk
    const reqChunk = new NextRequest(`http://localhost:3000/api/v1/shares/${token}/chunks/0`);
    const resChunk = await getShareChunkRoute(reqChunk, { params: Promise.resolve({ token, index: '0' }) });

    assert.strictEqual(resChunk.status, 500);
    const json = await resChunk.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.message, 'Storage session is unavailable for this share');
  });

  // E. A public share token alone cannot expose the Telegram session
  it('E. A public share token alone cannot expose the Telegram session', async () => {
    const rawSession = '1BVtsSession_Test_E_SUPER_SECRET';
    const token = `tok_sec_test_e_${Date.now()}`;
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-session': rawSession,
      },
      body: JSON.stringify({
        token,
        fileId: 'file_sec_e',
        fileName: 'top_secret.docx',
        fileSize: 5000,
        mimeType: 'application/msword',
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    // GET /api/v1/shares/[token]
    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const resGet = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    const textGet = await resGet.text();
    assert.strictEqual(textGet.includes(rawSession), false, 'GET response must not contain raw session');
    assert.strictEqual(textGet.includes('ownerSessionString'), false);
    assert.strictEqual(textGet.includes('telegramSession'), false);
    assert.strictEqual(textGet.includes('ownerProviderRef'), false, 'GET response must not expose internal provider ref');

    // POST /api/v1/shares/[token]
    const reqPost = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resPost = await verifySharePasscodeRoute(reqPost, { params: Promise.resolve({ token }) });
    const textPost = await resPost.text();
    assert.strictEqual(textPost.includes(rawSession), false, 'POST response must not contain raw session');
    assert.strictEqual(textPost.includes('ownerSessionString'), false);
    assert.strictEqual(textPost.includes('telegramSession'), false);
    assert.strictEqual(textPost.includes('ownerProviderRef'), false, 'POST response must not expose internal provider ref');
  });

  // F. Share metadata responses contain no Telegram credential
  it('F. Share metadata responses contain no Telegram credential', async () => {
    const rawSession = '1BVtsSession_Test_F_CREDENTIAL';
    const token = `tok_sec_test_f_${Date.now()}`;
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-session': rawSession,
      },
      body: JSON.stringify({
        token,
        fileId: 'file_sec_f',
        fileName: 'passwords.txt',
        fileSize: 42,
        mimeType: 'text/plain',
        passcode: 'SecretPass123',
        chunks: [],
      }),
    });
    await saveShareRoute(reqSave);

    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${token}`);
    const resGet = await getShareRoute(reqGet, { params: Promise.resolve({ token }) });
    const jsonGet = await resGet.json();

    assert.strictEqual(JSON.stringify(jsonGet).includes(rawSession), false);
    assert.strictEqual((jsonGet as Record<string, unknown>).ownerSessionString, undefined);
    assert.strictEqual((jsonGet as Record<string, unknown>).telegramSession, undefined);
    assert.strictEqual((jsonGet as Record<string, unknown>).ownerProviderRef, undefined);
    assert.strictEqual((jsonGet as Record<string, unknown>).passcode, undefined);
  });

  // G. Existing share encryption/key behavior remains unchanged
  it('G. Existing share encryption/key behavior remains unchanged', async () => {
    const testSecretData = new TextEncoder().encode('Zero-Knowledge E2E Verification Payload 2026');
    const wholeFileHash = await calculateSha256(testSecretData);
    const encryptedChunk = await ClientEncryptionService.encryptChunk(testSecretData, masterKey);
    const chunkPlaintextHash = await calculateSha256(testSecretData);

    const token = `tok_sec_test_g_${Date.now()}`;
    const reqSave = new NextRequest('http://localhost:3000/api/v1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        fileId: 'file_sec_g',
        fileName: 'e2e_verify.dat',
        fileSize: testSecretData.byteLength,
        mimeType: 'application/octet-stream',
        wholeFileHash,
        chunks: [
          {
            id: 'chunk_0',
            index: 0,
            sizeBytes: encryptedChunk.byteLength,
            hash: chunkPlaintextHash,
            providerRef: { providerId: 'in-memory', reference: { key: 'mock' } },
          },
        ],
        inMemoryChunks: [encryptedChunk],
      }),
    });
    await saveShareRoute(reqSave);

    // Fetch chunk
    const reqChunk = new NextRequest(`http://localhost:3000/api/v1/shares/${token}/chunks/0`);
    const resChunk = await getShareChunkRoute(reqChunk, { params: Promise.resolve({ token, index: '0' }) });
    assert.strictEqual(resChunk.status, 200);

    const receivedBytes = new Uint8Array(await resChunk.arrayBuffer());
    assert.deepStrictEqual(receivedBytes, encryptedChunk);

    // Decrypt using client-side master key
    const decryptedBytes = await ClientEncryptionService.decryptChunk(receivedBytes, masterKey);
    assert.deepStrictEqual(decryptedBytes, testSecretData);
    const decryptedHash = await calculateSha256(decryptedBytes);
    assert.strictEqual(decryptedHash, wholeFileHash);
  });

  // H. Legacy persisted records containing raw session fields are never returned to clients and are never re-persisted with the raw credentials
  it('H. Legacy persisted records containing raw session fields are never returned to clients and are never re-persisted with the raw credentials', async () => {
    const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? process.env.TEMP : '/tmp') || '/tmp';
    const SHARES_FILE = path.join(DATA_DIR, 'bucketspace_shares.json');

    const legacySession = '1BVtsLegacyRawSessionSecret999';
    const legacyToken = `tok_legacy_test_${Date.now()}`;

    // Read current shares from file
    let currentShares: unknown[] = [];
    try {
      if (fs.existsSync(SHARES_FILE)) {
        currentShares = JSON.parse(fs.readFileSync(SHARES_FILE, 'utf8'));
      }
    } catch {
      currentShares = [];
    }

    // Infiltrate a legacy share record with raw session fields onto disk
    const legacyRecord = {
      token: legacyToken,
      fileId: 'file_legacy_001',
      fileName: 'legacy_archive.tar',
      fileSize: 9999,
      mimeType: 'application/x-tar',
      chunks: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      ownerSessionString: legacySession,
      telegramSession: legacySession,
    };
    currentShares.push(legacyRecord);
    fs.writeFileSync(SHARES_FILE, JSON.stringify(currentShares, null, 2), 'utf8');

    // Force re-read from disk
    const record = ShareStoreService.get(legacyToken);
    assert.ok(record, 'Legacy record should be loaded and migrated');

    // In-memory checks:
    assert.strictEqual((record as unknown as Record<string, unknown>).ownerSessionString, undefined, 'ownerSessionString must be deleted from loaded record');
    assert.strictEqual((record as unknown as Record<string, unknown>).telegramSession, undefined, 'telegramSession must be deleted from loaded record');
    assert.ok(record.ownerProviderRef, 'ownerProviderRef must be generated for legacy record');

    // Runtime registry check: session is available in server memory
    const runtimeSession = TelegramSessionRegistry.resolve(record.ownerProviderRef);
    assert.strictEqual(runtimeSession, legacySession, 'Legacy session must be safely migrated to TelegramSessionRegistry');

    // Disk re-read check: file on disk must be sanitized and contain NO legacy credentials
    const fileContentAfterLoad = fs.readFileSync(SHARES_FILE, 'utf8');
    assert.strictEqual(fileContentAfterLoad.includes(legacySession), false, 'Disk file must NOT contain raw legacy session string after load');
    assert.strictEqual(fileContentAfterLoad.includes('ownerSessionString'), false, 'Disk file must NOT contain ownerSessionString');
    assert.strictEqual(fileContentAfterLoad.includes('telegramSession'), false, 'Disk file must NOT contain telegramSession');

    // API response check:
    const reqGet = new NextRequest(`http://localhost:3000/api/v1/shares/${legacyToken}`);
    const resGet = await getShareRoute(reqGet, { params: Promise.resolve({ token: legacyToken }) });
    const jsonGet = await resGet.json();
    assert.strictEqual((jsonGet as Record<string, unknown>).ownerSessionString, undefined);
    assert.strictEqual((jsonGet as Record<string, unknown>).telegramSession, undefined);
    assert.strictEqual((jsonGet as Record<string, unknown>).ownerProviderRef, undefined);
    assert.strictEqual(JSON.stringify(jsonGet).includes(legacySession), false);
  });
});

