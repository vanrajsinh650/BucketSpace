import assert from 'node:assert';
import test from 'node:test';
import { createChunkId } from '@bucketspace/shared';
import { TelegramStorageAdapter } from '../src/telegram/telegram-storage-provider';
import { StorageRouter } from '../src/router/storage-router';

test('V1 — TelegramStorageAdapter Put, Get, Has, Delete Cycle', async () => {
  const adapter = new TelegramStorageAdapter({
    mode: 'mtproto',
    apiId: 12345,
    apiHash: 'test-hash',
  });

  const chunkId = createChunkId('chunk-tg-001');
  const sampleText = 'Telegram cloud chunk test payload 12345';
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

  assert.strictEqual(ref.providerId, 'telegram');

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
});

test('V1 — StorageRouter Telegram Default Resolution', () => {
  const router = new StorageRouter('telegram');

  const photoTarget = router.resolveProviderId({
    name: 'photo.png',
    mimeType: 'image/png',
  });
  assert.strictEqual(photoTarget, 'telegram');

  const videoTarget = router.resolveProviderId({
    name: 'movie.mp4',
    mimeType: 'video/mp4',
  });
  assert.strictEqual(videoTarget, 'telegram');

  const pdfTarget = router.resolveProviderId({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
  });
  assert.strictEqual(pdfTarget, 'telegram');
});
