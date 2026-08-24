import { DatabaseSync } from 'node:sqlite';
import { SyncDirection, SyncLedgerEntry, SyncStatus } from '@bucketspace/shared';

export interface ISyncLedgerRepository {
  getEntry(localPath: string): Promise<SyncLedgerEntry | null>;
  getEntryByRemoteId(remoteFileId: string): Promise<SyncLedgerEntry | null>;
  listAll(): Promise<SyncLedgerEntry[]>;
  listPending(): Promise<SyncLedgerEntry[]>;
  listConflicts(): Promise<SyncLedgerEntry[]>;
  upsertEntry(entry: Omit<SyncLedgerEntry, 'version'>): Promise<SyncLedgerEntry>;
  markStatus(localPath: string, status: SyncStatus, errorMessage?: string): Promise<void>;
  markDeleted(localPath: string): Promise<void>;
  deleteEntry(localPath: string): Promise<boolean>;
  getStats(): Promise<{
    totalFiles: number;
    syncedFiles: number;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    failedCount: number;
    totalBytes: number;
  }>;
}

export class SqliteSyncLedgerRepository implements ISyncLedgerRepository {
  constructor(private db: DatabaseSync) {}

  public async getEntry(localPath: string): Promise<SyncLedgerEntry | null> {
    const stmt = this.db.prepare(`
      SELECT local_path, absolute_path, file_size, mtime_ms, sha256_hash,
             remote_file_id, sync_status, direction, error_message,
             retry_count, last_synced_at, version, is_deleted
      FROM sync_ledger
      WHERE local_path = ?
    `);

    const row = stmt.get(localPath) as any;
    if (!row) return null;

    return this.mapRowToEntry(row);
  }

  public async getEntryByRemoteId(remoteFileId: string): Promise<SyncLedgerEntry | null> {
    const stmt = this.db.prepare(`
      SELECT local_path, absolute_path, file_size, mtime_ms, sha256_hash,
             remote_file_id, sync_status, direction, error_message,
             retry_count, last_synced_at, version, is_deleted
      FROM sync_ledger
      WHERE remote_file_id = ?
    `);

    const row = stmt.get(remoteFileId) as any;
    if (!row) return null;

    return this.mapRowToEntry(row);
  }

  public async listAll(): Promise<SyncLedgerEntry[]> {
    const stmt = this.db.prepare(`
      SELECT local_path, absolute_path, file_size, mtime_ms, sha256_hash,
             remote_file_id, sync_status, direction, error_message,
             retry_count, last_synced_at, version, is_deleted
      FROM sync_ledger
      WHERE is_deleted = 0
      ORDER BY local_path ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToEntry(r));
  }

  public async listPending(): Promise<SyncLedgerEntry[]> {
    const stmt = this.db.prepare(`
      SELECT local_path, absolute_path, file_size, mtime_ms, sha256_hash,
             remote_file_id, sync_status, direction, error_message,
             retry_count, last_synced_at, version, is_deleted
      FROM sync_ledger
      WHERE sync_status IN ('PENDING_UPLOAD', 'PENDING_DOWNLOAD', 'SYNCING')
        AND is_deleted = 0
      ORDER BY mtime_ms ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToEntry(r));
  }

  public async listConflicts(): Promise<SyncLedgerEntry[]> {
    const stmt = this.db.prepare(`
      SELECT local_path, absolute_path, file_size, mtime_ms, sha256_hash,
             remote_file_id, sync_status, direction, error_message,
             retry_count, last_synced_at, version, is_deleted
      FROM sync_ledger
      WHERE sync_status = 'CONFLICT'
        AND is_deleted = 0
      ORDER BY mtime_ms DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToEntry(r));
  }

  public async upsertEntry(entry: Omit<SyncLedgerEntry, 'version'>): Promise<SyncLedgerEntry> {
    const stmt = this.db.prepare(`
      INSERT INTO sync_ledger (
        local_path, absolute_path, file_size, mtime_ms, sha256_hash,
        remote_file_id, sync_status, direction, error_message,
        retry_count, last_synced_at, version, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(local_path) DO UPDATE SET
        absolute_path = excluded.absolute_path,
        file_size = excluded.file_size,
        mtime_ms = excluded.mtime_ms,
        sha256_hash = excluded.sha256_hash,
        remote_file_id = COALESCE(excluded.remote_file_id, sync_ledger.remote_file_id),
        sync_status = excluded.sync_status,
        direction = excluded.direction,
        error_message = excluded.error_message,
        retry_count = excluded.retry_count,
        last_synced_at = COALESCE(excluded.last_synced_at, sync_ledger.last_synced_at),
        version = sync_ledger.version + 1,
        is_deleted = excluded.is_deleted
    `);

    stmt.run(
      entry.localPath,
      entry.absolutePath,
      entry.fileSize,
      entry.mtimeMs,
      entry.sha256Hash,
      entry.remoteFileId ?? null,
      entry.syncStatus,
      entry.direction,
      entry.errorMessage ?? null,
      entry.retryCount ?? 0,
      entry.lastSyncedAt ? entry.lastSyncedAt.toISOString() : null,
      entry.isDeleted ? 1 : 0
    );

    const updated = await this.getEntry(entry.localPath);
    if (!updated) {
      throw new Error(`Failed to retrieve upserted sync ledger entry: ${entry.localPath}`);
    }
    return updated;
  }

  public async markStatus(localPath: string, status: SyncStatus, errorMessage?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sync_ledger
      SET sync_status = ?,
          error_message = ?,
          last_synced_at = CASE WHEN ? = 'SYNCED' THEN ? ELSE last_synced_at END,
          version = version + 1
      WHERE local_path = ?
    `);

    const nowIso = new Date().toISOString();
    stmt.run(status, errorMessage ?? null, status, nowIso, localPath);
  }

  public async markDeleted(localPath: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sync_ledger
      SET is_deleted = 1,
          sync_status = 'SYNCED',
          version = version + 1
      WHERE local_path = ?
    `);

    stmt.run(localPath);
  }

  public async deleteEntry(localPath: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM sync_ledger
      WHERE local_path = ?
    `);

    const result = stmt.run(localPath) as any;
    return (result.changes ?? 0) > 0;
  }

  public async getStats(): Promise<{
    totalFiles: number;
    syncedFiles: number;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    failedCount: number;
    totalBytes: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN sync_status = 'SYNCED' AND is_deleted = 0 THEN 1 ELSE 0 END) as synced_count,
        SUM(CASE WHEN sync_status = 'PENDING_UPLOAD' AND is_deleted = 0 THEN 1 ELSE 0 END) as pending_upload_count,
        SUM(CASE WHEN sync_status = 'PENDING_DOWNLOAD' AND is_deleted = 0 THEN 1 ELSE 0 END) as pending_download_count,
        SUM(CASE WHEN sync_status = 'CONFLICT' AND is_deleted = 0 THEN 1 ELSE 0 END) as conflict_count,
        SUM(CASE WHEN sync_status = 'FAILED' AND is_deleted = 0 THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN is_deleted = 0 THEN file_size ELSE 0 END) as total_bytes
      FROM sync_ledger
      WHERE is_deleted = 0
    `);

    const row = stmt.get() as any;
    return {
      totalFiles: Number(row?.total_count || 0),
      syncedFiles: Number(row?.synced_count || 0),
      pendingUploads: Number(row?.pending_upload_count || 0),
      pendingDownloads: Number(row?.pending_download_count || 0),
      conflicts: Number(row?.conflict_count || 0),
      failedCount: Number(row?.failed_count || 0),
      totalBytes: Number(row?.total_bytes || 0),
    };
  }

  private mapRowToEntry(row: any): SyncLedgerEntry {
    return {
      localPath: row.local_path,
      absolutePath: row.absolute_path,
      fileSize: Number(row.file_size),
      mtimeMs: Number(row.mtime_ms),
      sha256Hash: row.sha256_hash,
      remoteFileId: row.remote_file_id ?? undefined,
      syncStatus: row.sync_status as SyncStatus,
      direction: row.direction as SyncDirection,
      errorMessage: row.error_message ?? undefined,
      retryCount: Number(row.retry_count || 0),
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    };
  }
}
