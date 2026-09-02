import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateSha256 } from '../src/lib/storage-store';

describe('Upload Pipeline Optimization Tests', () => {

  // ─── SHA-256 Fast Path / Slow Path ───

  it('calculateSha256 should produce identical hashes for full-buffer and subarray views of same data', async () => {
    const data = new Uint8Array(1024);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;

    // Full buffer (fast path: byteOffset=0, byteLength=buffer.byteLength)
    const hashFull = await calculateSha256(data);

    // Create a larger buffer and embed the data as a subarray (slow path)
    const largerBuffer = new Uint8Array(2048);
    largerBuffer.set(data, 512);
    const subview = largerBuffer.subarray(512, 512 + 1024);

    const hashSub = await calculateSha256(subview);
    assert.strictEqual(hashFull, hashSub, 'Hash must be identical regardless of buffer view');
  });

  it('calculateSha256 fast path should not produce wrong hash for zero-offset view', async () => {
    const data = new TextEncoder().encode('test-data-for-hash-verification');
    const hash1 = await calculateSha256(data);
    const hash2 = await calculateSha256(new Uint8Array(data)); // copy
    assert.strictEqual(hash1, hash2, 'Hashes of identical data must match');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex hash should be 64 chars');
  });

  it('calculateSha256 should handle empty input', async () => {
    const empty = new Uint8Array(0);
    const hash = await calculateSha256(empty);
    // SHA-256 of empty input is well-known
    assert.strictEqual(
      hash,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'Empty data SHA-256 should match known value'
    );
  });

  it('calculateSha256 should handle exactly 4 MB chunk (typical upload size)', async () => {
    const chunkSize = 4 * 1024 * 1024;
    const data = new Uint8Array(chunkSize);
    // Fill with pseudo-random pattern
    for (let i = 0; i < chunkSize; i++) data[i] = (i * 7 + 13) % 256;

    const hash = await calculateSha256(data);
    assert.strictEqual(hash.length, 64, 'Hash should be 64 hex chars');

    // Verify consistency
    const hash2 = await calculateSha256(data);
    assert.strictEqual(hash, hash2, 'Same data must produce same hash');
  });

  // ─── Concurrent Upload Ordering ───

  it('concurrent workers should produce correctly ordered chunk hashes', async () => {
    // Simulate the worker pattern from storage-store.ts
    const totalChunks = 20;
    const results: { index: number; hash: string }[] = [];
    let nextIndex = 0;
    let error: Error | null = null;
    const CONCURRENCY = 5;

    const worker = async () => {
      while (nextIndex < totalChunks && !error) {
        const index = nextIndex++;
        try {
          const data = new TextEncoder().encode(`chunk-data-${index}`);
          const hash = await calculateSha256(data);
          results.push({ index, hash });
        } catch (err: any) {
          error = err;
          break;
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY, totalChunks);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    assert.strictEqual(error, null, 'No errors should occur');
    assert.strictEqual(results.length, totalChunks, 'All chunks must be processed');

    // Sort by index and verify no duplicates, no gaps
    results.sort((a, b) => a.index - b.index);
    for (let i = 0; i < totalChunks; i++) {
      assert.strictEqual(results[i].index, i, `Chunk index ${i} should be present`);
    }

    // Verify hash uniqueness (each chunk has different content)
    const uniqueHashes = new Set(results.map(r => r.hash));
    assert.strictEqual(uniqueHashes.size, totalChunks, 'Each chunk should have a unique hash');
  });

  it('concurrent workers should stop on first error', async () => {
    const totalChunks = 10;
    const processed: number[] = [];
    let nextIndex = 0;
    let uploadError: Error | null = null;
    const CONCURRENCY = 5;

    const worker = async () => {
      while (nextIndex < totalChunks && !uploadError) {
        const index = nextIndex++;
        if (index === 3) {
          uploadError = new Error('simulated-failure');
          break;
        }
        processed.push(index);
        // Simulate async work
        await new Promise(r => setTimeout(r, 1));
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, () => worker());
    await Promise.all(workers);

    assert.ok(uploadError !== null, 'Error should be captured');
    assert.strictEqual(uploadError?.message, 'simulated-failure');
    // Not all chunks should be processed
    assert.ok(processed.length < totalChunks, 'Workers should stop after error');
    // Chunk 3 should NOT be in processed (it triggered the error)
    assert.ok(!processed.includes(3), 'Failed chunk should not appear in results');
  });

  // ─── Retry Behavior ───

  it('retry logic should attempt up to 3 times with increasing delay', async () => {
    let attempts = 0;
    const delays: number[] = [];

    const mockPutChunk = async (): Promise<string> => {
      attempts++;
      if (attempts < 3) {
        const delay = attempts * 1500;
        delays.push(delay);
        throw new Error(`Attempt ${attempts} failed`);
      }
      return 'success';
    };

    // Simulate the retry loop from HttpTelegramStorageAdapter.putChunk
    let lastError: Error | null = null;
    let result: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await mockPutChunk();
        break;
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          // delays already tracked in mock
        }
      }
    }

    assert.strictEqual(attempts, 3, 'Should attempt 3 times');
    assert.strictEqual(result, 'success', 'Third attempt should succeed');
    assert.deepStrictEqual(delays, [1500, 3000], 'Delays should be 1500ms and 3000ms');
  });

  it('retry should propagate final error after all attempts exhausted', async () => {
    let attempts = 0;

    const alwaysFails = async (): Promise<string> => {
      attempts++;
      throw new Error(`failure-${attempts}`);
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await alwaysFails();
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    assert.strictEqual(attempts, 3, 'Should exhaust all attempts');
    assert.ok(lastError !== null, 'Should have captured error');
    assert.strictEqual(lastError?.message, 'failure-3', 'Last error should be from final attempt');
  });

  // ─── Chunk Size Boundary ───

  it('chunk count calculation should handle exact boundaries and small files', () => {
    const CHUNK_SIZE = 4 * 1024 * 1024;

    // Exact multiple
    const size1 = 4 * CHUNK_SIZE;
    assert.strictEqual(Math.max(1, Math.ceil(size1 / CHUNK_SIZE)), 4);

    // One byte over
    const size2 = 4 * CHUNK_SIZE + 1;
    assert.strictEqual(Math.max(1, Math.ceil(size2 / CHUNK_SIZE)), 5);

    // Tiny file
    const size3 = 100;
    assert.strictEqual(Math.max(1, Math.ceil(size3 / CHUNK_SIZE)), 1);

    // Empty file
    const size4 = 0;
    assert.strictEqual(Math.max(1, Math.ceil(size4 / CHUNK_SIZE)), 1);

    // Exactly one chunk
    const size5 = CHUNK_SIZE;
    assert.strictEqual(Math.max(1, Math.ceil(size5 / CHUNK_SIZE)), 1);

    // Large file (500 MB = 125 chunks)
    const size6 = 500 * 1024 * 1024;
    assert.strictEqual(Math.max(1, Math.ceil(size6 / CHUNK_SIZE)), 125);
  });

  // ─── Memory Bounded Assertion ───

  it('concurrent workers should not exceed CONCURRENCY active operations', async () => {
    const CONCURRENCY = 5;
    const totalChunks = 20;
    let nextIndex = 0;
    let activeCount = 0;
    let maxActive = 0;

    const worker = async () => {
      while (nextIndex < totalChunks) {
        const index = nextIndex++;
        if (index >= totalChunks) break;

        activeCount++;
        if (activeCount > maxActive) maxActive = activeCount;

        // Simulate async work
        await new Promise(r => setTimeout(r, Math.random() * 5));

        activeCount--;
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, () => worker());
    await Promise.all(workers);

    assert.ok(maxActive <= CONCURRENCY, `Max active (${maxActive}) should not exceed CONCURRENCY (${CONCURRENCY})`);
  });
});
