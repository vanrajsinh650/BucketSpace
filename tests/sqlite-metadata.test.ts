import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSqliteDatabase } from '../src/modules/db/sqlite/database';
import { SqliteMetadataRepository } from '../src/modules/db/sqlite/sqlite-metadata-repository';
import { AuditLogRepository } from '../src/modules/db/sqlite/audit-log-repository';
import { createFileId, FileMetadata } from '../src/shared';

describe('SQLite Metadata & Audit Log Engine', () => {
  it('should initialize SQLite tables and support full file CRUD and audit lifecycle', async () => {
    const tempDbPath = path.join(os.tmpdir(), `bucketspace-db-${Date.now()}.sqlite`);
    const db = createSqliteDatabase(tempDbPath);
    const repo = new SqliteMetadataRepository(db);
    const auditRepo = new AuditLogRepository(db);

    try {
      const fileId = createFileId(`file_${Date.now()}`);
      const fileMeta: FileMetadata = {
        id: fileId,
        name: 'document_2026.pdf',
        size: 1048576,
        mimeType: 'application/pdf',
        wholeFileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        chunks: [],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1. Create file record
      await repo.createFile(fileMeta, 'COMPLETED');

      // 2. Fetch file by ID
      const retrieved = await repo.getFileById(fileId);
      assert.ok(retrieved, 'File must exist');
      assert.strictEqual(retrieved.name, 'document_2026.pdf');
      assert.strictEqual(retrieved.size, 1048576);

      // 3. List active files
      const list = await repo.listFiles({ status: 'ACTIVE' });
      assert.ok(list.some((f) => f.id === fileId), 'Created file must be listed in active files');

      // 4. Record audit log
      auditRepo.logEvent('UPLOAD', { provider: 'telegram', size: 1048576 }, 'user');

      const auditEntries = auditRepo.listEvents({ limit: 10 });
      assert.ok(auditEntries.length >= 1);
      assert.strictEqual(auditEntries[0].eventType, 'UPLOAD');

      // 5. Delete file
      await repo.purgeFileMetadata(fileId);
      const afterDelete = await repo.getFileById(fileId);
      assert.strictEqual(afterDelete, null, 'Deleted file must not be returned');
    } finally {
      db.close();
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }
  });
});
