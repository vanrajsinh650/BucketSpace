import assert from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SqliteMetadataRepository } from '@bucketspace/db';
import { InvalidProviderRefError } from '@bucketspace/shared';
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

/**
 * Creates an in-memory mock Telegram HTTP server for testing TelegramStorageAdapter.
 */
function createMockTelegramServer(): { server: Server; getUrl: () => string; store: Map<string, StoredTelegramDoc> } {
  const store = new Map<string, StoredTelegramDoc>();
  let messageIdCounter = 1000;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Mock sendDocument
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

    // Mock getFile
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

    // Mock file download GET /file/bot<token>/documents/:fileId.bin
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

    // Mock deleteMessage
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
        } catch {
          // ignore parse error
        }

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
  return join(tmpdir(), `bucketspace_tg_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
}

test('TelegramStorageAdapter — Full E2E File Cycle (Upload -> DB Restart -> Stream Download -> Hash Verification)', async () => {
  const mockServer = createMockTelegramServer();
  await new Promise<void>((resolve) => mockServer.server.listen(0, '127.0.0.1', resolve));

  const sourcePath = createTempFilePath('src');
  const destPath = createTempFilePath('dest');
  const dbPath = createTempFilePath('db');
  let repo: SqliteMetadataRepository | null = null;

  try {
    const apiBaseUrl = mockServer.getUrl();
    const adapter = new TelegramStorageAdapter({
      botToken: 'mock_bot_token_12345',
      defaultChatId: '-100123456789',
      apiBaseUrl,
    });

    // 1. Create a 12MB test file (3 chunks of 4MB)
    const fileSize = 12 * 1024 * 1024;
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);
    const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');

    repo = new SqliteMetadataRepository(dbPath);

    // 2. Upload file via TransferOrchestrator to Telegram
    const uploadedFile = await TransferOrchestrator.uploadFile({
      filePath: sourcePath,
      name: 'vacation_video.mp4',
      mimeType: 'video/mp4',
      chunkSize: 4 * 1024 * 1024,
      provider: adapter,
      repository: repo,
    });

    assert.strictEqual(uploadedFile.name, 'vacation_video.mp4');
    assert.strictEqual(uploadedFile.chunks.length, 3);
    assert.strictEqual(uploadedFile.wholeFileHash, expectedSha256);
    assert.strictEqual(mockServer.store.size, 3, 'Mock Telegram store must contain 3 uploaded chunk documents');

    // 3. App Restart: Close SQLite DB connection & reopen in new instance
    await repo.close();
    repo = new SqliteMetadataRepository(dbPath);

    // 4. Download file via TransferOrchestrator from Telegram
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: uploadedFile.id,
      destinationPath: destPath,
      provider: adapter,
      repository: repo,
    });

    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);
    const downloadedBytes = readFileSync(destPath);
    assert.strictEqual(downloadedBytes.length, fileSize);
    assert.deepStrictEqual(downloadedBytes, fileBytes);
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

test('TelegramStorageAdapter — Desync Recovery (Re-upload Lost Telegram Message)', async () => {
  const mockServer = createMockTelegramServer();
  await new Promise<void>((resolve) => mockServer.server.listen(0, '127.0.0.1', resolve));

  const sourcePath = createTempFilePath('desync_src');
  const destPath = createTempFilePath('desync_dest');
  const dbPath = createTempFilePath('desync_db');
  let repo: SqliteMetadataRepository | null = null;

  try {
    const apiBaseUrl = mockServer.getUrl();
    const adapter = new TelegramStorageAdapter({
      botToken: 'mock_bot_token_12345',
      defaultChatId: '-100123456789',
      apiBaseUrl,
    });

    const fileSize = 8 * 1024 * 1024; // 8MB = 2 chunks of 4MB
    const fileBytes = randomBytes(fileSize);
    writeFileSync(sourcePath, fileBytes);
    const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');

    repo = new SqliteMetadataRepository(dbPath);

    // 1. Upload file completely
    const uploadedFile = await TransferOrchestrator.uploadFile({
      filePath: sourcePath,
      name: 'document.pdf',
      mimeType: 'application/pdf',
      chunkSize: 4 * 1024 * 1024,
      provider: adapter,
      repository: repo,
    });

    assert.strictEqual(uploadedFile.chunks.length, 2);

    // 2. Delete chunk index 1 from Telegram server
    const chunk1RefData = uploadedFile.chunks[1].providerRef?.reference as { fileId: string };
    mockServer.store.delete(chunk1RefData.fileId);

    // 3. Inspect chunks: index 1 should be missing from Telegram
    const inspection = await RecoveryEngine.inspectFileChunks(uploadedFile.id, repo, adapter);
    assert.deepStrictEqual(inspection.verifiedChunkIndexes, [0]);
    assert.deepStrictEqual(inspection.missingChunkIndexes, [1]);

    // 4. Resume upload: RecoveryEngine detects missing chunk 1 and re-uploads it to Telegram
    const resumedFile = await RecoveryEngine.resumeUpload({
      fileId: uploadedFile.id,
      filePath: sourcePath,
      provider: adapter,
      repository: repo,
      chunkSize: 4 * 1024 * 1024,
    });

    assert.strictEqual(resumedFile.chunks.length, 2);

    // 5. Download and verify reassembled bytes
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: uploadedFile.id,
      destinationPath: destPath,
      provider: adapter,
      repository: repo,
    });

    const downloadedBytes = readFileSync(destPath);
    assert.deepStrictEqual(downloadedBytes, fileBytes);
    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);
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

test('TelegramStorageAdapter — Opaque Reference Guard & Error Validation', async () => {
  const adapter = new TelegramStorageAdapter({
    botToken: 'mock_bot_token_12345',
    defaultChatId: '-100123456789',
  });

  const invalidProviderRef = {
    providerId: 's3',
    reference: { chatId: '-100123456789', messageId: 1, fileId: 'f1' },
  };

  await assert.rejects(
    async () => {
      await adapter.getChunk(invalidProviderRef);
    },
    (err: unknown) => err instanceof InvalidProviderRefError
  );

  const malformedRef = {
    providerId: 'telegram',
    reference: { messageId: 1 }, // Missing chatId & fileId
  };

  await assert.rejects(
    async () => {
      await adapter.getChunk(malformedRef);
    },
    (err: unknown) => err instanceof InvalidProviderRefError
  );
});
