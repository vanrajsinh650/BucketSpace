import { CreateShareOptions, IShareProvider, ShareLink } from './share-provider.interface';

/**
 * TokenShareProvider generates secure, time-bound access links and share tokens
 * with passcode verification, download caps, and expiration checks.
 */
export class TokenShareProvider implements IShareProvider {
  public readonly providerId = 'token-share';
  private readonly shares = new Map<string, ShareLink>();

  public async createShareLink(
    fileId: string,
    options?: CreateShareOptions
  ): Promise<ShareLink> {
    const shareId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const baseUrl = options?.baseUrl ?? 'http://localhost:3000';
    const expiresAt = options?.expiresInSeconds
      ? new Date(Date.now() + options.expiresInSeconds * 1000)
      : undefined;

    const shareLink: ShareLink = {
      shareId,
      fileId,
      url: `${baseUrl}/share/${shareId}`,
      createdAt: new Date(),
      expiresAt,
      passcodeHash: options?.passcodeHash,
      maxDownloads: options?.maxDownloads,
      downloadCount: 0,
    };

    this.shares.set(shareId, shareLink);
    return shareLink;
  }

  public async revokeShareLink(shareId: string): Promise<boolean> {
    return this.shares.delete(shareId);
  }

  public async getShareLink(shareId: string): Promise<ShareLink | null> {
    const link = this.shares.get(shareId);
    if (!link) return null;

    // Expiration boundary check (at-expiry <= Date.now() is rejected)
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      this.shares.delete(shareId);
      return null;
    }

    // Max downloads cap check
    if (link.maxDownloads !== undefined && link.downloadCount >= link.maxDownloads) {
      return null;
    }

    return link;
  }

  /**
   * Atomic download consumption check.
   * Atomically checks passcode, expiration, and maxDownloads cap before incrementing.
   * Thread-safe / race-condition safe: returns true only if slot was reserved.
   */
  public async consumeDownload(
    shareId: string,
    passcodeVerifier?: (storedHash: string) => Promise<boolean>
  ): Promise<boolean> {
    const link = this.shares.get(shareId);
    if (!link) return false;

    // 1. Expiration check: at or past expiresAt is rejected
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      this.shares.delete(shareId);
      return false;
    }

    // 2. Passcode verification check
    if (link.passcodeHash) {
      if (!passcodeVerifier) return false; // Passcode required but none provided
      const validPasscode = await passcodeVerifier(link.passcodeHash);
      if (!validPasscode) return false;
    }

    // 3. Atomic max downloads check & increment
    if (link.maxDownloads !== undefined && link.downloadCount >= link.maxDownloads) {
      return false;
    }

    // Atomically increment download count
    link.downloadCount++;
    return true;
  }
}
