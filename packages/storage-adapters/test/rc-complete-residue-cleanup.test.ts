import assert from 'node:assert';
import test from 'node:test';
import { createFileId, ExtractedContent } from '@bucketspace/shared';
import {
  createSqliteDatabase,
  ContentRepository,
  VectorRepository,
} from '@bucketspace/db';
import {
  EphemeralStateTracker,
  HybridSearchEngine,
  LocalEmbeddingProvider,
  ResidueCleaner,
  TokenShareProvider,
} from '../src';

/* ─── 1.0 RC: Complete Ephemeral State & Residue Cleanup Suite ─── */

test('1.0 RC Residue Cleanup — Complete Purge of DB, FTS, Vectors, Share Links & Ephemeral Caches', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  const fileId = 'file-cleanup-target';

  // Seed file in DB
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES (?, 'classified_specs.pdf', 4096, 'application/pdf', 'hash-classified', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(fileId, now, now);

  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);
  const shareProvider = new TokenShareProvider();

  // Ingest content & index
  const doc: ExtractedContent = {
    fileId: createFileId(fileId),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Classified rocket propulsion specifications.',
    segments: [{ id: 's-cl', segmentIndex: 0, text: 'Classified rocket propulsion specifications.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  // Create share link
  const shareLink = await shareProvider.createShareLink(fileId);
  const rawShareToken = shareLink.shareId;

  // Populate ephemeral / in-memory cache state
  const ephemeralState: EphemeralStateTracker = {
    tempUploadBuffers: new Map([[fileId, [new Uint8Array([1, 2, 3])]]]),
    thumbnailCache: new Map([[fileId, new Uint8Array([4, 5, 6])]]),
    extractedIntermediates: new Map([[fileId, 'intermediate extracted text data']]),
    transcriptionCache: new Map([[fileId, { segments: [] }]]),
    embeddingCache: new Map([[fileId, [0.1, 0.2, 0.3]]]),
    failedTransferJobs: new Set([fileId]),
  };

  // Verify before purge: state exists across all stores
  assert.strictEqual(contentRepo.searchContentFts('propulsion').length, 1);
  assert.strictEqual(vectorRepo.searchCosineSimilarity(await embedProvider.embedText('rocket'), 5).length, 1);
  assert.ok((await shareProvider.getShareLink(rawShareToken)) !== null);
  assert.ok(ephemeralState.tempUploadBuffers.has(fileId));
  assert.ok(ephemeralState.thumbnailCache.has(fileId));
  assert.ok(ephemeralState.extractedIntermediates.has(fileId));
  assert.ok(ephemeralState.failedTransferJobs.has(fileId));

  // ─── Execute Complete Residue Purge ───
  const cleaner = new ResidueCleaner(contentRepo, vectorRepo, shareProvider, ephemeralState);
  const result = await cleaner.purgeFileCompletely(fileId, [rawShareToken]);

  assert.strictEqual(result.ftsPurged, true);
  assert.strictEqual(result.vectorsPurged, true);
  assert.strictEqual(result.sharesRevoked, 1);
  assert.strictEqual(result.ephemeralCleaned, true);

  // ─── Verify Zero Artifact Residue ───
  // Persistent layers:
  assert.strictEqual(contentRepo.searchContentFts('propulsion').length, 0);
  assert.strictEqual(contentRepo.getContent(fileId), null);
  assert.strictEqual(vectorRepo.searchCosineSimilarity(await embedProvider.embedText('rocket'), 5).length, 0);
  assert.strictEqual(await shareProvider.getShareLink(rawShareToken), null);

  // Ephemeral layers:
  assert.strictEqual(ephemeralState.tempUploadBuffers.has(fileId), false);
  assert.strictEqual(ephemeralState.thumbnailCache.has(fileId), false);
  assert.strictEqual(ephemeralState.extractedIntermediates.has(fileId), false);
  assert.strictEqual(ephemeralState.transcriptionCache.has(fileId), false);
  assert.strictEqual(ephemeralState.embeddingCache.has(fileId), false);
  assert.strictEqual(ephemeralState.failedTransferJobs.has(fileId), false);
});
