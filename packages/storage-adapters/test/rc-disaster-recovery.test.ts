import assert from 'node:assert';
import test from 'node:test';
import { createFileId, ExtractedContent } from '@bucketspace/shared';
import {
  createSqliteDatabase,
  ContentRepository,
  SqliteMetadataRepository,
  VectorRepository,
} from '@bucketspace/db';
import {
  BackupManager,
  HybridSearchEngine,
  InMemoryStorageProvider,
  LocalEmbeddingProvider,
  ProviderRegistry,
  TransferOrchestrator,
} from '../src';

/* ─── 1.0 RC: Disaster Recovery, Backup & Restore Verification Suite ─── */

test('1.0 RC Disaster Recovery — Full Snapshot Export -> Fresh Machine Restore -> Provider Reconnect -> Byte Verification', async () => {
  // ─── Machine A: Original Working Installation ───
  const dbA = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  const fileId = 'file-disaster-recovery-doc';
  const wholeFileHash = 'hash-verified-byte-identical-2026';
  const fileBytes = new TextEncoder().encode('Confidential Disaster Recovery Operating Plan 2026.');

  dbA.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES (?, 'dr_plan_2026.pdf', ?, 'application/pdf', ?, 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(fileId, fileBytes.byteLength, wholeFileHash, now, now);

  const providerA = new InMemoryStorageProvider('in-memory-primary');
  const chunkRef = await providerA.putChunk({
    chunkId: 'c-dr-1' as any,
    size: fileBytes.byteLength,
    hash: wholeFileHash,
    data: (async function* () { yield fileBytes; })(),
  });

  dbA.prepare(`
    INSERT INTO chunks (id, file_id, chunk_index, size, hash, provider_id, provider_ref_json)
    VALUES ('c-dr-1', ?, 0, ?, ?, 'in-memory-primary', ?)
  `).run(fileId, fileBytes.byteLength, wholeFileHash, JSON.stringify(chunkRef));

  dbA.prepare(`
    INSERT INTO chunk_locations (id, chunk_id, file_id, provider_id, provider_ref_json, role, state, verified_at, created_at, updated_at)
    VALUES ('loc-dr-1', 'c-dr-1', ?, 'in-memory-primary', ?, 'PRIMARY', 'VERIFIED', ?, ?, ?)
  `).run(fileId, JSON.stringify(chunkRef), now, now, now);

  const contentRepoA = new ContentRepository(dbA);
  const vectorRepoA = new VectorRepository(dbA);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngineA = new HybridSearchEngine(contentRepoA, vectorRepoA, embedProvider);

  const doc: ExtractedContent = {
    fileId: createFileId(fileId),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Confidential Disaster Recovery Operating Plan 2026.',
    segments: [{ id: 's-dr', segmentIndex: 0, text: 'Confidential Disaster Recovery Operating Plan 2026.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepoA.saveExtractedContent(doc);
  await hybridEngineA.indexContent(doc);

  // 1. Export snapshot from Machine A
  const backupManagerA = new BackupManager(dbA);
  const snapshot = backupManagerA.exportSnapshot();

  assert.strictEqual(snapshot.version, '1.0.0-rc');
  assert.strictEqual(snapshot.files.length, 1);
  assert.strictEqual(snapshot.chunks.length, 1);
  assert.strictEqual(snapshot.contentMetadata.length, 1);
  assert.strictEqual(snapshot.vectorChunks.length, 1);

  // ─── Machine B: Fresh Machine (Empty Database) ───
  const dbB = createSqliteDatabase(':memory:');
  const metaRepoB = new SqliteMetadataRepository(dbB);
  const contentRepoB = new ContentRepository(dbB);
  const vectorRepoB = new VectorRepository(dbB);

  // 2. Restore snapshot into Machine B
  BackupManager.restoreSnapshot(snapshot, dbB);

  // 3. Reconnect storage provider (provider retains the actual chunks in cloud/disk)
  ProviderRegistry.register(providerA); // Provider reconnect

  // 4. Verify disaster recovery
  const audit = await BackupManager.verifyRestoredInstallation(metaRepoB);

  assert.strictEqual(audit.totalFiles, 1);
  assert.strictEqual(audit.verifiedFiles, 1);
  assert.strictEqual(audit.missingChunks, 0);

  // 5. Test search and vector retrieval on restored Machine B
  const hybridEngineB = new HybridSearchEngine(contentRepoB, vectorRepoB, embedProvider);
  const searchHits = await hybridEngineB.searchHybrid('disaster recovery plan', 5);

  assert.strictEqual(searchHits.length, 1);
  assert.strictEqual(searchHits[0].fileId, fileId);

  // 6. Download file from restored Machine B and verify byte equality
  const stream = await providerA.getChunk(chunkRef);
  const downloadedBuffers: Uint8Array[] = [];
  for await (const chunk of stream) {
    downloadedBuffers.push(chunk);
  }

  const downloadedBytes = Buffer.concat(downloadedBuffers);
  assert.deepStrictEqual(downloadedBytes, Buffer.from(fileBytes), 'Downloaded bytes must be 100% identical on restored system');
});
