import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createSqliteDatabase,
  SqliteMetadataRepository,
  SqliteSyncLedgerRepository,
} from '@bucketspace/db';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { ProviderRegistry } from '../src/registry/provider-registry';
import { StorageApplicationService } from '../src/application/storage-application.service';
import {
  FolderWatcher,
  ReconciliationEngine,
  SyncDaemon,
} from '../src/sync';

describe('BucketSpace Sync Engine & Reconciliation Suite', () => {
  it('ReconciliationEngine: accurately classifies Case A, Case B, Case C, and NOOP', () => {
    // 1. New local file (Case A)
    const decisionA = ReconciliationEngine.reconcile(
      {
        localPath: 'Notes.txt',
        absolutePath: '/sync/Notes.txt',
        fileSize: 100,
        mtimeMs: 1000,
        sha256Hash: 'hash-local-A',
        exists: true,
      },
      null,
      null
    );
    assert.equal(decisionA.action, 'UPLOAD');

    // 2. New remote file (Case B)
    const decisionB = ReconciliationEngine.reconcile(
      null,
      null,
      {
        fileId: 'remote-id-1',
        name: 'Report.pdf',
        fileSize: 200,
        wholeFileHash: 'hash-remote-B',
        updatedAt: new Date(),
      }
    );
    assert.equal(decisionB.action, 'DOWNLOAD');
    assert.equal(decisionB.remoteFileId, 'remote-id-1');

    // 3. Concurrent Conflict (Case C)
    const decisionC = ReconciliationEngine.reconcile(
      {
        localPath: 'Doc.docx',
        absolutePath: '/sync/Doc.docx',
        fileSize: 300,
        mtimeMs: 2000,
        sha256Hash: 'hash-local-modified',
        exists: true,
      },
      {
        localPath: 'Doc.docx',
        absolutePath: '/sync/Doc.docx',
        fileSize: 300,
        mtimeMs: 1000,
        sha256Hash: 'hash-original-base',
        remoteFileId: 'remote-id-doc',
        syncStatus: 'SYNCED',
        direction: 'IDLE',
        retryCount: 0,
        version: 1,
        isDeleted: false,
      },
      {
        fileId: 'remote-id-doc',
        name: 'Doc.docx',
        fileSize: 350,
        wholeFileHash: 'hash-remote-modified',
        updatedAt: new Date(),
      }
    );
    assert.equal(decisionC.action, 'CONFLICT');
    assert.ok(decisionC.conflictDetails?.forkPath.includes('(Conflict '));

    // 4. Already Synced (NOOP)
    const decisionNoop = ReconciliationEngine.reconcile(
      {
        localPath: 'Photo.png',
        absolutePath: '/sync/Photo.png',
        fileSize: 500,
        mtimeMs: 1500,
        sha256Hash: 'hash-identical',
        exists: true,
      },
      {
        localPath: 'Photo.png',
        absolutePath: '/sync/Photo.png',
        fileSize: 500,
        mtimeMs: 1500,
        sha256Hash: 'hash-identical',
        remoteFileId: 'remote-id-photo',
        syncStatus: 'SYNCED',
        direction: 'IDLE',
        retryCount: 0,
        version: 1,
        isDeleted: false,
      },
      {
        fileId: 'remote-id-photo',
        name: 'Photo.png',
        fileSize: 500,
        wholeFileHash: 'hash-identical',
        updatedAt: new Date(),
      }
    );
    assert.equal(decisionNoop.action, 'NOOP');
  });

  it('FolderWatcher: enforces echo suppression and path normalization', () => {
    const watcher = new FolderWatcher({
      rootDir: './tmp-watch-test',
    });

    watcher.suppressEcho('Docs/Spreadsheet.xlsx', 'hash-123', 5000);
    assert.equal(watcher.isSuppressed('Docs/Spreadsheet.xlsx'), true);
    assert.equal(watcher.isSuppressed('Docs/Other.xlsx'), false);
  });

  it('SyncDaemon: Full E2E Local Folder Auto-Sync & Reconcile Lifecycle', async () => {
    // 1. Setup isolated in-memory DB and test directory
    const db = createSqliteDatabase(':memory:');
    const metadataRepo = new SqliteMetadataRepository(db);
    const syncLedgerRepo = new SqliteSyncLedgerRepository(db);

    const inMemoryProvider = new InMemoryStorageProvider('in-memory');
    ProviderRegistry.register(inMemoryProvider);

    const appService = new StorageApplicationService({
      repository: metadataRepo,
      defaultProviderId: 'in-memory',
      defaultChunkSize: 512 * 1024,
    });

    const tempSyncDir = path.resolve(__dirname, '../../.scratch', `sync-test-${Date.now()}`);
    await fs.mkdir(tempSyncDir, { recursive: true });

    try {
      // 2. Create initial local test file
      const testFileContent = 'BucketSpace Auto-Sync Bit-Fidelity Test Content ' + Date.now();
      const testFilePath = path.join(tempSyncDir, 'hello.txt');
      await fs.writeFile(testFilePath, testFileContent, 'utf8');

      // 3. Initialize & start Sync Daemon
      const syncDaemon = new SyncDaemon(
        {
          syncRootDir: tempSyncDir,
          debounceMs: 500,
          concurrency: 2,
        },
        syncLedgerRepo,
        appService
      );

      const events: string[] = [];
      syncDaemon.onEvent((evt) => {
        events.push(evt.type);
      });

      await syncDaemon.start();

      // 4. Verify the local file was discovered, uploaded, and marked SYNCED
      const ledgerEntry = await syncLedgerRepo.getEntry('hello.txt');
      assert.ok(ledgerEntry, 'Ledger entry should exist for hello.txt');
      assert.equal(ledgerEntry?.syncStatus, 'SYNCED');
      assert.ok(ledgerEntry?.remoteFileId, 'Remote file ID should be assigned');

      // 5. Verify file exists in metadata repository
      const remoteFile = await metadataRepo.getFileById(ledgerEntry.remoteFileId as any);
      assert.ok(remoteFile, 'Remote metadata file must exist');
      assert.equal(remoteFile?.name, 'hello.txt');

      // 6. Test Remote -> Local Sync (Create a new file directly on storage)
      const remoteOnlyContent = 'Remote Generated Document For Downward Sync';
      const tempRemoteSrc = path.join(os.tmpdir(), `remote-src-${Date.now()}.txt`);
      await fs.writeFile(tempRemoteSrc, remoteOnlyContent, 'utf8');

      const uploadedRemote = await appService.uploadFile({
        filePath: tempRemoteSrc,
        name: 'remote-doc.txt',
        mimeType: 'text/plain',
      });
      await fs.unlink(tempRemoteSrc);

      // 7. Trigger reconciliation scan
      await syncDaemon.scanAndReconcile();

      // 8. Assert that remote-doc.txt was automatically downloaded to local disk
      const localDownloadedPath = path.join(tempSyncDir, 'remote-doc.txt');
      const downloadedContent = await fs.readFile(localDownloadedPath, 'utf8');
      assert.equal(downloadedContent, remoteOnlyContent, 'Downloaded file content must match remote');

      const downloadedLedger = await syncLedgerRepo.getEntry('remote-doc.txt');
      assert.equal(downloadedLedger?.syncStatus, 'SYNCED');

      // 9. Verify Stats
      const stats = await syncDaemon.getStats();
      assert.equal(stats.status, 'RUNNING');
      assert.equal(stats.totalFiles, 2);
      assert.equal(stats.syncedFiles, 2);
      assert.equal(stats.conflicts, 0);

      await syncDaemon.stop();
    } finally {
      await fs.rm(tempSyncDir, { recursive: true, force: true }).catch(() => {});
      await metadataRepo.close();
    }
  });
});
