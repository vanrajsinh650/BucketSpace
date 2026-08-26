import path from 'path';
import { SyncLedgerEntry } from '@bucketspace/shared';

export type ReconciliationActionType =
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'CONFLICT'
  | 'NOOP'
  | 'DELETE_REMOTE'
  | 'DELETE_LOCAL';

export interface LocalFileState {
  localPath: string;
  absolutePath: string;
  fileSize: number;
  mtimeMs: number;
  sha256Hash: string;
  exists: boolean;
}

export interface RemoteFileState {
  fileId: string;
  name: string;
  fileSize: number;
  wholeFileHash: string;
  updatedAt: Date;
}

export interface ReconciliationDecision {
  action: ReconciliationActionType;
  localPath: string;
  remoteFileId?: string;
  reason: string;
  conflictDetails?: {
    originalPath: string;
    forkPath: string;
  };
}

export class ReconciliationEngine {
  /**
   * Reconciles the state between local filesystem, SQLite sync ledger, and remote storage.
   */
  public static reconcile(
    local: LocalFileState | null,
    ledger: SyncLedgerEntry | null,
    remote: RemoteFileState | null
  ): ReconciliationDecision {
    const localPath = local?.localPath ?? ledger?.localPath ?? remote?.name ?? 'unknown';

    // Case 1: Brand new local file (not in ledger, not on remote)
    if (local?.exists && !ledger && !remote) {
      return {
        action: 'UPLOAD',
        localPath,
        reason: 'New local file detected',
      };
    }

    // Case 2: Brand new remote file (not in ledger, not on local disk)
    if (!local?.exists && !ledger && remote) {
      return {
        action: 'DOWNLOAD',
        localPath: remote.name,
        remoteFileId: remote.fileId,
        reason: 'New remote file found on storage provider',
      };
    }

    // Case 3: Both local and remote exist, but never recorded in ledger
    if (local?.exists && !ledger && remote) {
      if (local.sha256Hash === remote.wholeFileHash) {
        return {
          action: 'NOOP',
          localPath,
          remoteFileId: remote.fileId,
          reason: 'Local and remote files already have identical SHA-256 digests',
        };
      } else {
        // Both exist with different hashes -> Conflict
        return this.createConflictDecision(localPath, remote.fileId, 'Local and remote exist with different hashes');
      }
    }

    // Case 4: File was tracked in ledger
    if (ledger) {
      const localChanged = local?.exists && local.sha256Hash !== ledger.sha256Hash;
      const remoteChanged = remote && remote.wholeFileHash !== ledger.sha256Hash;

      // Subcase 4A: Neither changed
      if (!localChanged && !remoteChanged && local?.exists && remote) {
        return {
          action: 'NOOP',
          localPath,
          remoteFileId: remote.fileId,
          reason: 'File is up to date and verified',
        };
      }

      // Subcase 4B: Local changed, Remote unchanged -> Fast-forward upload
      if (localChanged && !remoteChanged) {
        return {
          action: 'UPLOAD',
          localPath,
          remoteFileId: remote?.fileId ?? ledger.remoteFileId,
          reason: 'Local file modified; uploading changes to remote',
        };
      }

      // Subcase 4C: Remote changed, Local unchanged -> Fast-forward download
      if (remoteChanged && !localChanged) {
        return {
          action: 'DOWNLOAD',
          localPath,
          remoteFileId: remote.fileId,
          reason: 'Remote file updated; downloading latest version',
        };
      }

      // Subcase 4D: Both modified concurrently -> Conflict (Non-destructive Fork)
      if (localChanged && remoteChanged) {
        if (local && remote && local.sha256Hash === remote.wholeFileHash) {
          return {
            action: 'NOOP',
            localPath,
            remoteFileId: remote.fileId,
            reason: 'Concurrent updates resulted in identical content',
          };
        }
        return this.createConflictDecision(
          localPath,
          remote?.fileId,
          'Both local file and remote cloud version were modified concurrently'
        );
      }

      // Subcase 4E: Local was deleted, remote still exists
      if (!local?.exists && remote) {
        return {
          action: 'DOWNLOAD',
          localPath,
          remoteFileId: remote.fileId,
          reason: 'File deleted locally but present on remote; restoring',
        };
      }

      // Subcase 4F: Remote was deleted, local still exists
      if (local?.exists && !remote) {
        return {
          action: 'UPLOAD',
          localPath,
          reason: 'File present locally but missing on remote; re-uploading',
        };
      }
    }

    return {
      action: 'NOOP',
      localPath,
      reason: 'No reconciliation action needed',
    };
  }

  /**
   * Generates a non-destructive conflict fork file path:
   * e.g., "Documents/proposal (Conflict 2026-08-24-143000).pdf"
   */
  public static generateConflictForkPath(originalPath: string, date = new Date()): string {
    const parsed = path.parse(originalPath);
    const timestampStr = date
      .toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '')
      .slice(0, 15); // "2026-08-24-1430"

    const forkName = `${parsed.name} (Conflict ${timestampStr})${parsed.ext}`;
    return parsed.dir ? `${parsed.dir}/${forkName}` : forkName;
  }

  private static createConflictDecision(
    localPath: string,
    remoteFileId?: string,
    reason?: string
  ): ReconciliationDecision {
    const forkPath = this.generateConflictForkPath(localPath);
    return {
      action: 'CONFLICT',
      localPath,
      remoteFileId,
      reason: reason ?? 'Concurrent conflict detected',
      conflictDetails: {
        originalPath: localPath,
        forkPath,
      },
    };
  }
}
