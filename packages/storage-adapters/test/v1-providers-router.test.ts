import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createChunkId } from '@bucketspace/shared';
import { LocalStorageAdapter } from '../src/local/local-storage-provider';
import { ProviderRegistry } from '../src/registry/provider-registry';
import { StorageRouter } from '../src/router/storage-router';
import { S3StorageAdapter } from '../src/s3/s3-storage-provider';
import { SupabaseStorageAdapter } from '../src/supabase/supabase-storage-provider';

test('V1 — LocalStorageAdapter Put, Get, Has, Delete Cycle', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-local-adapter-'));
  const adapter = new LocalStorageAdapter({ rootDir: tempDir });

  const chunkId = createChunkId('chunk-local-001');
  const sampleText = 'Local storage chunk test payload 12345';
  const chunkBytes = new TextEncoder().encode(sampleText);

  // Hash calculation
  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256').update(chunkBytes).digest('hex');

  // Put chunk
  const ref = await adapter.putChunk({
    chunkId,
    size: chunkBytes.byteLength,
    hash,
    data: (async function* () {
      yield chunkBytes;
    })(),
  });

  assert.strictEqual(ref.providerId, 'local-disk');

  // Has chunk
  const stat = await adapter.hasChunk(ref);
  assert.strictEqual(stat.exists, true);
  assert.strictEqual(stat.size, chunkBytes.byteLength);

  // Get chunk
  const stream = await adapter.getChunk(ref);
  const pieces: Uint8Array[] = [];
  for await (const piece of stream) {
    pieces.push(piece);
  }
  const combined = new Uint8Array(pieces.reduce((sum, p) => sum + p.byteLength, 0));
  let offset = 0;
  for (const piece of pieces) {
    combined.set(piece, offset);
    offset += piece.byteLength;
  }
  assert.strictEqual(new TextDecoder().decode(combined), sampleText);

  // Delete chunk
  const deleted = await adapter.deleteChunk(ref);
  assert.strictEqual(deleted, true);

  const statAfterDelete = await adapter.hasChunk(ref);
  assert.strictEqual(statAfterDelete.exists, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('V1 — S3StorageAdapter & SupabaseStorageAdapter Integration', async () => {
  const s3Adapter = new S3StorageAdapter({ bucket: 'my-bucket' });
  const supaAdapter = new SupabaseStorageAdapter({
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
    bucketName: 'user-bucket',
  });

  const crypto = await import('node:crypto');
  const chunkId = createChunkId('chunk-multi-001');
  const dataBytes = new TextEncoder().encode('Multi-cloud chunk payload');
  const hash = crypto.createHash('sha256').update(dataBytes).digest('hex');

  // S3 Put & Get
  const s3Ref = await s3Adapter.putChunk({
    chunkId,
    size: dataBytes.byteLength,
    hash,
    data: (async function* () {
      yield dataBytes;
    })(),
  });
  assert.strictEqual(s3Ref.providerId, 's3-r2');
  const s3Stat = await s3Adapter.hasChunk(s3Ref);
  assert.strictEqual(s3Stat.exists, true);

  // Supabase Put & Get
  const supaRef = await supaAdapter.putChunk({
    chunkId,
    size: dataBytes.byteLength,
    hash,
    data: (async function* () {
      yield dataBytes;
    })(),
  });
  assert.strictEqual(supaRef.providerId, 'supabase');
  const supaStat = await supaAdapter.hasChunk(supaRef);
  assert.strictEqual(supaStat.exists, true);
});

test('V1 — StorageRouter Dynamic Rule Resolution', () => {
  const router = new StorageRouter('local-disk');

  // Photo -> Telegram
  const photoTarget = router.resolveProviderId({
    name: 'photo.png',
    mimeType: 'image/png',
  });
  assert.strictEqual(photoTarget, 'telegram');

  // Video -> S3 / R2
  const videoTarget = router.resolveProviderId({
    name: 'movie.mp4',
    mimeType: 'video/mp4',
  });
  assert.strictEqual(videoTarget, 's3-r2');

  // PDF Document -> Supabase
  const pdfTarget = router.resolveProviderId({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
  });
  assert.strictEqual(pdfTarget, 'supabase');

  // Unmatched -> Default Local Disk
  const projectTarget = router.resolveProviderId({
    name: 'app.tar.gz',
    mimeType: 'application/x-gzip',
  });
  assert.strictEqual(projectTarget, 'local-disk');
});
