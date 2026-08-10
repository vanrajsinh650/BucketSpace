import { IShareProvider, ShareLink } from './share-provider.interface';

/**
 * TokenShareProvider generates secure, time-bound access links and share tokens
 * without exposing raw Telegram message IDs or backend bucket URLs.
 */
export class TokenShareProvider implements IShareProvider {
  public readonly providerId = 'token-share';
  private readonly shares = new Map<string, ShareLink>();

  public async createShareLink(
    fileId: string,
    options?: { expiresInSeconds?: number; baseUrl?: string }
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

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      this.shares.delete(shareId);
      return null;
    }

    return link;
  }
}
