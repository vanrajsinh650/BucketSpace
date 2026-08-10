import assert from 'node:assert';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ChunkMetadata,
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
} from '@bucketspace/shared';
import { SqliteMetadataRepository } from '../src/sqlite/sqlite-metadata-repository';

test('SqliteMetadataRepository — Centerpiece Database Close & Reopen Test', async () => {
  const dbPath = join(tmpdir(), `bucketspace_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.db`);

  const fileId = createFileId('file-uuid-101');
  const sampleFile: FileMetadata = {
    id: fileId,
    name: 'test_archive.tar.gz',
    size: 52428800, // 50MB
    mimeType: 'application/gzip',
    wholeFileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: new Date('2026-08-10T12:00:00.000Z'),
    updatedAt: new Date('2026-08-10T12:00:00.000Z'),
    chunks: [],
  };

  // Phase 1: Open Database 1, create file & save 5 chunks
  const repo1 = new SqliteMetadataRepository(dbPath);
  await repo1.createFile(sampleFile, 'CHUNKING');

  const chunks: ChunkMetadata[] = Array.from({ length: 5 }, (_, i) => ({
    id: createChunkId(`chunk-uuid-${i + 1}`),
    fileId,
    index: i,
    size: 10485760, // 10MB
    hash: `hash_chunk_${i + 1}`,
    providerRef: {
      providerId: 'telegram',
      reference: { chatId: '-100123456789', messageId: 100 + i, fileId: `tg_file_${i + 1}` },
    },
  }));

  await repo1.saveChunksBulk(chunks);
  await repo1.updateFileStatus(fileId, 'COMPLETED');

  // Close Database Connection 1
  await repo1.close();

  // Phase 2: Open SAME Database file in a NEW Connection Instance
  const repo2 = new SqliteMetadataRepository(dbPath);

  const reloadedFile = await repo2.getFileById(fileId);
  assert.ok(reloadedFile !== null, 'Reloaded file must exist');
  assert.strictEqual(reloadedFile.id, fileId);
  assert.strictEqual(reloadedFile.name, 'test_archive.tar.gz');
  assert.strictEqual(reloadedFile.size, 52428800);
  assert.strictEqual(reloadedFile.mimeType, 'application/gzip');
  assert.strictEqual(reloadedFile.wholeFileHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.strictEqual(reloadedFile.chunks.length, 5);

  // Assert chunk order and opaque provider ref deserialization
  for (let i = 0; i < 5; i++) {
    const chunk: ChunkMetadata = reloadedFile.chunks[i];
    assert.strictEqual(chunk.index, i);
    assert.strictEqual(chunk.size, 10485760);
    assert.strictEqual(chunk.hash, `hash_chunk_${i + 1}`);
    assert.ok(chunk.providerRef !== undefined);
    assert.strictEqual(chunk.providerRef?.providerId, 'telegram');
    assert.deepStrictEqual(chunk.providerRef?.reference, {
      chatId: '-100123456789',
      messageId: 100 + i,
      fileId: `tg_file_${i + 1}`,
    });
  }

  await repo2.close();

  // Cleanup temp database file & WAL sidecars
  try {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  } catch {
    // Ignore cleanup error if file locked
  }
});

test('SqliteMetadataRepository — Foreign Key Constraint Invariant', async () => {
  const repo = new SqliteMetadataRepository(':memory:');

  const invalidChunk = {
    id: createChunkId('orphan-chunk-01'),
    fileId: createFileId('non-existent-file-id'),
    index: 0,
    size: 1024,
    hash: 'dummy_hash',
    providerRef: { providerId: 'in-memory', reference: { key: 'k1' } },
  };

  // Foreign key enforcement must reject orphan chunks
  await assert.rejects(
    async () => {
      await repo.saveChunk(invalidChunk);
    },
    (err: unknown) => err instanceof Error && err.message.includes('FOREIGN KEY')
  );

  await repo.close();
});

test('SqliteMetadataRepository — UNIQUE(file_id, chunk_index) Constraint Invariant', async () => {
  const repo = new SqliteMetadataRepository(':memory:');

  const fileId = createFileId('file-uuid-202');
  await repo.createFile({
    id: fileId,
    name: 'document.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    wholeFileHash: 'hash_abc',
    createdAt: new Date(),
    updatedAt: new Date(),
    chunks: [],
  });

  const chunk0a = {
    id: createChunkId('chunk-id-1'),
    fileId,
    index: 0,
    size: 1024,
    hash: 'hash_1',
    providerRef: { providerId: 'in-memory', reference: { key: 'k1' } },
  };

  await repo.saveChunk(chunk0a);

  const chunk0b = {
    id: createChunkId('chunk-id-2'), // Different chunk ID
    fileId,
    index: 0, // Duplicate chunk index for same file_id
    size: 1024,
    hash: 'hash_2',
    providerRef: { providerId: 'in-memory', reference: { key: 'k2' } },
  };

  // Unique constraint uq_file_chunk must reject duplicate (file_id, chunk_index)
  await assert.rejects(
    async () => {
      await repo.saveChunk(chunk0b);
    },
    (err: unknown) => err instanceof Error && err.message.includes('UNIQUE constraint failed')
  );

  await repo.close();
});

test('SqliteMetadataRepository — Metadata Deletion Cascades to Chunks', async () => {
  const repo = new SqliteMetadataRepository(':memory:');

  const fileId = createFileId('file-uuid-303');
  await repo.createFile({
    id: fileId,
    name: 'photo.jpg',
    size: 4096,
    mimeType: 'image/jpeg',
    wholeFileHash: 'hash_xyz',
    createdAt: new Date(),
    updatedAt: new Date(),
    chunks: [
      {
        id: createChunkId('chunk-del-1'),
        fileId,
        index: 0,
        size: 4096,
        hash: 'hash_photo',
        providerRef: { providerId: 'in-memory', reference: { key: 'k_photo' } },
      },
    ],
  });

  const fileBefore = await repo.getFileById(fileId);
  assert.ok(fileBefore !== null);
  assert.strictEqual(fileBefore.chunks.length, 1);

  const deleted = await repo.deleteFileMetadata(fileId);
  assert.strictEqual(deleted, true);

  const fileAfter = await repo.getFileById(fileId);
  assert.strictEqual(fileAfter, null);

  await repo.close();
});
