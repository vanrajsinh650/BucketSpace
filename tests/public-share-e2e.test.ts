import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { ClientEncryptionService } from '../src/modules/security/client-encryption';
import { calculateSha256 } from '../src/lib/storage-store';
import { normalizeApiBase } from '../src/lib/utils';
import { POST as saveShareRoute } from '../src/app/api/v1/shares/route';
import { GET as getShareRoute, POST as verifySharePasscodeRoute } from '../src/app/api/v1/shares/[token]/route';
import { GET as getShareChunkRoute } from '../src/app/api/v1/shares/[token]/chunks/[index]/route';
import { concatByteArrays } from '../src/shared';

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
});
