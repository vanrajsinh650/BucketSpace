import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileChunker } from '../src/modules/storage/transfer/file-chunker';

describe('FileChunker - Streaming Bounded Chunking & SHA-256 Digest', () => {
  it('should split file into deterministic chunks and verify stream integrity', async () => {
    const testSize = 2.5 * 1024 * 1024; // 2.5 MB
    const testData = crypto.randomBytes(testSize);
    const expectedRootHash = crypto.createHash('sha256').update(testData).digest('hex');

    const tempFilePath = path.join(os.tmpdir(), `bucketspace-test-${Date.now()}.bin`);
    fs.writeFileSync(tempFilePath, testData);

    try {
      const chunkSize = 1 * 1024 * 1024; // 1 MB chunks
      const chunker = createFileChunker(tempFilePath, chunkSize);

      assert.strictEqual(chunker.totalSize, testSize);

      const collectedChunks: { index: number; size: number; hash: string }[] = [];
      for await (const chunk of chunker.chunkStream) {
        collectedChunks.push({
          index: chunk.index,
          size: chunk.size,
          hash: chunk.hash,
        });
      }

      assert.strictEqual(collectedChunks.length, 3, '2.5MB payload with 1MB chunk size must produce 3 chunks');
      assert.strictEqual(collectedChunks[0].size, 1024 * 1024);
      assert.strictEqual(collectedChunks[1].size, 1024 * 1024);
      assert.strictEqual(collectedChunks[2].size, 0.5 * 1024 * 1024);

      const computedRootHash = chunker.getWholeFileHash();
      assert.strictEqual(computedRootHash, expectedRootHash, 'Whole file SHA-256 must match exact content');
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });
});
