/* ─── Security Domain Contracts ─── */

/** Payload structure returned by ICredentialVault.encryptCredential() */
export interface EncryptedPayload {
  v: number;              // Version identifier (e.g. 1)
  kekSalt: string;        // Hex-encoded salt for Key Encryption Key derivation
  encryptedDek: string;   // Hex-encoded encrypted Data Encryption Key
  dekIv: string;          // Hex-encoded 12-byte IV for DEK
  dekAuthTag: string;     // Hex-encoded 16-byte Auth Tag for DEK
  ciphertext: string;     // Hex-encoded encrypted secret payload
  payloadIv: string;      // Hex-encoded 12-byte IV for payload
  payloadAuthTag: string; // Hex-encoded 16-byte Auth Tag for payload
}

/**
 * Envelope Encryption Vault contract for securing provider credentials at rest.
 * Uses master passphrase to derive Key Encryption Key (KEK), which protects a unique
 * Data Encryption Key (DEK) for each credential payload (AES-256-GCM).
 */
export interface ICredentialVault {
  encryptCredential(plaintext: string, masterPassphrase: string): EncryptedPayload;
  decryptCredential(payload: EncryptedPayload, masterPassphrase: string): string;
}

/**
 * Adaptive Passcode Hasher contract for public share links.
 * Uses memory/work-hard hashing algorithms (scrypt) with random salt
 * and constant-time comparison to prevent brute force and timing attacks.
 */
export interface IPasscodeHasher {
  hashPasscode(passcode: string): Promise<string>;
  verifyPasscode(passcode: string, storedHash: string): Promise<boolean>;
}
