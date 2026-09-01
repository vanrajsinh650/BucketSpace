/**
 * Domain contracts and event types for the Background Folder Auto-Sync Daemon.
 */

export type SyncStatus =
  | 'SYNCED'
  | 'PENDING_UPLOAD'
  | 'PENDING_DOWNLOAD'
  | 'SYNCING'
  | 'CONFLICT'
  | 'FAILED';

export type SyncDirection = 'UPLOAD' | 'DOWNLOAD' | 'IDLE';

export type SyncEventType =
  | 'SYNC_STARTED'
  | 'CHUNK_UPLOADED'
  | 'SYNC_COMPLETED'
  | 'SYNC_ERROR'
  | 'SYNC_CONFLICT'
  | 'FOLDER_SCAN_STARTED'
  | 'FOLDER_SCAN_COMPLETED';

export interface SyncProgressPayload {
  syncJobId: string;
  folderPath: string;
  localPath: string;
  fileName: string;
  fileSize: number;
  direction: SyncDirection;
  currentChunk?: number;
  totalChunks?: number;
  bytesTransferred: number;
  percent: number;
  status: SyncStatus;
  error?: string;
  conflictPath?: string;
  timestamp: number;
}

export interface SyncEvent {
  type: SyncEventType;
  payload: SyncProgressPayload;
  timestamp: number;
}

export interface SyncLedgerEntry {
  localPath: string;
  absolutePath: string;
  fileSize: number;
  mtimeMs: number;
  sha256Hash: string;
  remoteFileId?: string;
  syncStatus: SyncStatus;
  direction: SyncDirection;
  errorMessage?: string;
  retryCount: number;
  lastSyncedAt?: Date;
  version: number;
  isDeleted: boolean;
}

export interface SyncDaemonConfig {
  syncRootDir: string;
  dbPath?: string;
  debounceMs?: number;
  concurrency?: number;
  ignorePatterns?: string[];
  autoDeleteRemote?: boolean;
}

export interface SyncDaemonStats {
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'ERROR';
  syncRootDir: string;
  totalFiles: number;
  syncedFiles: number;
  pendingUploads: number;
  pendingDownloads: number;
  conflicts: number;
  failedCount: number;
  totalBytes: number;
  lastScanAt?: Date;
}
