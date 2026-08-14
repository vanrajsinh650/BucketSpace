import { createHash, randomBytes } from 'node:crypto';
import { CreateShareOptions, IShareProvider, ShareLink } from './share-provider.interface';

export interface StoredShareRecord {
  fileId: string;
  baseUrl: string;
  createdAt: Date;
  expiresAt?: Date;
  passcodeHash?: string;
  maxDownloads?: number;
  downloadCount: number;
}

/**
 * TokenShareProvider generates secure, time-bound access links.
 * Security Invariants:
 * 1. Primary security boundary is a 256-bit cryptographically secure random token.
 * 2. Share tokens are stored HASHED at rest (SHA-256 digest) so database/memory leakage
 *    never reveals active share URLs. Zero raw token strings in stored values.
 * 3. Atomic download caps, scrypt passcode verification, and expiration checks.
 */
export class TokenShareProvider implements IShareProvider {
  public readonly providerId = 'token-share';
  // Storage key is tokenHash (SHA-256 of rawToken) -> StoredShareRecord (zero raw tokens stored at rest)
  private readonly shares = new Map<string, StoredShareRecord>();

  /** Compute SHA-256 digest of a raw token string */
  public static hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  public async createShareLink(
    fileId: string,
    options?: CreateShareOptions
  ): Promise<ShareLink> {
    // 1. Generate 256-bit (32-byte) cryptographically secure random share token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = TokenShareProvider.hashToken(rawToken);

    const baseUrl = options?.baseUrl ?? 'http://localhost:3000';
    const expiresAt = options?.expiresInSeconds
      ? new Date(Date.now() + options.expiresInSeconds * 1000)
      : undefined;

    // Store strictly hashed token at rest (zero raw token in stored value map)
    this.shares.set(tokenHash, {
      fileId,
      baseUrl,
      createdAt: new Date(),
      expiresAt,
      passcodeHash: options?.passcodeHash,
      maxDownloads: options?.maxDownloads,
      downloadCount: 0,
    });

    return {
      shareId: rawToken,
      fileId,
      url: `${baseUrl}/share/${rawToken}`,
      createdAt: new Date(),
      expiresAt,
      passcodeHash: options?.passcodeHash,
      maxDownloads: options?.maxDownloads,
      downloadCount: 0,
    };
  }

  public async revokeShareLink(rawToken: string): Promise<boolean> {
    const tokenHash = TokenShareProvider.hashToken(rawToken);
    return this.shares.delete(tokenHash);
  }

  public async getShareLink(rawToken: string): Promise<ShareLink | null> {
    const tokenHash = TokenShareProvider.hashToken(rawToken);
    const record = this.shares.get(tokenHash);
    if (!record) return null;

    // Expiration boundary check (at or past expiresAt is rejected)
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      this.shares.delete(tokenHash);
      return null;
    }

    // Max downloads cap check
    if (record.maxDownloads !== undefined && record.downloadCount >= record.maxDownloads) {
      return null;
    }

    return {
      shareId: rawToken,
      fileId: record.fileId,
      url: `${record.baseUrl}/share/${rawToken}`,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      passcodeHash: record.passcodeHash,
      maxDownloads: record.maxDownloads,
      downloadCount: record.downloadCount,
    };
  }

  /**
   * Atomic download consumption check.
   * Looks up share link by SHA-256 of rawToken, verifies passcode & caps, then increments.
   */
  public async consumeDownload(
    rawToken: string,
    passcodeVerifier?: (storedHash: string) => Promise<boolean>
  ): Promise<boolean> {
    const tokenHash = TokenShareProvider.hashToken(rawToken);
    const link = this.shares.get(tokenHash);
    if (!link) return false;

    // 1. Expiration check: at or past expiresAt is rejected
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      this.shares.delete(tokenHash);
      return false;
    }

    // 2. Passcode verification check
    if (link.passcodeHash) {
      if (!passcodeVerifier) return false;
      const validPasscode = await passcodeVerifier(link.passcodeHash);
      if (!validPasscode) return false;
    }

    // 3. Atomic max downloads check & increment
    if (link.maxDownloads !== undefined && link.downloadCount >= link.maxDownloads) {
      return false;
    }

    link.downloadCount++;
    return true;
  }
}
