import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ClientEncryptionService } from '../src/modules/security/client-encryption';
import { calculateSha256 } from '../src/lib/storage-store';

describe('ClientEncryptionService - Client-Side AES-256-GCM File Encryption', () => {
  beforeEach(() => {
    ClientEncryptionService.clearCachedKey();
  });

  it('should generate, export, and import 256-bit AES-GCM keys', async () => {
    const key = await ClientEncryptionService.generateMasterKey();
    assert.ok(key, 'Key should be generated');

    const hex = await ClientEncryptionService.exportKeyToHex(key);
    assert.strictEqual(hex.length, 64, '256-bit key should be 64 hex characters');

    const imported = await ClientEncryptionService.importKeyFromHex(hex);
    assert.ok(imported, 'Key should be imported from hex');
  });

  it('should derive deterministic keys from passphrase and salt', async () => {
    const passphrase = 'my-ultra-secure-vault-passphrase-2026';
    const { key: key1, saltHex } = await ClientEncryptionService.deriveKeyFromPassphrase(passphrase);
    const { key: key2 } = await ClientEncryptionService.deriveKeyFromPassphrase(passphrase, saltHex);

    const hex1 = await ClientEncryptionService.exportKeyToHex(key1);
    const hex2 = await ClientEncryptionService.exportKeyToHex(key2);

    assert.strictEqual(hex1, hex2, 'Keys derived from identical passphrase and salt must match');
  });

  it('should encrypt and decrypt binary data with byte-exact precision', async () => {
    const key = await ClientEncryptionService.generateMasterKey();
    const originalText = 'Hello BucketSpace! This is a sensitive personal document stored in Telegram.';
    const originalBytes = new TextEncoder().encode(originalText);

    // 1. Encrypt chunk
    const encrypted = await ClientEncryptionService.encryptChunk(originalBytes, key);
    assert.ok(encrypted.byteLength > originalBytes.byteLength, 'Ciphertext includes IV (12B) and Auth Tag (16B)');
    assert.strictEqual(
      encrypted.byteLength,
      originalBytes.byteLength + ClientEncryptionService.IV_LENGTH_BYTES + ClientEncryptionService.AUTH_TAG_LENGTH_BYTES
    );

    // 2. Verify ciphertext is not plaintext
    const ciphertextString = new TextDecoder().decode(encrypted);
    assert.ok(!ciphertextString.includes(originalText), 'Ciphertext must not expose plaintext strings');

    // 3. Decrypt chunk
    const decrypted = await ClientEncryptionService.decryptChunk(encrypted, key);
    const decryptedText = new TextDecoder().decode(decrypted);

    assert.strictEqual(decryptedText, originalText, 'Decrypted text must match original plaintext exactly');
  });

  it('should reject decryption when wrong master key is used (Attacker Threat Model)', async () => {
    const ownerKey = await ClientEncryptionService.generateMasterKey();
    const attackerKey = await ClientEncryptionService.generateMasterKey();

    const sensitiveData = new TextEncoder().encode('Bank Statement 2026: Balance $500,000');
    const encrypted = await ClientEncryptionService.encryptChunk(sensitiveData, ownerKey);

    // Attacker steals the encrypted chunk from Telegram but lacks owner's client key
    await assert.rejects(
      async () => {
        await ClientEncryptionService.decryptChunk(encrypted, attackerKey);
      },
      /Client decryption failed|AuthenticationError|authentication tag mismatch/i,
      'Attacker with wrong key must not be able to decrypt ciphertext'
    );
  });

  it('should detect tampering when ciphertext bits are modified in transit', async () => {
    const key = await ClientEncryptionService.generateMasterKey();
    const originalBytes = new TextEncoder().encode('Confidential contract terms and legal agreements.');

    const encrypted = await ClientEncryptionService.encryptChunk(originalBytes, key);

    // Tamper with one byte in the ciphertext payload
    const tampered = new Uint8Array(encrypted);
    tampered[15] ^= 0xff; // Flip bits

    await assert.rejects(
      async () => {
        await ClientEncryptionService.decryptChunk(tampered, key);
      },
      /Client decryption failed|authentication tag mismatch/i,
      'Tampered ciphertext must fail cryptographic authentication'
    );
  });

  it('should verify end-to-end chunk encryption, Telegram storage, download, and SHA-256 match', async () => {
    const key = await ClientEncryptionService.generateMasterKey();
    const chunkPlaintext = new Uint8Array(1024 * 1024); // 1 MB chunk
    for (let i = 0; i < chunkPlaintext.length; i++) {
      chunkPlaintext[i] = i % 256;
    }

    const originalHash = await calculateSha256(chunkPlaintext);

    // Client uploads: Encrypt chunk in browser before sending to Telegram
    const encryptedForTelegram = await ClientEncryptionService.encryptChunk(chunkPlaintext, key);

    // Telegram stores only encrypted bytes in private channel
    const storedInTelegram = new Uint8Array(encryptedForTelegram);

    // Client downloads: Fetch encrypted chunk from Telegram & decrypt in browser
    const decryptedLocally = await ClientEncryptionService.decryptChunk(storedInTelegram, key);

    // Verify SHA-256
    const verifiedHash = await calculateSha256(decryptedLocally);
    assert.strictEqual(verifiedHash, originalHash, 'Reassembled chunk SHA-256 must match original plaintext hash');
    assert.strictEqual(decryptedLocally.byteLength, chunkPlaintext.byteLength);
  });
});

