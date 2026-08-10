import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteMetadataRepository } from '@bucketspace/db';
import { StorageApplicationService } from '../src/application/storage-application.service';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { ProviderRegistry } from '../src/registry/provider-registry';

test('Architecture Audit — StorageApplicationService Enforcement', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-audit-'));
  const dbPath = path.join(tempDir, 'metadata.db');
  const sourcePath = path.join(tempDir, 'test-source.bin');
  const downloadPath = path.join(tempDir, 'test-downloaded.bin');

  const repo = new SqliteMetadataRepository(dbPath);
  const provider = new InMemoryStorageProvider();
  ProviderRegistry.register(provider);

  const appService = new StorageApplicationService({
    repository: repo,
    defaultProviderId: 'in-memory',
    defaultChunkSize: 1024 * 1024,
  });

  // Write 2.5 MB test file
  const testBytes = new Uint8Array(2.5 * 1024 * 1024);
  for (let i = 0; i < testBytes.length; i++) {
    testBytes[i] = i % 256;
  }
  fs.writeFileSync(sourcePath, testBytes);

  // 1. Upload file via Application Service
  const metadata = await appService.uploadFile({
    filePath: sourcePath,
    name: 'architecture-test.bin',
    mimeType: 'application/octet-stream',
  });

  assert.strictEqual(metadata.name, 'architecture-test.bin');
  assert.strictEqual(metadata.size, 2.5 * 1024 * 1024);
  assert.strictEqual(metadata.chunks.length, 3); // 3 chunks (1MB + 1MB + 0.5MB)
  assert.strictEqual(metadata.status, 'ACTIVE');

  // 2. Download file via Application Service
  const downloadResult = await appService.downloadFile({
    fileId: metadata.id,
    destinationPath: downloadPath,
  });

  assert.strictEqual(downloadResult.verifiedHash, metadata.wholeFileHash);
  const downloadedBytes = fs.readFileSync(downloadPath);
  assert.strictEqual(downloadedBytes.length, testBytes.length);
  assert.deepStrictEqual(new Uint8Array(downloadedBytes), testBytes);

  // 3. Inspect chunk health via Application Service
  const inspection = await appService.inspectFile(metadata.id);
  assert.deepStrictEqual(inspection.verifiedChunkIndexes, [0, 1, 2]);
  assert.deepStrictEqual(inspection.missingChunkIndexes, []);

  // 4. Soft-delete file via Application Service
  const deleted = await appService.deleteFile(metadata.id);
  assert.strictEqual(deleted, true);

  const listAfterDelete = await appService.listFiles({ includeTrashed: false });
  assert.strictEqual(listAfterDelete.length, 0);

  const listWithTrashed = await appService.listFiles({ includeTrashed: true });
  assert.strictEqual(listWithTrashed.length, 1);
  assert.strictEqual(listWithTrashed[0].status, 'TRASHED');

  // 5. Restore file via Application Service
  const restored = await appService.restoreFile(metadata.id);
  assert.strictEqual(restored, true);
  const listAfterRestore = await appService.listFiles({ includeTrashed: false });
  assert.strictEqual(listAfterRestore.length, 1);
  assert.strictEqual(listAfterRestore[0].status, 'ACTIVE');

  // 6. Purge file via Application Service
  const purged = await appService.purgeFile(metadata.id);
  assert.strictEqual(purged, true);
  const listAfterPurge = await appService.listFiles({ includeTrashed: true });
  assert.strictEqual(listAfterPurge.length, 0);

  // Cleanup
  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
