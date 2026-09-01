import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EnvelopeEncryptionVault } from '../src/modules/security/envelope-vault';

describe('EnvelopeEncryptionVault - AES-256-GCM Envelope Encryption', () => {
  const vault = new EnvelopeEncryptionVault();

  it('should encrypt and decrypt credentials with AES-256-GCM zero-knowledge envelope', async () => {
    const rawSecret = 'tg_session_string_super_secure_mtproto_key_2026';
    const masterPassphrase = 'MasterPassphrase123!#';

    const encrypted = vault.encryptCredential(rawSecret, masterPassphrase);

    assert.ok(encrypted.ciphertext, 'Ciphertext must be present');
    assert.ok(encrypted.encryptedDek, 'Encrypted DEK must be present');
    assert.strictEqual(encrypted.v, 1, 'Version must be 1');
    assert.notStrictEqual(encrypted.ciphertext, rawSecret);

    const decrypted = vault.decryptCredential(encrypted, masterPassphrase);
    assert.strictEqual(decrypted, rawSecret, 'Decrypted payload must match original secret exactly');
  });

  it('should reject decryption when wrong master passphrase is provided', async () => {
    const rawSecret = 'my-vault-passcode';
    const correctPassphrase = 'CorrectPassword#1';
    const wrongPassphrase = 'WrongPassword#2';

    const encrypted = vault.encryptCredential(rawSecret, correctPassphrase);

    assert.throws(
      () => {
        vault.decryptCredential(encrypted, wrongPassphrase);
      },
      /Authentication\/Decryption failed|Decryption failed/i,
      'Decryption must throw when passphrase is wrong'
    );
  });

  it('should reject tampered ciphertext with cryptographic authentication error', async () => {
    const rawSecret = 'confidential-telegram-session';
    const masterPassphrase = 'StrongPassphrase!9';

    const encrypted = vault.encryptCredential(rawSecret, masterPassphrase);

    // Tamper with ciphertext
    const tamperedPayload = {
      ...encrypted,
      ciphertext: '00' + encrypted.ciphertext.slice(2),
    };

    assert.throws(
      () => {
        vault.decryptCredential(tamperedPayload, masterPassphrase);
      },
      /Authentication\/Decryption failed/i,
      'Tampered ciphertext must fail authentication check'
    );
  });
});
