/**
 * Real Client-Side AES-256-GCM Encryption Service for BucketSpace.
 *
 * Utilizes standard WebCrypto API (crypto.subtle) available in modern browsers and Node.js 18+.
 *
 * Security Architecture:
 * 1. Master Vault Key: 256-bit AES-GCM key generated or derived strictly on the client device.
 * 2. Chunk Encryption: Each 4 MB chunk receives a unique random 12-byte IV (96-bit).
 * 3. Tamper-Proof Envelope: Transmitted chunk = [12-byte IV (12B) | Ciphertext | GCM Auth Tag (16B)].
 * 4. Zero-Knowledge: Encryption keys NEVER leave client memory and are never sent to Telegram or API routes.
 */

// WebCrypto abstraction compatible with browser and Node.js
function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj =
    (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) ||
    (typeof window !== 'undefined' ? window.crypto : undefined);
  if (cryptoObj?.subtle) {
    return cryptoObj.subtle;
  }
  throw new Error('WebCrypto subtle is not available in current environment');
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj =
    (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) ||
    (typeof window !== 'undefined' ? window.crypto : undefined);
  if (cryptoObj?.getRandomValues) {
    return cryptoObj.getRandomValues(bytes);
  }
  throw new Error('WebCrypto getRandomValues is not available in current environment');
}

export class ClientEncryptionService {
  private static cachedKey: CryptoKey | null = null;
  private static readonly STORAGE_KEY = 'bucketspace_vault_master_key_v1';
  public static readonly IV_LENGTH_BYTES = 12;
  public static readonly AUTH_TAG_LENGTH_BYTES = 16;

  /**
   * Generates a fresh 256-bit AES-GCM CryptoKey.
   */
  public static async generateMasterKey(): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    return subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable for local persistence
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exports a CryptoKey to a raw hex string for local storage encryption.
   */
  public static async exportKeyToHex(key: CryptoKey): Promise<string> {
    const subtle = getSubtleCrypto();
    const raw = await subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(raw))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Imports a raw hex string into a CryptoKey.
   */
  public static async importKeyFromHex(hex: string): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    const cleanHex = hex.trim().toLowerCase();
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }

    return subtle.importKey(
      'raw',
      bytes,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derives a deterministic AES-GCM 256-bit key from a user passphrase using PBKDF2.
   */
  public static async deriveKeyFromPassphrase(passphrase: string, saltHex?: string): Promise<{ key: CryptoKey; saltHex: string }> {
    const subtle = getSubtleCrypto();
    const encoder = new TextEncoder();
    const saltBytes = saltHex
      ? new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
      : getRandomBytes(16);

    const baseKey = await subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const generatedSaltHex = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { key, saltHex: generatedSaltHex };
  }

  /**
   * Retrieves or initializes the client device master vault key.
   * Persisted locally in browser localStorage (never sent to server or Telegram).
   */
  public static async getOrCreateClientKey(): Promise<CryptoKey> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const savedHex = localStorage.getItem(this.STORAGE_KEY);
      if (savedHex && savedHex.length === 64) {
        try {
          const key = await this.importKeyFromHex(savedHex);
          this.cachedKey = key;
          return key;
        } catch {
          // If stored key fails import, re-generate below
        }
      }
    }

    // Generate fresh high-entropy 256-bit AES-GCM key
    const freshKey = await this.generateMasterKey();
    this.cachedKey = freshKey;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const hex = await this.exportKeyToHex(freshKey);
        localStorage.setItem(this.STORAGE_KEY, hex);
      } catch {
        // ignore localStorage quota error
      }
    }

    return freshKey;
  }

  /**
   * Retrieves the raw hex string of the client device master vault key from localStorage.
   * Used for generating client-side zero-knowledge share links (appended to URL hash fragment).
   */
  public static getMasterKeyHex(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedHex = localStorage.getItem(this.STORAGE_KEY);
      if (savedHex && savedHex.length === 64) {
        return savedHex;
      }
    }
    return null;
  }

  /**
   * Encrypts a binary chunk with AES-256-GCM.
   *
   * Prepends a random 12-byte IV to the ciphertext:
   * Output Format: [12-byte IV (12B) | Ciphertext (NB) | Auth Tag (16B)]
   * Total Output Length = chunk.byteLength + 12 + 16 (chunk.byteLength + 28)
   */
  public static async encryptChunk(
    chunkData: Uint8Array,
    key?: CryptoKey
  ): Promise<Uint8Array> {
    const subtle = getSubtleCrypto();
    const activeKey = key || (await this.getOrCreateClientKey());
    const iv = getRandomBytes(this.IV_LENGTH_BYTES);

    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      activeKey,
      chunkData as unknown as BufferSource
    );

    const ciphertextBytes = new Uint8Array(ciphertextBuffer);

    // Merge: [12 bytes IV | Ciphertext with 16-byte Auth Tag]
    const combined = new Uint8Array(this.IV_LENGTH_BYTES + ciphertextBytes.byteLength);
    combined.set(iv, 0);
    combined.set(ciphertextBytes, this.IV_LENGTH_BYTES);

    return combined;
  }

  /**
   * Decrypts a binary chunk with AES-256-GCM.
   *
   * Extracts the initial 12-byte IV and decrypts the remaining ciphertext.
   * If ciphertext or auth tag is tampered with, throws a cryptographic authentication error.
   */
  public static async decryptChunk(
    encryptedData: Uint8Array,
    key?: CryptoKey
  ): Promise<Uint8Array> {
    if (encryptedData.byteLength < this.IV_LENGTH_BYTES + this.AUTH_TAG_LENGTH_BYTES) {
      throw new Error(
        `Invalid encrypted chunk size (${encryptedData.byteLength} bytes). Minimum size is ${
          this.IV_LENGTH_BYTES + this.AUTH_TAG_LENGTH_BYTES
        } bytes.`
      );
    }

    const subtle = getSubtleCrypto();
    const activeKey = key || (await this.getOrCreateClientKey());

    // Extract 12-byte IV
    const iv = encryptedData.slice(0, this.IV_LENGTH_BYTES);
    // Extract remaining ciphertext (includes 16-byte auth tag at end)
    const ciphertext = encryptedData.slice(this.IV_LENGTH_BYTES);

    try {
      const plaintextBuffer = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as unknown as BufferSource,
        },
        activeKey,
        ciphertext as unknown as BufferSource
      );

      return new Uint8Array(plaintextBuffer);
    } catch (err: any) {
      throw new Error(
        `Client decryption failed: Cryptographic authentication tag mismatch or invalid key. (Raw: ${err?.message || 'AuthenticationError'})`
      );
    }
  }

  /**
   * Resets in-memory cached key (used for logout or key rotation).
   */
  public static clearCachedKey(): void {
    this.cachedKey = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
