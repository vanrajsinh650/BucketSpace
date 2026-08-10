import { DatabaseSync } from 'node:sqlite';
import {
  ChunkId,
  ChunkMetadata,
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
  FileStatus,
  ProviderChunkRef,
  TransferState,
} from '@bucketspace/shared';
import { IMetadataRepository, ListFilesOptions } from '../repository.interface';
import { createSqliteDatabase } from './database';

interface FileRow {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  whole_file_hash: string;
  transfer_status: string;
  file_status: string;
  created_at: string;
  updated_at: string;
}

interface ChunkRow {
  id: string;
  file_id: string;
  chunk_index: number;
  size: number;
  hash: string;
  provider_id: string;
  provider_ref_json: string;
}

export class SqliteMetadataRepository implements IMetadataRepository {
  private readonly db: DatabaseSync;

  constructor(filepathOrDb: string | DatabaseSync = ':memory:') {
    if (typeof filepathOrDb === 'string') {
      this.db = createSqliteDatabase(filepathOrDb);
    } else {
      this.db = filepathOrDb;
    }
  }

  public async createFile(file: FileMetadata, transferStatus: TransferState = 'PENDING'): Promise<FileMetadata> {
    const createdAtIso = file.createdAt ? file.createdAt.toISOString() : new Date().toISOString();
    const updatedAtIso = file.updatedAt ? file.updatedAt.toISOString() : createdAtIso;
    const fileStatus = file.status ?? 'ACTIVE';

    this.db.exec('BEGIN TRANSACTION');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        file.id,
        file.name,
        file.size,
        file.mimeType,
        file.wholeFileHash,
        transferStatus,
        fileStatus,
        createdAtIso,
        updatedAtIso
      );

      if (file.chunks && file.chunks.length > 0) {
        const chunkStmt = this.db.prepare(`
          INSERT INTO chunks (id, file_id, chunk_index, size, hash, provider_id, provider_ref_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const chunk of file.chunks) {
          const providerId = chunk.providerRef?.providerId ?? 'none';
          const providerRefJson = chunk.providerRef ? JSON.stringify(chunk.providerRef) : JSON.stringify(null);

          chunkStmt.run(
            chunk.id,
            file.id,
            chunk.index,
            chunk.size,
            chunk.hash,
            providerId,
            providerRefJson
          );
        }
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return (await this.getFileById(file.id))!;
  }

  public async getFileById(id: FileId): Promise<FileMetadata | null> {
    const fileStmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
    const fileRow = fileStmt.get(id) as FileRow | undefined;

    if (!fileRow) {
      return null;
    }

    const chunkStmt = this.db.prepare('SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC');
    const chunkRows = chunkStmt.all(id) as unknown as ChunkRow[];

    const chunks: ChunkMetadata[] = chunkRows.map((row) => {
      let providerRef: ProviderChunkRef | undefined = undefined;
      if (row.provider_ref_json && row.provider_ref_json !== 'null') {
        providerRef = JSON.parse(row.provider_ref_json) as ProviderChunkRef;
      }

      return {
        id: createChunkId(row.id),
        fileId: createFileId(row.file_id),
        index: row.chunk_index,
        size: row.size,
        hash: row.hash,
        providerRef,
      };
    });

    return {
      id: createFileId(fileRow.id),
      name: fileRow.name,
      size: fileRow.size,
      mimeType: fileRow.mime_type,
      wholeFileHash: fileRow.whole_file_hash,
      status: (fileRow.file_status ?? 'ACTIVE') as FileStatus,
      createdAt: new Date(fileRow.created_at),
      updatedAt: new Date(fileRow.updated_at),
      chunks,
    };
  }

  public async listFiles(options?: ListFilesOptions): Promise<FileMetadata[]> {
    const includeTrashed = options?.includeTrashed ?? false;
    let query = 'SELECT id FROM files WHERE file_status = \'ACTIVE\' ORDER BY created_at DESC';
    if (includeTrashed) {
      query = 'SELECT id FROM files ORDER BY created_at DESC';
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as unknown as { id: string }[];

    const result: FileMetadata[] = [];
    for (const row of rows) {
      const file = await this.getFileById(createFileId(row.id));
      if (file) {
        result.push(file);
      }
    }

    return result;
  }

  public async searchFiles(query: string, options?: ListFilesOptions): Promise<FileMetadata[]> {
    const includeTrashed = options?.includeTrashed ?? false;
    const pattern = `%${query.trim().toLowerCase()}%`;

    let sql = `
      SELECT id FROM files
      WHERE (LOWER(name) LIKE ? OR LOWER(mime_type) LIKE ?)
      AND file_status = 'ACTIVE'
      ORDER BY created_at DESC
    `;

    if (includeTrashed) {
      sql = `
        SELECT id FROM files
        WHERE (LOWER(name) LIKE ? OR LOWER(mime_type) LIKE ?)
        ORDER BY created_at DESC
      `;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(pattern, pattern) as unknown as { id: string }[];

    const result: FileMetadata[] = [];
    for (const row of rows) {
      const file = await this.getFileById(createFileId(row.id));
      if (file) {
        result.push(file);
      }
    }

    return result;
  }

  public async saveChunk(chunk: ChunkMetadata): Promise<void> {
    const providerId = chunk.providerRef?.providerId ?? 'none';
    const providerRefJson = chunk.providerRef ? JSON.stringify(chunk.providerRef) : JSON.stringify(null);

    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, file_id, chunk_index, size, hash, provider_id, provider_ref_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id, chunk_index) DO UPDATE SET
        id = excluded.id,
        size = excluded.size,
        hash = excluded.hash,
        provider_id = excluded.provider_id,
        provider_ref_json = excluded.provider_ref_json
    `);

    stmt.run(
      chunk.id,
      chunk.fileId,
      chunk.index,
      chunk.size,
      chunk.hash,
      providerId,
      providerRefJson
    );
  }

  public async saveChunksBulk(chunks: ChunkMetadata[]): Promise<void> {
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const chunk of chunks) {
        await this.saveChunk(chunk);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public async updateFileStatus(id: FileId, status: TransferState): Promise<void> {
    const updatedAtIso = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE files SET transfer_status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, updatedAtIso, id);
  }

  /** Soft-delete file metadata by setting file_status to TRASHED */
  public async deleteFileMetadata(id: FileId): Promise<boolean> {
    const updatedAtIso = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE files SET file_status = \'TRASHED\', updated_at = ? WHERE id = ?');
    const result = stmt.run(updatedAtIso, id);
    return result.changes > 0;
  }

  /** Restore soft-deleted file metadata by setting file_status back to ACTIVE */
  public async restoreFileMetadata(id: FileId): Promise<boolean> {
    const updatedAtIso = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE files SET file_status = \'ACTIVE\', updated_at = ? WHERE id = ?');
    const result = stmt.run(updatedAtIso, id);
    return result.changes > 0;
  }

  /** Permanently purge file metadata and associated chunks from SQLite DB */
  public async purgeFileMetadata(id: FileId): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public async close(): Promise<void> {
    this.db.close();
  }
}
