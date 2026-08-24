import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteDatabase } from '../src/sqlite/database';
import { SqliteSyncLedgerRepository } from '../src/sqlite/sync-ledger-repository';

describe('SqliteSyncLedgerRepository — Folder Auto-Sync State Machine', () => {
  it('performs complete upsert, query, pending status, and stats lifecycle', async () => {
    const db = createSqliteDatabase(':memory:');
    const repo = new SqliteSyncLedgerRepository(db);

    // 1. Initial empty state
    const initialStats = await repo.getStats();
    assert.equal(initialStats.totalFiles, 0);
    assert.equal(initialStats.pendingUploads, 0);

    // 2. Insert new pending upload entry
    const entry1 = await repo.upsertEntry({
      localPath: 'Docs/Report.pdf',
      absolutePath: '/home/user/BucketSpace-Sync/Docs/Report.pdf',
      fileSize: 1024 * 1024,
      mtimeMs: 1700000000000,
      sha256Hash: 'hash-report-123456',
      syncStatus: 'PENDING_UPLOAD',
      direction: 'UPLOAD',
      retryCount: 0,
      isDeleted: false,
    });

    assert.equal(entry1.localPath, 'Docs/Report.pdf');
    assert.equal(entry1.syncStatus, 'PENDING_UPLOAD');
    assert.equal(entry1.version, 1);

    // 3. Insert second entry (already synced)
    await repo.upsertEntry({
      localPath: 'Photos/Beach.jpg',
      absolutePath: '/home/user/BucketSpace-Sync/Photos/Beach.jpg',
      fileSize: 2 * 1024 * 1024,
      mtimeMs: 1700000001000,
      sha256Hash: 'hash-beach-789012',
      remoteFileId: 'remote-file-beach-001',
      syncStatus: 'SYNCED',
      direction: 'IDLE',
      retryCount: 0,
      isDeleted: false,
      lastSyncedAt: new Date(),
    });

    // 4. Insert third entry (conflict state)
    await repo.upsertEntry({
      localPath: 'Code/main.ts',
      absolutePath: '/home/user/BucketSpace-Sync/Code/main.ts',
      fileSize: 5000,
      mtimeMs: 1700000002000,
      sha256Hash: 'hash-code-conflicted',
      syncStatus: 'CONFLICT',
      direction: 'UPLOAD',
      errorMessage: 'Concurrent edit detected on remote',
      retryCount: 0,
      isDeleted: false,
    });

    // 5. Query pending list
    const pending = await repo.listPending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].localPath, 'Docs/Report.pdf');

    // 6. Query conflict list
    const conflicts = await repo.listConflicts();
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].localPath, 'Code/main.ts');

    // 7. Query by remote file id
    const foundByRemote = await repo.getEntryByRemoteId('remote-file-beach-001');
    assert.ok(foundByRemote);
    assert.equal(foundByRemote?.localPath, 'Photos/Beach.jpg');

    // 8. Update status to SYNCED
    await repo.markStatus('Docs/Report.pdf', 'SYNCED');
    const updatedReport = await repo.getEntry('Docs/Report.pdf');
    assert.equal(updatedReport?.syncStatus, 'SYNCED');
    assert.ok(updatedReport?.lastSyncedAt);

    // 9. Stats verification
    const stats = await repo.getStats();
    assert.equal(stats.totalFiles, 3);
    assert.equal(stats.syncedFiles, 2);
    assert.equal(stats.pendingUploads, 0);
    assert.equal(stats.conflicts, 1);
    assert.equal(stats.totalBytes, 1024 * 1024 + 2 * 1024 * 1024 + 5000);

    // 10. Mark deleted
    await repo.markDeleted('Photos/Beach.jpg');
    const statsAfterDelete = await repo.getStats();
    assert.equal(statsAfterDelete.totalFiles, 2);
  });
});
