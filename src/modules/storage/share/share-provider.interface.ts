import { ShareLink } from '@/shared';

export type { ShareLink };


export interface CreateShareOptions {
  expiresInSeconds?: number;
  baseUrl?: string;
  passcodeHash?: string;
  maxDownloads?: number;
}

export interface IShareProvider {
  readonly providerId: string;
  createShareLink(fileId: string, options?: CreateShareOptions): Promise<ShareLink>;
  revokeShareLink(shareId: string): Promise<boolean>;
  getShareLink(shareId: string): Promise<ShareLink | null>;
  consumeDownload(shareId: string, passcodeVerifier?: (hash: string) => Promise<boolean>): Promise<boolean>;
}
