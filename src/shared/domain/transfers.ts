import { FileId } from './ids';

export type TransferState =
  | 'PENDING'
  | 'CHUNKING'
  | 'UPLOADING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED';

/**
 * Public Share Link domain interface with security controls:
 * - passcodeHash: scrypt adaptive hash of optional user passcode
 * - maxDownloads: optional maximum download cap
 * - downloadCount: total downloads consumed
 * - expiresAt: optional expiration timestamp
 */
export interface ShareLink {
  token: string;
  fileId: FileId;
  expiresAt?: Date;
  passcodeHash?: string;
  maxDownloads?: number;
  downloadCount: number;
  createdAt: Date;
}
