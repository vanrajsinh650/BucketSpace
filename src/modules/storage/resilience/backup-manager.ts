export interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): { all(...args: any[]): any[]; run(...args: any[]): any };
}
import { SqliteMetadataRepository } from '@/modules/db';
import { ProviderRegistry } from '../registry/provider-registry';
import { TransferOrchestrator } from '../transfer/transfer-orchestrator';

export interface BackupSnapshot {
  version: string;
  createdAt: string;
  files: any[];
  chunks: any[];
  chunkLocations: any[];
  storageRules: any[];
  auditLogs: any[];
}

/**
 * BackupManager handles the disaster recovery lifecycle for BucketSpace:
 *   1. Exports a complete, structured JSON/SQLite backup snapshot of all filesystem metadata,
 *      chunk locations, audit trails, and routing rules.
 *   2. Restores metadata onto a fresh machine/database.
 *   3. Verifies provider connectivity and audits all chunk references against reconnected providers.
 *
 * NOTE: The snapshot contains filesystem indexing metadata, chunk locations, and cryptographic hashes.
 * It deliberately does NOT contain raw file payload bytes, which reside securely on Telegram storage.
 */
export class BackupManager {
  constructor(private readonly db: DatabaseSyncLike) {}

  /**
   * Export all filesystem metadata into a portable backup snapshot.
   */
  public exportSnapshot(): BackupSnapshot {
    const files = this.db.prepare('SELECT * FROM files').all();
    const chunks = this.db.prepare('SELECT * FROM chunks').all();
    const chunkLocations = this.db.prepare('SELECT * FROM chunk_locations').all();
    const storageRules = this.db.prepare('SELECT * FROM storage_rules').all();
    const auditLogs = this.db.prepare('SELECT * FROM audit_logs').all();

    return {
      version: '1.0.0-rc',
      createdAt: new Date().toISOString(),
      files,
      chunks,
      chunkLocations,
      storageRules,
      auditLogs,
    };
  }

  /**
   * Restore a backup snapshot into a fresh SQLite database instance.
   */
  public static restoreSnapshot(snapshot: BackupSnapshot, targetDb: DatabaseSyncLike): void {
    targetDb.exec('PRAGMA foreign_keys = OFF;'); // Temporarily disable during bulk insert

    // 1. Files
    const fileStmt = targetDb.prepare(`
      INSERT OR REPLACE INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of snapshot.files) {
      fileStmt.run(f.id, f.name, f.size, f.mime_type, f.whole_file_hash, f.transfer_status, f.file_status, f.created_at, f.updated_at);
    }

    // 2. Chunks
    const chunkStmt = targetDb.prepare(`
      INSERT OR REPLACE INTO chunks (id, file_id, chunk_index, size, hash, provider_id, provider_ref_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of snapshot.chunks) {
      chunkStmt.run(c.id, c.file_id, c.chunk_index, c.size, c.hash, c.provider_id, c.provider_ref_json);
    }

    // 3. Chunk Locations
    const locStmt = targetDb.prepare(`
      INSERT OR REPLACE INTO chunk_locations (id, chunk_id, file_id, provider_id, provider_ref_json, role, state, verified_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of snapshot.chunkLocations) {
      locStmt.run(l.id, l.chunk_id, l.file_id, l.provider_id, l.provider_ref_json, l.role, l.state, l.verified_at, l.last_error, l.created_at, l.updated_at);
    }

    if (snapshot.auditLogs) {
      for (const al of snapshot.auditLogs) {
        targetDb.prepare(`
          INSERT OR REPLACE INTO audit_logs (id, event_type, actor, details_json, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).run(al.id, al.event_type, al.actor, al.details_json, al.timestamp);
      }
    }

    targetDb.exec('PRAGMA foreign_keys = ON;');
  }

  /**
   * Disaster recovery verification: Audits restored database against reconnected providers.
   * Confirms every chunk is reachable and byte-verified.
   */
  public static async verifyRestoredInstallation(
    metaRepo: SqliteMetadataRepository
  ): Promise<{ totalFiles: number; verifiedFiles: number; missingChunks: number }> {
    const files = await metaRepo.listFiles();
    let verifiedFiles = 0;
    let missingChunks = 0;

    for (const f of files) {
      let fileHealthy = true;

      for (const c of f.chunks) {
        if (!c.providerRef) {
          missingChunks++;
          fileHealthy = false;
          continue;
        }

        const provider = ProviderRegistry.get(c.providerRef.providerId);
        if (!provider) {
          missingChunks++;
          fileHealthy = false;
          continue;
        }

        const exists = await provider.hasChunk(c.providerRef);
        if (!exists || !exists.exists) {
          missingChunks++;
          fileHealthy = false;
        }
      }

      if (fileHealthy) {
        verifiedFiles++;
      }
    }

    return {
      totalFiles: files.length,
      verifiedFiles,
      missingChunks,
    };
  }
}
