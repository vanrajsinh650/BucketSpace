import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createChunkId,
  createFileId,
  FileMetadata,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
  StorageProviderCapabilities,
} from '@bucketspace/shared';
import {
  InMemoryStorageProvider,
  LocalStorageAdapter,
  ProviderRegistry,
  S3StorageAdapter,
  SupabaseStorageAdapter,
  TelegramStorageAdapter,
  TransferOrchestrator,
} from '../src';
import { SqliteMetadataRepository } from '@bucketspace/db';

describe('Storage Provider Capabilities & MTProto Architecture', () => {
  it('Phase 3 & 4 — All providers declare explicit capabilities with size boundaries', () => {
    const memoryProvider = new InMemoryStorageProvider('test-memory');
    const localProvider = new LocalStorageAdapter({ rootDir: path.join(os.tmpdir(), 'bs-test-local-caps') });
    const s3Provider = new S3StorageAdapter({ bucket: 'test-bucket' });
    const supabaseProvider = new SupabaseStorageAdapter({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      bucketName: 'test-bucket',
    });
    const telegramMtproto = new TelegramStorageAdapter({
      mode: 'mtproto',
      apiId: 12345,
      apiHash: 'test-hash',
    });
    const telegramBotApi = new TelegramStorageAdapter({
      mode: 'bot_api',
      botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      defaultChatId: '-100123456789',
    });

    const memoryCaps = memoryProvider.getCapabilities();
    const localCaps = localProvider.getCapabilities();
    const s3Caps = s3Provider.getCapabilities();
    const supabaseCaps = supabaseProvider.getCapabilities();
    const tgMtprotoCaps = telegramMtproto.getCapabilities();
    const tgBotCaps = telegramBotApi.getCapabilities();

    // Verify Local Disk has no artificial single object limit
    assert.strictEqual(localCaps.maxObjectSizeBytes, null);
    assert.strictEqual(localCaps.optimalChunkSizeBytes, 5 * 1024 * 1024);

    // Verify S3 has 5 TB capability
    assert.strictEqual(s3Caps.maxObjectSizeBytes, 5 * 1024 * 1024 * 1024 * 1024);
    assert.strictEqual(s3Caps.optimalChunkSizeBytes, 5 * 1024 * 1024);

    // Verify Telegram MTProto has 2 GB capability and 512 KB optimal parts
    assert.strictEqual(tgMtprotoCaps.maxObjectSizeBytes, 2_000_000_000);
    assert.strictEqual(tgMtprotoCaps.optimalChunkSizeBytes, 512 * 1024);
    assert.strictEqual(tgMtprotoCaps.supportsByteRangeRead, true);
    assert.strictEqual(tgMtprotoCaps.supportsParallelUploads, true);

    // Verify Telegram Bot API fallback declares 50 MB limit
    assert.strictEqual(tgBotCaps.maxObjectSizeBytes, 50 * 1024 * 1024);
    assert.strictEqual(tgBotCaps.optimalChunkSizeBytes, 20 * 1024 * 1024);
    assert.strictEqual(tgBotCaps.supportsByteRangeRead, false);
  });

  it('Phase 4 — ProviderRegistry exposes capabilities and health check metadata', () => {
    const provider = new InMemoryStorageProvider('registry-caps-test');
    ProviderRegistry.register(provider);

    assert.strictEqual(ProviderRegistry.has('registry-caps-test'), true);
    const caps = ProviderRegistry.getCapabilities('registry-caps-test');
    assert.strictEqual(caps.providerId, 'registry-caps-test');
    assert.strictEqual(caps.supportsStreamingRead, true);

    const list = ProviderRegistry.list();
    const found = list.find((p) => p.providerId === 'registry-caps-test');
    assert.ok(found);
    assert.ok(found.capabilities);
    assert.strictEqual(found.capabilities.providerId, 'registry-caps-test');
  });

  it('Phase 5 & 9 — Dynamic Chunking: Transfer Engine determines chunk size from provider capabilities', async () => {
    const tempDir = path.join(os.tmpdir(), `bs-dynamic-chunk-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'metadata.db');
    const repo = new SqliteMetadataRepository(dbPath);

    // Create a 2 MB test file
    const testFilePath = path.join(tempDir, 'sample-2mb.dat');
    const sampleBytes = randomBytes(2 * 1024 * 1024); // 2 MB
    fs.writeFileSync(testFilePath, sampleBytes);

    // Custom provider with 512 KB optimal parts (like Telegram MTProto)
    const custom512kProvider = new InMemoryStorageProvider('custom-512k');
    custom512kProvider.getCapabilities = () => ({
      providerId: 'custom-512k',
      maxObjectSizeBytes: 2_000_000_000,
      optimalChunkSizeBytes: 512 * 1024, // 512 KB
      supportsStreamingRead: true,
      supportsStreamingWrite: true,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
      supportsMultipartLogicalFiles: true,
    });

    const fileMeta = await TransferOrchestrator.uploadFile({
      filePath: testFilePath,
      name: 'sample-2mb.dat',
      mimeType: 'application/octet-stream',
      provider: custom512kProvider,
      repository: repo,
    });

    // 2 MB file / 512 KB parts = 4 chunks
    assert.strictEqual(fileMeta.chunks.length, 4);
    assert.strictEqual(fileMeta.chunks[0].size, 512 * 1024);
    assert.strictEqual(fileMeta.chunks[1].size, 512 * 1024);
    assert.strictEqual(fileMeta.chunks[2].size, 512 * 1024);
    assert.strictEqual(fileMeta.chunks[3].size, 512 * 1024);

    // Clean up
    await repo.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Phase 7 & 8 — Large Logical File: Multi-Part segmentation and SHA-256 integrity verification', async () => {
    const tempDir = path.join(os.tmpdir(), `bs-large-file-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'metadata.db');
    const repo = new SqliteMetadataRepository(dbPath);

    // Create a 6 MB test file
    const testFilePath = path.join(tempDir, 'large-6mb.dat');
    const sampleBytes = randomBytes(6 * 1024 * 1024);
    fs.writeFileSync(testFilePath, sampleBytes);

    const expectedSha256 = createHash('sha256').update(sampleBytes).digest('hex');

    // Provider declaring 2 MB maxObjectSizeBytes
    const boundedProvider = new InMemoryStorageProvider('bounded-2mb');
    boundedProvider.getCapabilities = () => ({
      providerId: 'bounded-2mb',
      maxObjectSizeBytes: 2 * 1024 * 1024, // 2 MB max physical object
      optimalChunkSizeBytes: 2 * 1024 * 1024,
      supportsStreamingRead: true,
      supportsStreamingWrite: true,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
      supportsMultipartLogicalFiles: true,
    });

    const fileMeta = await TransferOrchestrator.uploadFile({
      filePath: testFilePath,
      name: 'large-6mb.dat',
      mimeType: 'application/octet-stream',
      provider: boundedProvider,
      repository: repo,
    });

    // 6 MB / 2 MB max object size = 3 provider chunks
    assert.strictEqual(fileMeta.chunks.length, 3);
    assert.strictEqual(fileMeta.size, 6 * 1024 * 1024);
    assert.strictEqual(fileMeta.wholeFileHash, expectedSha256);

    // Download and reassemble
    const downloadDest = path.join(tempDir, 'downloaded-6mb.dat');
    const downloadResult = await TransferOrchestrator.downloadFile({
      fileId: fileMeta.id,
      destinationPath: downloadDest,
      provider: boundedProvider,
      repository: repo,
    });

    assert.strictEqual(downloadResult.verifiedHash, expectedSha256);
    const downloadedBytes = fs.readFileSync(downloadDest);
    assert.strictEqual(downloadedBytes.byteLength, 6 * 1024 * 1024);
    assert.deepStrictEqual(downloadedBytes, sampleBytes);

    // Clean up
    await repo.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Phase 6 — Telegram MTProto Provider: full Put, Get, Has, Delete cycle with byte-for-byte SHA-256 verification', async () => {
    // Mock MTProto client simulating the GramJS client MTProto RPC methods
    const mockMtproto: import('../src/telegram/telegram-storage-provider').IMtprotoClient = {
      messages: new Map<number, { id: number; data: Uint8Array; media: { document: { id: string; accessHash: string; dcId: number; size: number } } }>(),
      currentId: 100,

      async connect(): Promise<void> {},

      async uploadFile(params: { file: any; workers?: number }): Promise<any> {
        return { id: 12345, parts: 1, name: params.file.name, bytes: params.file.buffer };
      },

      async sendFile(entity: string, params: { file: any; caption?: string }): Promise<any> {
        const msgId = ++this.currentId;
        const bytes = params.file.bytes || new Uint8Array(0);
        const msg = {
          id: msgId,
          data: bytes,
          media: {
            document: {
              id: `doc_${msgId}`,
              accessHash: 'hash_' + msgId,
              dcId: 4,
              size: bytes.length,
            },
          },
        };
        this.messages.set(msgId, msg);
        return msg;
      },

      async getMessages(entity: string, params: { ids: number[] }): Promise<any[]> {
        const res: any[] = [];
        for (const id of params.ids) {
          const found = this.messages.get(id);
          if (found) res.push(found);
        }
        return res;
      },

      async *iterDownload(params: { file: any; chunkSize?: number; requestSize?: number }): AsyncIterable<Uint8Array> {
        for (const msg of this.messages.values()) {
          yield msg.data;
          return;
        }
      },

      async deleteMessages(entity: string, ids: number[], options?: { revoke?: boolean }): Promise<any> {
        for (const id of ids) {
          this.messages.delete(id);
        }
        return true;
      },
    } as any;

    const telegramProvider = new TelegramStorageAdapter({
      mode: 'mtproto',
      mtprotoClient: mockMtproto,
    });

    const chunkData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const hash = createHash('sha256').update(chunkData).digest('hex');

    // 1. Put chunk (triggers GramJS uploadFile -> saveBigFilePart -> sendFile media document)
    const ref = await telegramProvider.putChunk({
      chunkId: 'chunk-tg-real-1',
      size: chunkData.byteLength,
      hash,
      data: (async function* () {
        yield chunkData;
      })(),
    });

    assert.strictEqual(ref.providerId, 'telegram');
    assert.ok(ref.reference);
    const refObj = ref.reference as { documentId?: string; accessHash?: string; dcId?: number; fileId: string };
    assert.ok(refObj.documentId);
    assert.strictEqual(refObj.dcId, 4);

    // 2. Has chunk check (triggers GramJS getMessages -> document metadata inspect)
    const existsStat = await telegramProvider.hasChunk(ref);
    assert.strictEqual(existsStat.exists, true);
    assert.strictEqual(existsStat.size, chunkData.byteLength);

    // 3. Get chunk byte stream and verify 100% byte equality (triggers GramJS iterDownload -> getFile)
    const stream = await telegramProvider.getChunk(ref);
    const downloadedPieces: Uint8Array[] = [];
    for await (const piece of stream) {
      downloadedPieces.push(piece);
    }
    const downloadedCombined = Buffer.concat(downloadedPieces.map((p) => Buffer.from(p)));
    assert.strictEqual(downloadedCombined.length, chunkData.byteLength);
    assert.deepStrictEqual(new Uint8Array(downloadedCombined), chunkData);

    const downloadedHash = createHash('sha256').update(downloadedCombined).digest('hex');
    assert.strictEqual(downloadedHash, hash);

    // 4. Delete chunk (triggers GramJS deleteMessages)
    const deleted = await telegramProvider.deleteChunk(ref);
    assert.strictEqual(deleted, true);

    // 5. Verify chunk is gone (hasChunk -> false, getChunk -> throws ChunkNotFoundError)
    const afterDeleteStat = await telegramProvider.hasChunk(ref);
    assert.strictEqual(afterDeleteStat.exists, false);

    await assert.rejects(
      async () => {
        await telegramProvider.getChunk(ref);
      },
      (err: unknown) => {
        return err instanceof Error && err.name === 'ChunkNotFoundError';
      }
    );
  });
});

