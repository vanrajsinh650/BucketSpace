import assert from 'node:assert';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteMetadataRepository } from '@bucketspace/db';
import { StorageApplicationService } from '../src/application/storage-application.service';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { TelegramStorageAdapter } from '../src/telegram/telegram-storage-provider';
import { MigrationEngine } from '../src/migration/migration-engine';
import { ProviderRegistry } from '../src/registry/provider-registry';
import { StorageRouter } from '../src/router/storage-router';
import { ShareEngine } from '../src/share/share-engine';

/* ─── V2 Master Test Suite ─── */

test('V2 — ProviderRegistry.list() and .remove()', () => {
  ProviderRegistry.clear();

  const mem = new InMemoryStorageProvider();
  ProviderRegistry.register(mem);

  const list = ProviderRegistry.list();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].providerId, 'in-memory');

  ProviderRegistry.remove('in-memory');
  assert.strictEqual(ProviderRegistry.list().length, 0);
});

test('V2 — ProviderRegistry.healthCheck() probe cycle', async () => {
  ProviderRegistry.clear();

  const mem = new InMemoryStorageProvider();
  ProviderRegistry.register(mem);

  const health = await ProviderRegistry.healthCheck('in-memory');
  assert.strictEqual(health.providerId, 'in-memory');
  assert.strictEqual(health.status, 'healthy');
  assert.ok(health.latencyMs >= 0);
  assert.strictEqual(health.error, undefined);
});

test('V2 — ProviderRegistry.healthCheck() unreachable for missing provider', async () => {
  ProviderRegistry.clear();
  const health = await ProviderRegistry.healthCheck('nonexistent');
  assert.strictEqual(health.status, 'unreachable');
  assert.ok(health.error);
});

test('V2 — StorageRouter wired into upload path', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-v2-router-'));
  const dbPath = path.join(tempDir, 'metadata.db');

  // Register two providers: in-memory and telegram
  const memProvider = new InMemoryStorageProvider();
  const tgProvider = new TelegramStorageAdapter({ mode: 'mtproto', apiId: 12345, apiHash: 'test-hash' });
  ProviderRegistry.register(memProvider);
  ProviderRegistry.register(tgProvider);

  // Router: images → in-memory, everything else → telegram
  const router = new StorageRouter('telegram');
  router.clearRules(); // Remove built-in default rules for this test
  router.addRule({
    id: 'test-images-memory',
    name: 'Images to InMemory',
    priority: 10,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'in-memory' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const repo = new SqliteMetadataRepository(dbPath);
  const appService = new StorageApplicationService({
    repository: repo,
    router,
    defaultProviderId: 'telegram',
  });

  // Upload an image — should route to in-memory
  const imageSrc = path.join(tempDir, 'photo.jpg');
  fs.writeFileSync(imageSrc, 'fake-jpeg-bytes');

  const imageFile = await appService.uploadFile({
    filePath: imageSrc,
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
  });

  assert.strictEqual(imageFile.chunks[0].providerRef!.providerId, 'in-memory');

  // Upload a document — should route to telegram
  const docSrc = path.join(tempDir, 'report.pdf');
  fs.writeFileSync(docSrc, 'fake-pdf-bytes');

  const docFile = await appService.uploadFile({
    filePath: docSrc,
    name: 'report.pdf',
    mimeType: 'application/pdf',
  });

  assert.strictEqual(docFile.chunks[0].providerRef!.providerId, 'telegram');

  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('V2 — MigrationEngine: InMemory → Telegram with SHA-256 verification', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-v2-migrate-'));
  const dbPath = path.join(tempDir, 'metadata.db');

  const memProvider = new InMemoryStorageProvider();
  const tgProvider = new TelegramStorageAdapter({ mode: 'mtproto', apiId: 12345, apiHash: 'test-hash' });
  ProviderRegistry.register(memProvider);
  ProviderRegistry.register(tgProvider);

  const repo = new SqliteMetadataRepository(dbPath);
  const appService = new StorageApplicationService({
    repository: repo,
    defaultProviderId: 'in-memory',
  });

  // Upload a file to InMemory
  const srcFile = path.join(tempDir, 'migrate-test.bin');
  const fileContent = Buffer.alloc(12 * 1024, 'M');
  fs.writeFileSync(srcFile, fileContent);

  const originalFile = await appService.uploadFile({
    filePath: srcFile,
    name: 'migrate-test.bin',
    mimeType: 'application/octet-stream',
    chunkSize: 5 * 1024,
  });

  // Verify all chunks are on in-memory
  for (const chunk of originalFile.chunks) {
    assert.strictEqual(chunk.providerRef!.providerId, 'in-memory');
  }

  // Migrate to telegram
  const result = await MigrationEngine.migrateFile(
    originalFile.id,
    'telegram',
    repo,
  );

  assert.strictEqual(result.targetProviderId, 'telegram');
  assert.strictEqual(result.verified, true);
  assert.ok(result.chunksTransferred > 0);

  // Verify metadata updated: all chunks now on telegram
  const migratedFile = await repo.getFileById(originalFile.id);
  assert.ok(migratedFile);
  for (const chunk of migratedFile!.chunks) {
    assert.strictEqual(chunk.providerRef!.providerId, 'telegram');
  }

  // Download from telegram and verify whole-file hash
  const downloadDest = path.join(tempDir, 'migrated-download.bin');
  const downloadResult = await appService.downloadFile({
    fileId: originalFile.id,
    destinationPath: downloadDest,
  });

  assert.strictEqual(downloadResult.verifiedHash, originalFile.wholeFileHash);

  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('V2 — Multi-provider download (chunks on different providers)', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-v2-multiprovider-'));
  const dbPath = path.join(tempDir, 'metadata.db');

  const memProvider = new InMemoryStorageProvider();
  const tgProvider = new TelegramStorageAdapter({ mode: 'mtproto', apiId: 12345, apiHash: 'test-hash' });
  ProviderRegistry.register(memProvider);
  ProviderRegistry.register(tgProvider);

  const repo = new SqliteMetadataRepository(dbPath);
  const appService = new StorageApplicationService({
    repository: repo,
    defaultProviderId: 'in-memory',
    defaultChunkSize: 5 * 1024,
  });

  // Upload a multi-chunk file to InMemory
  const srcFile = path.join(tempDir, 'split-test.bin');
  const fileContent = Buffer.alloc(15 * 1024, 'S');
  fs.writeFileSync(srcFile, fileContent);

  const uploaded = await appService.uploadFile({
    filePath: srcFile,
    name: 'split-test.bin',
    mimeType: 'application/octet-stream',
  });

  // Manually migrate only chunks 0 and 2 to telegram, leave chunk 1 on in-memory
  // This simulates a file spanning two providers
  const chunksToMoveIndices = [0, 2];
  for (const idx of chunksToMoveIndices) {
    const chunk = uploaded.chunks.find((c) => c.index === idx)!;
    const stream = await memProvider.getChunk(chunk.providerRef!);
    const buffers: Uint8Array[] = [];
    for await (const piece of stream) buffers.push(piece);

    const newRef = await tgProvider.putChunk({
      chunkId: chunk.id,
      size: chunk.size,
      hash: chunk.hash,
      data: (async function* () { for (const b of buffers) yield b; })(),
    });

    await repo.saveChunk({ ...chunk, providerRef: newRef });
  }

  // Now download — chunks 0,2 from telegram, chunk 1 from in-memory
  const downloadDest = path.join(tempDir, 'split-download.bin');
  const result = await appService.downloadFile({
    fileId: uploaded.id,
    destinationPath: downloadDest,
  });

  assert.strictEqual(result.verifiedHash, uploaded.wholeFileHash);

  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('V2 — ShareEngine byte-serving stream', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-v2-share-'));
  const dbPath = path.join(tempDir, 'metadata.db');

  const memProvider = new InMemoryStorageProvider();
  ProviderRegistry.register(memProvider);

  const repo = new SqliteMetadataRepository(dbPath);
  const appService = new StorageApplicationService({
    repository: repo,
    defaultProviderId: 'in-memory',
  });

  // Upload a file
  const srcFile = path.join(tempDir, 'shared-doc.txt');
  fs.writeFileSync(srcFile, 'Hello, this is a shared document content!');

  const uploaded = await appService.uploadFile({
    filePath: srcFile,
    name: 'shared-doc.txt',
    mimeType: 'text/plain',
  });

  // Create share engine and generate a link
  const shareEngine = new ShareEngine(repo);
  const shareLink = await shareEngine.createShareLink(uploaded.id, {
    expiresInSeconds: 3600,
  });

  assert.ok(shareLink.shareId);
  assert.strictEqual(shareLink.fileId, uploaded.id);

  // Stream the shared file bytes
  const streamResult = await shareEngine.streamSharedFile(shareLink.shareId);
  assert.strictEqual(streamResult.mimeType, 'text/plain');
  assert.strictEqual(streamResult.size, uploaded.size);

  // Collect streamed bytes and verify hash
  const hasher = createHash('sha256');
  for await (const piece of streamResult.stream) {
    hasher.update(piece);
  }
  const streamedHash = hasher.digest('hex');
  assert.strictEqual(streamedHash, uploaded.wholeFileHash);

  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
