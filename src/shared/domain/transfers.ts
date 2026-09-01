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
 * - shareId / token: 256-bit cryptographically secure access identifier
 * - url: optional full public share URL
 * - passcodeHash: scrypt adaptive hash of optional user passcode
 * - maxDownloads: optional maximum download cap
 * - downloadCount: total downloads consumed
 * - expiresAt: optional expiration timestamp
 */
export interface ShareLink {
  shareId: string;
  token?: string;
  fileId: FileId | string;
  url?: string;
  expiresAt?: Date;
  passcodeHash?: string;
  maxDownloads?: number;
  downloadCount: number;
  createdAt: Date;
}

