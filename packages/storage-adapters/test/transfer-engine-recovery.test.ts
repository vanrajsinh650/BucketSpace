import assert from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';


import { SqliteMetadataRepository } from '@bucketspace/db';
import {
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
} from '@bucketspace/shared';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { RecoveryEngine } from '../src/transfer/recovery-engine';
import { TransferOrchestrator } from '../src/transfer/transfer-orchestrator';

function createTempFilePath(prefix: string): string {
  return join(tmpdir(), `bucketspace_transfer_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
}

test('TransferEngine — End-to-End File Upload, DB Restart & Reassembly Digest Verification', async () => {
  const sourcePath = createTempFilePath('src');
  const destPath = createTempFilePath('dest');
  const dbPath = createTempFilePath('db');

  try {
    // 1. Create a 15MB test file on disk
    const fileSize = 15 * 1024 * 1024; // 15MB
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);

    const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');

    // 2. Upload file using TransferOrchestrator (2MB chunk size = 8 chunks)
    const provider = new InMemoryStorageProvider();
    let repo: SqliteMetadataRepository | null = new SqliteMetadataRepository(dbPath);

    const uploadedMetadata = await TransferOrchestrator.uploadFile({
      filePath: sourcePath,
      name: 'large_dataset.bin',
      mimeType: 'application/octet-stream',
      chunkSize: 2 * 1024 * 1024,
      provider,
      repository: repo,
    });

    assert.strictEqual(uploadedMetadata.name, 'large_dataset.bin');
    assert.strictEqual(uploadedMetadata.size, fileSize);
    assert.strictEqual(uploadedMetadata.wholeFileHash, expectedSha256);
    assert.strictEqual(uploadedMetadata.chunks.length, 8);

    // 3. Simulate App Restart: Close SQLite DB connection and reopen in new instance
    await repo.close();
    repo = new SqliteMetadataRepository(dbPath);

    // 4. Download file using TransferOrchestrator and verify reassembled bytes
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: uploadedMetadata.id,
      destinationPath: destPath,
      provider,
      repository: repo,
    });

    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);

    const downloadedBytes = readFileSync(destPath);
    assert.strictEqual(downloadedBytes.length, fileSize);
    assert.deepStrictEqual(downloadedBytes, fileBytes);

    await repo.close();
    repo = null;
  } finally {
    rmSync(sourcePath, { force: true });
    rmSync(destPath, { force: true });
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  }
});

test('TransferEngine — Midway Crash & Resume Recovery (Skip Verified Chunks)', async () => {
  const sourcePath = createTempFilePath('resume_src');
  const destPath = createTempFilePath('resume_dest');
  const dbPath = createTempFilePath('resume_db');

  try {
    // 1. Create a 10MB test file (5 chunks of 2MB)
    const fileSize = 10 * 1024 * 1024;
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);

    const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');
    const fileId = createFileId('file-resume-001');

    const provider = new InMemoryStorageProvider();
    const repo = new SqliteMetadataRepository(dbPath);

    // 2. Perform partial upload: manually store chunks 0 and 1 into provider & SQLite
    const chunkSize = 2 * 1024 * 1024;
    await repo.createFile(
      {
        id: fileId,
        name: 'interrupted_video.mp4',
        size: fileSize,
        mimeType: 'video/mp4',
        wholeFileHash: expectedSha256,
        createdAt: new Date(),
        updatedAt: new Date(),
        chunks: [],
      },
      'UPLOADING'
    );

    // Upload chunks 0 and 1
    for (let i = 0; i < 2; i++) {
      const chunkBytes = fileBytes.subarray(i * chunkSize, (i + 1) * chunkSize);
      const chunkHash = createHash('sha256').update(chunkBytes).digest('hex');
      const chunkId = createChunkId(`chunk-partial-${i}`);

      const providerRef = await provider.putChunk({
        chunkId,
        size: chunkBytes.length,
        hash: chunkHash,
        data: (async function* () {
          yield chunkBytes;
        })(),
      });

      await repo.saveChunk({
        id: chunkId,
        fileId,
        index: i,
        size: chunkBytes.length,
        hash: chunkHash,
        providerRef,
      });
    }

    // 3. Inspect status before resume
    const inspectionBefore = await RecoveryEngine.inspectFileChunks(fileId, repo, provider);
    assert.deepStrictEqual(inspectionBefore.verifiedChunkIndexes, [0, 1]);

    // Track calls to putChunk during resume
    let putCallsCount = 0;
    const originalPutChunk = provider.putChunk.bind(provider);
    provider.putChunk = async (input) => {
      putCallsCount++;
      return originalPutChunk(input);
    };

    // 4. Resume upload
    const resumedMetadata = await RecoveryEngine.resumeUpload({
      fileId,
      filePath: sourcePath,
      provider,
      repository: repo,
      chunkSize,
    });

    assert.strictEqual(resumedMetadata.chunks.length, 5);
    // Should only have called putChunk 3 times for missing chunks 2, 3, 4!
    assert.strictEqual(putCallsCount, 3);

    // 5. Download and verify reassembled bytes
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId,
      destinationPath: destPath,
      provider,
      repository: repo,
    });

    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);
    const downloadedBytes = readFileSync(destPath);
    assert.deepStrictEqual(downloadedBytes, fileBytes);

    await repo.close();
  } finally {
    rmSync(sourcePath, { force: true });
    rmSync(destPath, { force: true });
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  }
});

test('TransferEngine — Desynced Chunk Recovery (Re-upload Lost Provider Chunk)', async () => {
  const sourcePath = createTempFilePath('desync_src');
  const destPath = createTempFilePath('desync_dest');
  const dbPath = createTempFilePath('desync_db');
  let repo: SqliteMetadataRepository | null = null;

  try {
    const fileSize = 6 * 1024 * 1024; // 6MB = 3 chunks of 2MB
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);

    const provider = new InMemoryStorageProvider();
    repo = new SqliteMetadataRepository(dbPath);


    // 1. Upload file completely
    const uploadedFile = await TransferOrchestrator.uploadFile({
      filePath: sourcePath,
      name: 'archive.zip',
      mimeType: 'application/zip',
      chunkSize: 2 * 1024 * 1024,
      provider,
      repository: repo,
    });

    assert.strictEqual(uploadedFile.chunks.length, 3);

    // 2. Simulate provider data loss: delete chunk index 1 from provider
    const chunk1Ref = uploadedFile.chunks[1].providerRef!;
    await provider.deleteChunk(chunk1Ref);

    // 3. Inspect chunks: index 1 should be missing from provider
    const inspection = await RecoveryEngine.inspectFileChunks(uploadedFile.id, repo, provider);
    assert.deepStrictEqual(inspection.verifiedChunkIndexes, [0, 2]);
    assert.deepStrictEqual(inspection.missingChunkIndexes, [1]);

    // 4. Resume upload: should detect missing chunk 1 and re-upload it
    const resumedFile = await RecoveryEngine.resumeUpload({
      fileId: uploadedFile.id,
      filePath: sourcePath,
      provider,
      repository: repo,
      chunkSize: 2 * 1024 * 1024,
    });

    assert.strictEqual(resumedFile.chunks.length, 3);

    // 5. Download and verify full byte equality
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: uploadedFile.id,
      destinationPath: destPath,
      provider,
      repository: repo,
    });

    const downloadedBytes = readFileSync(destPath);
    assert.deepStrictEqual(downloadedBytes, fileBytes);
    assert.strictEqual(downloadResult.verifiedHash, uploadedFile.wholeFileHash);
  } finally {
    try { await repo?.close(); } catch {}
    try { rmSync(sourcePath, { force: true }); } catch {}
    try { rmSync(destPath, { force: true }); } catch {}
    try { rmSync(dbPath, { force: true }); } catch {}
    try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
    try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
  }
});

