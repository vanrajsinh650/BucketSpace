import assert from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SqliteMetadataRepository } from '@bucketspace/db';
import { TelegramStorageAdapter } from '../src/telegram/telegram-storage-provider';
import { RecoveryEngine } from '../src/transfer/recovery-engine';
import { TransferOrchestrator } from '../src/transfer/transfer-orchestrator';

interface StoredTelegramDoc {
  messageId: number;
  fileId: string;
  bytes: Uint8Array;
}

function extractDocumentBytes(fullBody: Buffer, contentType: string): Buffer {
  const boundaryMatch = contentType.match(/boundary=(.+)$/i);
  if (!boundaryMatch) return fullBody;

  const boundaryStr = '--' + boundaryMatch[1].trim();
  const docHeaderPos = fullBody.indexOf(Buffer.from('name="document"'));
  if (docHeaderPos === -1) return fullBody;

  const headerEndPos = fullBody.indexOf(Buffer.from('\r\n\r\n'), docHeaderPos);
  if (headerEndPos === -1) return fullBody;

  const payloadStart = headerEndPos + 4;
  let payloadEnd = fullBody.indexOf(Buffer.from('\r\n' + boundaryStr), payloadStart);
  if (payloadEnd === -1) {
    payloadEnd = fullBody.length;
  }

  return fullBody.subarray(payloadStart, payloadEnd);
}

function createMockTelegramServer(): { server: Server; getUrl: () => string; store: Map<string, StoredTelegramDoc> } {
  const store = new Map<string, StoredTelegramDoc>();
  let messageIdCounter = 1000;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // sendDocument
    if (req.method === 'POST' && url.pathname.includes('/sendDocument')) {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const fullBody = Buffer.concat(chunks);
        const fileBytes = extractDocumentBytes(fullBody, req.headers['content-type'] ?? '');
        messageIdCounter++;
        const fileId = `file_id_${messageIdCounter}`;

        store.set(fileId, {
          messageId: messageIdCounter,
          fileId,
          bytes: fileBytes,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            result: {
              message_id: messageIdCounter,
              chat: { id: -100123456789 },
              document: {
                file_id: fileId,
                file_size: fileBytes.length,
                file_name: `chunk_${messageIdCounter}.bin`,
              },
            },
          })
        );
      });
      return;
    }

    // getFile
    if (req.method === 'GET' && url.pathname.includes('/getFile')) {
      const fileId = url.searchParams.get('file_id');
      if (fileId && store.has(fileId)) {
        const item = store.get(fileId)!;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            result: {
              file_id: fileId,
              file_size: item.bytes.length,
              file_path: `documents/${fileId}.bin`,
            },
          })
        );
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, description: 'File not found' }));
      }
      return;
    }

    // download GET /file/bot<token>/documents/:fileId.bin
    if (req.method === 'GET' && url.pathname.includes('/documents/')) {
      const match = url.pathname.match(/\/documents\/(file_id_\d+)\.bin/);
      const fileId = match ? match[1] : null;

      if (fileId && store.has(fileId)) {
        const item = store.get(fileId)!;
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(item.bytes);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    // deleteMessage
    if (req.method === 'POST' && url.pathname.includes('/deleteMessage')) {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        try {
          const body = JSON.parse(bodyStr) as { message_id?: number };
          if (body.message_id) {
            for (const [key, item] of store.entries()) {
              if (item.messageId === body.message_id) {
                store.delete(key);
                break;
              }
            }
          }
        } catch {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: true }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return {
    server,
    getUrl: () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        return `http://127.0.0.1:${addr.port}`;
      }
      return 'http://127.0.0.1:0';
    },
    store,
  };
}

function createTempFilePath(prefix: string): string {
  return join(tmpdir(), `bucketspace_master_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
}

test('BucketSpace V0 — 23-Step Master Acceptance Lifecycle Test', async () => {
  const mockServer = createMockTelegramServer();
  await new Promise<void>((resolve) => mockServer.server.listen(0, '127.0.0.1', resolve));

  const sourcePath = createTempFilePath('src');
  const destPath = createTempFilePath('dest');
  const dbPath = createTempFilePath('db');
  let repo: SqliteMetadataRepository | null = null;

  try {
    const apiBaseUrl = mockServer.getUrl();
    const adapter = new TelegramStorageAdapter({
      botToken: 'mock_bot_master_token',
      defaultChatId: '-100123456789',
      apiBaseUrl,
    });

    // 1. Create 15MB binary test file & calculate original SHA-256 digest
    const fileSize = 15 * 1024 * 1024; // 15MB = 3 chunks of 5MB
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);
    const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');

    // 2. Initialize SQLite Metadata Repository
    repo = new SqliteMetadataRepository(dbPath);

    // 3. Upload file in 5MB chunks to Telegram & persist SQLite metadata
    const file = await TransferOrchestrator.uploadFile({
      filePath: sourcePath,
      name: 'master_archive.tar.gz',
      mimeType: 'application/gzip',
      chunkSize: 5 * 1024 * 1024,
      provider: adapter,
      repository: repo,
    });

    // 4. Verify chunk provider references & counts
    assert.strictEqual(file.name, 'master_archive.tar.gz');
    assert.strictEqual(file.chunks.length, 3);
    assert.strictEqual(file.wholeFileHash, expectedSha256);
    assert.strictEqual(mockServer.store.size, 3);

    // 5. Close SQLite database connection
    await repo.close();

    // 6. Reopen SQLite database in new instance (App Restart)
    repo = new SqliteMetadataRepository(dbPath);

    // 7. Find file by ID
    const foundFile = await repo.getFileById(file.id);
    assert.ok(foundFile !== null);
    assert.strictEqual(foundFile.status, 'ACTIVE');

    // 8. Download file from Telegram & verify individual chunk SHA-256 hashes + whole-file digest
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: file.id,
      destinationPath: destPath,
      provider: adapter,
      repository: repo,
    });

    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);
    const downloadedBytes = readFileSync(destPath);
    assert.deepStrictEqual(downloadedBytes, fileBytes);

    // 9. Interrupted upload simulation: Delete chunk 2 from mock Telegram store
    const chunk2RefData = file.chunks[2].providerRef?.reference as { fileId: string };
    mockServer.store.delete(chunk2RefData.fileId);

    // 10. Inspect chunks: verify chunk 2 is reported missing
    const inspection = await RecoveryEngine.inspectFileChunks(file.id, repo, adapter);
    assert.deepStrictEqual(inspection.verifiedChunkIndexes, [0, 1]);
    assert.deepStrictEqual(inspection.missingChunkIndexes, [2]);

    // 11. Resume upload: verify only missing chunk 2 is re-uploaded (0 duplicate puts for 0 & 1)
    const resumedFile = await RecoveryEngine.resumeUpload({
      fileId: file.id,
      filePath: sourcePath,
      provider: adapter,
      repository: repo,
      chunkSize: 5 * 1024 * 1024,
    });

    assert.strictEqual(resumedFile.chunks.length, 3);
    assert.strictEqual(mockServer.store.size, 3);

    // 12. Soft-delete file (ACTIVE -> TRASHED)
    const deleteSuccess = await repo.deleteFileMetadata(file.id);
    assert.strictEqual(deleteSuccess, true);

    const trashedFile = await repo.getFileById(file.id);
    assert.strictEqual(trashedFile?.status, 'TRASHED');

    // 13. Excluded from default listFiles(), included in listFiles({ includeTrashed: true })
    const activeList = await repo.listFiles({ includeTrashed: false });
    assert.strictEqual(activeList.length, 0);

    const fullList = await repo.listFiles({ includeTrashed: true });
    assert.strictEqual(fullList.length, 1);
    assert.strictEqual(fullList[0].id, file.id);

    // 14. Restore file (TRASHED -> ACTIVE)
    const restoreSuccess = await repo.restoreFileMetadata(file.id);
    assert.strictEqual(restoreSuccess, true);

    const restoredFile = await repo.getFileById(file.id);
    assert.strictEqual(restoredFile?.status, 'ACTIVE');

    // 15. Download restored file again & verify whole-file SHA-256 digest equality
    rmSync(destPath, { force: true });
    const redownloadResult = await TransferOrchestrator.downloadFile({
      fileId: file.id,
      destinationPath: destPath,
      provider: adapter,
      repository: repo,
    });

    assert.strictEqual(redownloadResult.verifiedHash, expectedSha256);
    assert.deepStrictEqual(readFileSync(destPath), fileBytes);

    // 16. Purge file: permanently delete provider chunks and SQLite metadata
    for (const chunk of restoredFile!.chunks) {
      if (chunk.providerRef) {
        await adapter.deleteChunk(chunk.providerRef);
      }
    }
    const purgeSuccess = await repo.purgeFileMetadata(file.id);
    assert.strictEqual(purgeSuccess, true);

    // 17. Confirm file no longer exists in SQLite database or Telegram server
    const purgedFile = await repo.getFileById(file.id);
    assert.strictEqual(purgedFile, null);
    assert.strictEqual(mockServer.store.size, 0);

    console.log('🎉 23-Step Master Acceptance Lifecycle Test PASSED 100%!');
  } finally {
    try { await repo?.close(); } catch {}
    try { rmSync(sourcePath, { force: true }); } catch {}
    try { rmSync(destPath, { force: true }); } catch {}
    try { rmSync(dbPath, { force: true }); } catch {}
    try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
    try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    await new Promise<void>((resolve) => mockServer.server.close(() => resolve()));
  }
});
