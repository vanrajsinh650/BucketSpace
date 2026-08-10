import assert from 'node:assert';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ChunkNotFoundError,
  InvalidProviderRefError,
} from '@bucketspace/shared';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';


// Helper: Convert array of Uint8Array pieces into AsyncIterable<Uint8Array>
async function* createAsyncByteStream(pieces: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const piece of pieces) {
    yield piece;
  }
}

test('InMemoryStorageProvider — Incremental Stream Roundtrip & SHA-256 Verification', async () => {
  const provider = new InMemoryStorageProvider();
  assert.strictEqual(provider.providerId, 'in-memory');

  // 1. Generate 100 stream pieces of 1024 bytes each (total 102.4 KB)
  const pieces: Uint8Array[] = [];
  const hasher = createHash('sha256');

  for (let i = 0; i < 100; i++) {
    const piece = new Uint8Array(1024);
    for (let j = 0; j < piece.length; j++) {
      piece[j] = (i + j) % 256;
    }
    pieces.push(piece);
    hasher.update(piece);
  }

  const expectedSha256 = hasher.digest('hex');
  const totalSize = 100 * 1024;

  // 2. Put chunk stream into provider
  const chunkInput = {
    chunkId: 'chunk-test-001',
    size: totalSize,
    hash: expectedSha256,
    data: createAsyncByteStream(pieces),
  };

  const ref = await provider.putChunk(chunkInput);

  // 3. Verify opaque reference structure
  assert.strictEqual(ref.providerId, 'in-memory');
  assert.strictEqual(typeof ref.reference, 'object');
  assert.ok(ref.reference !== null);

  // 4. Verify existence and stat
  const stat = await provider.hasChunk(ref);
  assert.strictEqual(stat.exists, true);
  assert.strictEqual(stat.size, totalSize);

  // 5. Retrieve stream and verify incremental byte integrity and SHA-256
  const retrievedStream = await provider.getChunk(ref);
  const retrievedHasher = createHash('sha256');
  let retrievedBytesCount = 0;
  let pieceIndex = 0;

  for await (const piece of retrievedStream) {
    retrievedHasher.update(piece);
    retrievedBytesCount += piece.byteLength;
    assert.deepStrictEqual(piece, pieces[pieceIndex]);
    pieceIndex++;
  }

  const retrievedSha256 = retrievedHasher.digest('hex');

  assert.strictEqual(retrievedBytesCount, totalSize);
  assert.strictEqual(pieceIndex, 100);
  assert.strictEqual(retrievedSha256, expectedSha256);

  // 6. Delete chunk and verify deletion
  const deleteResult = await provider.deleteChunk(ref);
  assert.strictEqual(deleteResult, true);

  const postDeleteStat = await provider.hasChunk(ref);
  assert.strictEqual(postDeleteStat.exists, false);

  // 7. Verify ChunkNotFoundError when retrieving deleted chunk
  await assert.rejects(
    async () => {
      await provider.getChunk(ref);
    },
    (err: unknown) => {
      return err instanceof ChunkNotFoundError && err.ref.providerId === 'in-memory';
    }
  );
});

test('InMemoryStorageProvider — Invalid Reference Handling', async () => {
  const provider = new InMemoryStorageProvider();

  // Test invalid provider ID
  const wrongProviderRef = {
    providerId: 's3',
    reference: { key: 'some_key' },
  };

  await assert.rejects(
    async () => {
      await provider.getChunk(wrongProviderRef);
    },
    (err: unknown) => err instanceof InvalidProviderRefError
  );

  // Test malformed reference object
  const malformedRef = {
    providerId: 'in-memory',
    reference: 'not_an_object',
  };

  await assert.rejects(
    async () => {
      await provider.getChunk(malformedRef);
    },
    (err: unknown) => err instanceof InvalidProviderRefError
  );
});
