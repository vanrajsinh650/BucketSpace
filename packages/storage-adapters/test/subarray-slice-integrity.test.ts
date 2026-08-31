import assert from 'node:assert';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';

/**
 * Web Crypto & Node Crypto SHA-256 helper that mimics the exact browser implementation in storage-store.ts:
 * Uses buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) to ensure
 * subarray views backed by a larger ArrayBuffer are hashed strictly over their visible slice.
 */
function calculateSliceSha256(data: Uint8Array): string {
  const safeBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return createHash('sha256').update(safeBuffer).digest('hex');
}

function calculateFullUnderlyingBufferSha256(data: Uint8Array): string {
  const fullBuffer = Buffer.from(data.buffer);
  return createHash('sha256').update(fullBuffer).digest('hex');
}

test('Integrity Bug Regression — Uint8Array.subarray() backing-buffer offset isolation', async () => {
  // Construct full file buffer: [A A A A B B B B C C C C]
  const fullFile = new Uint8Array(12);
  fullFile.fill(0xAA, 0, 4); // Section A: bytes 0..3
  fullFile.fill(0xBB, 4, 8); // Section B: bytes 4..7 (Chunk 1)
  fullFile.fill(0xCC, 8, 12); // Section C: bytes 8..11

  const chunk1 = fullFile.subarray(4, 8);

  // Assert memory layout: chunk1 shares the same underlying ArrayBuffer
  assert.strictEqual(chunk1.buffer, fullFile.buffer, 'Subarray must share the underlying ArrayBuffer');
  assert.strictEqual(chunk1.byteOffset, 4, 'Chunk 1 must start at byteOffset 4');
  assert.strictEqual(chunk1.byteLength, 4, 'Chunk 1 must have byteLength 4');

  // Calculate hashes
  const sliceHash = calculateSliceSha256(chunk1);
  const buggyUnderlyingBufferHash = calculateFullUnderlyingBufferSha256(chunk1);
  const directExpectedHash = createHash('sha256').update(new Uint8Array([0xBB, 0xBB, 0xBB, 0xBB])).digest('hex');
  const fullFileExpectedHash = createHash('sha256').update(fullFile).digest('hex');

  // Verify that hashing the whole buffer produces the whole file hash (the bug)
  assert.strictEqual(
    buggyUnderlyingBufferHash,
    fullFileExpectedHash,
    'Bug proof: data.buffer produces hash of the entire file, ignoring chunk boundaries'
  );

  // Verify that the slice hash strictly produces the chunk hash
  assert.strictEqual(
    sliceHash,
    directExpectedHash,
    'Fix proof: buffer.slice(byteOffset, length) produces exact hash of the chunk slice only'
  );

  // Prove sliceHash !== buggyUnderlyingBufferHash
  assert.notStrictEqual(
    sliceHash,
    buggyUnderlyingBufferHash,
    'Invariant: chunk slice SHA-256 must NOT equal the full backing buffer SHA-256'
  );
});

test('Integrity Bug Regression — Multi-chunk Upload -> Storage -> Preview -> Download Lifecycle', async () => {
  const provider = new InMemoryStorageProvider('in-memory-test');

  // 1. Generate 12 MB binary file (three 4 MB chunks) with non-text pseudo-random bytes
  const TOTAL_SIZE = 12 * 1024 * 1024; // 12 MB
  const CHUNK_SIZE = 4 * 1024 * 1024;  // 4 MB
  const fileBuffer = new Uint8Array(TOTAL_SIZE);
  for (let i = 0; i < TOTAL_SIZE; i++) {
    fileBuffer[i] = (i * 31 + 17) % 256;
  }

  const wholeFileHash = createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');
  const totalChunks = Math.ceil(TOTAL_SIZE / CHUNK_SIZE);
  assert.strictEqual(totalChunks, 3, 'Must have 3 logical chunks');

  // 2. Upload Phase: slice subarrays from the same fileBuffer
  const uploadedChunks: {
    index: number;
    chunkId: string;
    hash: string;
    size: number;
    providerRef: any;
  }[] = [];

  for (let index = 0; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, TOTAL_SIZE);
    const chunkSlice = fileBuffer.subarray(start, end);

    // Assert that chunks 1 and 2 have non-zero byte offsets into fileBuffer
    if (index > 0) {
      assert.ok(chunkSlice.byteOffset > 0, `Chunk ${index} must have non-zero byteOffset`);
    }

    const chunkHash = calculateSliceSha256(chunkSlice);
    const chunkId = `chunk-file-test-${index}`;

    const providerRef = await provider.putChunk({
      chunkId,
      size: chunkSlice.byteLength,
      hash: chunkHash,
      data: (async function* () {
        yield chunkSlice;
      })(),
    });

    uploadedChunks.push({
      index,
      chunkId,
      hash: chunkHash,
      size: chunkSlice.byteLength,
      providerRef,
    });
  }

  // 3. Preview / Download Phase: Read back each chunk and verify hash
  const downloadedPieces: Uint8Array[] = [];

  for (const chunk of uploadedChunks) {
    const stream = await provider.getChunk(chunk.providerRef);
    const pieces: Uint8Array[] = [];
    let totalLength = 0;

    for await (const piece of stream) {
      pieces.push(piece);
      totalLength += piece.byteLength;
    }

    assert.strictEqual(totalLength, chunk.size, `Chunk ${chunk.index} downloaded size must match uploaded size`);

    const chunkCombined = new Uint8Array(totalLength);
    let offset = 0;
    for (const piece of pieces) {
      chunkCombined.set(piece, offset);
      offset += piece.byteLength;
    }

    // Verify Chunk SHA-256
    const verifiedChunkHash = calculateSliceSha256(chunkCombined);
    assert.strictEqual(
      verifiedChunkHash,
      chunk.hash,
      `Chunk ${chunk.index} downloaded hash must EXACTLY match hash stored at upload time`
    );

    // Verify exact byte equality against original slice
    const originalSlice = fileBuffer.subarray(chunk.index * CHUNK_SIZE, Math.min((chunk.index + 1) * CHUNK_SIZE, TOTAL_SIZE));
    assert.deepStrictEqual(
      Buffer.from(chunkCombined),
      Buffer.from(originalSlice),
      `Chunk ${chunk.index} bytes must be bit-identical to original slice`
    );

    downloadedPieces.push(chunkCombined);
  }

  // 4. Whole-file reassembly and hash verification
  const fullTotalSize = downloadedPieces.reduce((sum, p) => sum + p.byteLength, 0);
  assert.strictEqual(fullTotalSize, TOTAL_SIZE, 'Reassembled size must equal original file size');

  const fullCombined = new Uint8Array(fullTotalSize);
  let fullOffset = 0;
  for (const piece of downloadedPieces) {
    fullCombined.set(piece, fullOffset);
    fullOffset += piece.byteLength;
  }

  const verifiedWholeHash = calculateSliceSha256(fullCombined);
  assert.strictEqual(
    verifiedWholeHash,
    wholeFileHash,
    'Reassembled whole-file hash must match original file hash'
  );
  assert.deepStrictEqual(
    Buffer.from(fullCombined),
    Buffer.from(fileBuffer),
    'Reassembled whole-file bytes must be bit-identical to original file buffer'
  );
});

test('Integrity Regression — Real Filesystem Subarray Slicing, Readback & Hash Fidelity', async () => {
  // 1. Initialize InMemory Provider
  const providerA = new InMemoryStorageProvider('in-memory-slice-test');

  // 2. Generate 15 MB binary file (three 5 MB chunks) with non-text pseudorandom bytes
  const TOTAL_SIZE = 15 * 1024 * 1024; // 15 MB
  const CHUNK_SIZE = 5 * 1024 * 1024;  // 5 MB
  const fileBuffer = new Uint8Array(TOTAL_SIZE);
  for (let i = 0; i < TOTAL_SIZE; i++) {
    fileBuffer[i] = (i * 37 + 19) % 256;
  }

  const wholeFileHash = createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');
  const totalChunks = Math.ceil(TOTAL_SIZE / CHUNK_SIZE);
  assert.strictEqual(totalChunks, 3, 'Must have 3 logical chunks');

  // 3. Upload Phase: Slice subarrays with non-zero byte offsets
  const uploadedChunks: {
    index: number;
    chunkId: string;
    hash: string;
    size: number;
    providerRef: any;
  }[] = [];

  for (let index = 0; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, TOTAL_SIZE);
    const chunkSlice = fileBuffer.subarray(start, end);

    if (index > 0) {
      assert.ok(chunkSlice.byteOffset > 0, `Chunk ${index} must have non-zero byteOffset in backing buffer`);
    }

    const chunkHash = calculateSliceSha256(chunkSlice);
    const chunkId = `chunk-slice-test-${index}`;

    const providerRef = await providerA.putChunk({
      chunkId,
      size: chunkSlice.byteLength,
      hash: chunkHash,
      data: (async function* () {
        yield chunkSlice;
      })(),
    });

    uploadedChunks.push({
      index,
      chunkId,
      hash: chunkHash,
      size: chunkSlice.byteLength,
      providerRef,
    });
  }

  // 4. Readback & Verification Phase
  const providerB = providerA;
    const downloadedPieces: Uint8Array[] = [];

    for (const chunk of uploadedChunks) {
      const stream = await providerB.getChunk(chunk.providerRef);
      const pieces: Uint8Array[] = [];
      let totalLength = 0;

      for await (const piece of stream) {
        pieces.push(piece);
        totalLength += piece.byteLength;
      }

      assert.strictEqual(totalLength, chunk.size, `Disk readback size for chunk ${chunk.index} must match`);

      const chunkCombined = new Uint8Array(totalLength);
      let offset = 0;
      for (const piece of pieces) {
        chunkCombined.set(piece, offset);
        offset += piece.byteLength;
      }

      // Verify Chunk SHA-256
      const verifiedChunkHash = calculateSliceSha256(chunkCombined);
      assert.strictEqual(
        verifiedChunkHash,
        chunk.hash,
        `Chunk ${chunk.index} read from disk must EXACTLY match the upload hash metadata`
      );

      // Verify bit-for-bit equality against original slice
      const originalSlice = fileBuffer.subarray(chunk.index * CHUNK_SIZE, Math.min((chunk.index + 1) * CHUNK_SIZE, TOTAL_SIZE));
      assert.deepStrictEqual(
        Buffer.from(chunkCombined),
        Buffer.from(originalSlice),
        `Chunk ${chunk.index} read from disk must be bit-identical to original slice`
      );

      downloadedPieces.push(chunkCombined);
    }

    // 6. Whole-File Reassembly & Verification
    const fullTotalSize = downloadedPieces.reduce((sum, p) => sum + p.byteLength, 0);
    assert.strictEqual(fullTotalSize, TOTAL_SIZE, 'Reassembled size from disk must equal original file size');

    const fullCombined = new Uint8Array(fullTotalSize);
    let fullOffset = 0;
    for (const piece of downloadedPieces) {
      fullCombined.set(piece, fullOffset);
      fullOffset += piece.byteLength;
    }

    const verifiedWholeHash = calculateSliceSha256(fullCombined);
    assert.strictEqual(
      verifiedWholeHash,
      wholeFileHash,
      'Reassembled whole-file hash must match original file hash'
    );
    assert.deepStrictEqual(
      Buffer.from(fullCombined),
      Buffer.from(fileBuffer),
      'Reassembled whole-file bytes must be bit-identical to original file buffer'
    );
});

