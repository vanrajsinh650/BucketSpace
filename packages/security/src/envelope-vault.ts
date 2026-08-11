import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { EncryptedPayload, ICredentialVault } from '@bucketspace/shared';

/* ─── OWASP-Compliant AES-256-GCM Envelope Encryption ─── */

/**
 * EnvelopeEncryptionVault implements OWASP-compliant credential security:
 *
 * 1. Master Passphrase → KEK derived via scrypt (N=131072, r=8, p=1, 16-byte salt)
 * 2. DEK → Unique 256-bit (32-byte) Data Encryption Key per credential
 * 3. KEK encrypts DEK (AES-256-GCM, 12-byte random IV, 16-byte Auth Tag)
 * 4. DEK encrypts Payload (AES-256-GCM, independent 12-byte random IV, 16-byte Auth Tag)
 * 5. Tamper detection: Modifying ciphertext or Auth Tag throws an Authentication Error.
 */
export class EnvelopeEncryptionVault implements ICredentialVault {
  // Scrypt parameters per OWASP guidelines: N=131072 (2^17), r=8, p=1
  private static readonly SCRYPT_N = 131072;
  private static readonly SCRYPT_R = 8;
  private static readonly SCRYPT_P = 1;

  /** Derive KEK (32 bytes) from master passphrase and salt */
  private deriveKek(masterPassphrase: string, salt: Buffer): Buffer {
    return scryptSync(masterPassphrase, salt, 32, {
      N: EnvelopeEncryptionVault.SCRYPT_N,
      r: EnvelopeEncryptionVault.SCRYPT_R,
      p: EnvelopeEncryptionVault.SCRYPT_P,
      maxmem: 256 * 1024 * 1024,
    });
  }

  public encryptCredential(plaintext: string, masterPassphrase: string): EncryptedPayload {
    if (!masterPassphrase) {
      throw new Error('Master passphrase cannot be empty');
    }

    // 1. Generate salt for KEK derivation
    const kekSalt = randomBytes(16);
    const kek = this.deriveKek(masterPassphrase, kekSalt);

    // 2. Generate random 256-bit Data Encryption Key (DEK)
    const dek = randomBytes(32);

    // 3. Encrypt DEK with KEK (AES-256-GCM)
    const dekIv = randomBytes(12);
    const dekCipher = createCipheriv('aes-256-gcm', kek, dekIv);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();

    // 4. Encrypt Payload with DEK (AES-256-GCM)
    const payloadIv = randomBytes(12);
    const payloadCipher = createCipheriv('aes-256-gcm', dek, payloadIv);
    const ciphertext = Buffer.concat([
      payloadCipher.update(Buffer.from(plaintext, 'utf-8')),
      payloadCipher.final(),
    ]);
    const payloadAuthTag = payloadCipher.getAuthTag();

    return {
      v: 1,
      kekSalt: kekSalt.toString('hex'),
      encryptedDek: encryptedDek.toString('hex'),
      dekIv: dekIv.toString('hex'),
      dekAuthTag: dekAuthTag.toString('hex'),
      ciphertext: ciphertext.toString('hex'),
      payloadIv: payloadIv.toString('hex'),
      payloadAuthTag: payloadAuthTag.toString('hex'),
    };
  }

  public decryptCredential(payload: EncryptedPayload, masterPassphrase: string): string {
    if (!masterPassphrase) {
      throw new Error('Master passphrase cannot be empty');
    }

    try {
      // 1. Derive KEK using stored salt
      const kekSalt = Buffer.from(payload.kekSalt, 'hex');
      const kek = this.deriveKek(masterPassphrase, kekSalt);

      // 2. Decrypt DEK using KEK
      const dekIv = Buffer.from(payload.dekIv, 'hex');
      const dekAuthTag = Buffer.from(payload.dekAuthTag, 'hex');
      const encryptedDek = Buffer.from(payload.encryptedDek, 'hex');

      const dekDecipher = createDecipheriv('aes-256-gcm', kek, dekIv);
      dekDecipher.setAuthTag(dekAuthTag);
      const dek = Buffer.concat([dekDecipher.update(encryptedDek), dekDecipher.final()]);

      // 3. Decrypt Payload using DEK
      const payloadIv = Buffer.from(payload.payloadIv, 'hex');
      const payloadAuthTag = Buffer.from(payload.payloadAuthTag, 'hex');
      const ciphertext = Buffer.from(payload.ciphertext, 'hex');

      const payloadDecipher = createDecipheriv('aes-256-gcm', dek, payloadIv);
      payloadDecipher.setAuthTag(payloadAuthTag);
      const plaintextBuffer = Buffer.concat([
        payloadDecipher.update(ciphertext),
        payloadDecipher.final(),
      ]);

      return plaintextBuffer.toString('utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Decryption failed';
      throw new Error(`Authentication/Decryption failed: ${msg}`);
    }
  }

  /**
   * Master Key Rotation: re-encrypts the Data Encryption Key (DEK) under a new master passphrase
   * without having to re-encrypt the underlying credential payload.
   */
  public rekeyCredential(
    payload: EncryptedPayload,
    oldMasterPassphrase: string,
    newMasterPassphrase: string,
  ): EncryptedPayload {
    if (!oldMasterPassphrase || !newMasterPassphrase) {
      throw new Error('Master passphrases cannot be empty');
    }

    // 1. Decrypt DEK with old master passphrase
    const oldKekSalt = Buffer.from(payload.kekSalt, 'hex');
    const oldKek = this.deriveKek(oldMasterPassphrase, oldKekSalt);

    const dekIv = Buffer.from(payload.dekIv, 'hex');
    const dekAuthTag = Buffer.from(payload.dekAuthTag, 'hex');
    const encryptedDek = Buffer.from(payload.encryptedDek, 'hex');

    const dekDecipher = createDecipheriv('aes-256-gcm', oldKek, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([dekDecipher.update(encryptedDek), dekDecipher.final()]);

    // 2. Re-encrypt DEK with new master passphrase and fresh salt + IV
    const newKekSalt = randomBytes(16);
    const newKek = this.deriveKek(newMasterPassphrase, newKekSalt);
    const newDekIv = randomBytes(12);

    const newDekCipher = createCipheriv('aes-256-gcm', newKek, newDekIv);
    const newEncryptedDek = Buffer.concat([newDekCipher.update(dek), newDekCipher.final()]);
    const newDekAuthTag = newDekCipher.getAuthTag();

    // 3. Return payload with updated KEK envelope and unchanged ciphertext
    return {
      ...payload,
      kekSalt: newKekSalt.toString('hex'),
      encryptedDek: newEncryptedDek.toString('hex'),
      dekIv: newDekIv.toString('hex'),
      dekAuthTag: newDekAuthTag.toString('hex'),
    };
  }
}
