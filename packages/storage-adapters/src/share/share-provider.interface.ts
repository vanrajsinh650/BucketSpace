export interface ShareLink {
  shareId: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface IShareProvider {
  readonly providerId: string;
  createShareLink(fileId: string, options?: { expiresInSeconds?: number; baseUrl?: string }): Promise<ShareLink>;
  revokeShareLink(shareId: string): Promise<boolean>;
  getShareLink(shareId: string): Promise<ShareLink | null>;
}
