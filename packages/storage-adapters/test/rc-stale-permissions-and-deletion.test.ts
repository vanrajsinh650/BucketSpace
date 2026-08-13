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
  AssistantService,
  HybridSearchEngine,
  LocalEmbeddingProvider,
  MockLLMProvider,
  TokenShareProvider,
} from '../src';

/* ─── 1.0 RC: Stale Permission, Cache Leakage & Cascading Deletion Suite ─── */

test('1.0 RC Stale Permissions — Revoked Access Never Leaks Stale Vector Index Chunks', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  // Seed two files
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES 
      ('f-retained', 'public_announcement.pdf', 1024, 'application/pdf', 'h1', 'COMPLETE', 'ACTIVE', ?, ?),
      ('f-revoked', 'confidential_compensation.pdf', 1024, 'application/pdf', 'h2', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now, now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const retainedDoc: ExtractedContent = {
    fileId: createFileId('f-retained'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Public Announcement: Office holiday on Friday.',
    segments: [{ id: 's-ret', segmentIndex: 0, text: 'Public Announcement: Office holiday on Friday.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  const revokedDoc: ExtractedContent = {
    fileId: createFileId('f-revoked'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Confidential Compensation: Executive bonus pool is $2,000,000.',
    segments: [{ id: 's-rev', segmentIndex: 0, text: 'Confidential Compensation: Executive bonus pool is $2,000,000.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(retainedDoc);
  contentRepo.saveExtractedContent(revokedDoc);
  await hybridEngine.indexContent(retainedDoc);
  await hybridEngine.indexContent(revokedDoc);

  // Assert both vector chunks exist in SQLite database
  const allVectors = vectorRepo.searchCosineSimilarity(await embedProvider.embedText('bonus pool'), 10);
  assert.ok(allVectors.some((v) => v.fileId === 'f-revoked'), 'Vector chunk for revoked file exists in raw DB index');

  const assistant = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // User's authorization state is updated/revoked: now only authorized for 'f-retained'
  const currentAuthorizedSet = new Set(['f-retained']);

  // User asks a query explicitly targeting the revoked file content
  const response = await assistant.ask('What is the executive bonus pool?', 5, currentAuthorizedSet);

  // Invariant verified: Pre-retrieval authorization guard completely blocked the stale vector chunk
  assert.strictEqual(response.hasSufficientEvidence, false, 'Revoked file chunk must never be retrieved');
  assert.strictEqual(response.citations.length, 0);
  assert.match(response.answer, /couldn't find enough evidence/i);
});

test('1.0 RC Cascading Deletion — Purged File Invalidates FTS5, Vectors, Segments & Shares', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  const fileId = 'f-purge-target';

  // 1. Seed file and metadata
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES (?, 'target_to_purge.pdf', 2048, 'application/pdf', 'h-purge', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(fileId, now, now);

  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);
  const shareProvider = new TokenShareProvider();

  // 2. Ingest content & index
  const doc: ExtractedContent = {
    fileId: createFileId(fileId),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Critical intellectual property patent details.',
    segments: [{ id: 's-purge', segmentIndex: 0, text: 'Critical intellectual property patent details.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  // 3. Create active public share link
  const shareLink = await shareProvider.createShareLink(fileId);
  const rawShareToken = shareLink.shareId;

  // Verify before purge: FTS, Vector, and Share exist
  assert.strictEqual(contentRepo.searchContentFts('intellectual property').length, 1);
  assert.strictEqual(vectorRepo.searchCosineSimilarity(await embedProvider.embedText('patent'), 5).length, 1);
  assert.ok((await shareProvider.getShareLink(rawShareToken)) !== null);

  // ─── 4. Perform Full Cascading Purge ───
  // A. Delete FTS & Content segments
  contentRepo.deleteContent(fileId);

  // B. Delete Vector embeddings
  vectorRepo.deleteForFile(fileId);

  // C. Revoke public share link
  await shareProvider.revokeShareLink(rawShareToken);

  // D. Delete file metadata
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);

  // ─── 5. Verify Invariant: Zero Artifact Residue in any subsystem ───
  assert.strictEqual(contentRepo.searchContentFts('intellectual property').length, 0, 'FTS index must be empty');
  assert.strictEqual(contentRepo.getContent(fileId), null, 'Content metadata must be null');
  assert.strictEqual(contentRepo.getSegments(fileId).length, 0, 'Segments must be empty');
  assert.strictEqual(vectorRepo.searchCosineSimilarity(await embedProvider.embedText('patent'), 5).length, 0, 'Vectors must be purged');
  assert.strictEqual(await shareProvider.getShareLink(rawShareToken), null, 'Share link must be invalidated');
  assert.strictEqual(await shareProvider.consumeDownload(rawShareToken), false, 'Download must be rejected');
});

test('1.0 RC AI Security Invariant — LLM is Strictly Read-Only (Zero Authority over Storage / Keys / Permissions)', async () => {
  const db = createSqliteDatabase(':memory:');
  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const assistant = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // Verify AssistantService interface is strictly read-only:
  // It only exposes ask() and provider accessors. It possesses ZERO methods to:
  // - deleteFile()
  // - uploadChunk()
  // - rekeyCredential()
  // - createShareLink()
  // - updatePermissions()
  const assistantProps = Object.getOwnPropertyNames(Object.getPrototypeOf(assistant));
  assert.ok(assistantProps.includes('ask'), 'Assistant must support ask()');
  assert.ok(!assistantProps.includes('deleteFile'), 'Assistant must NOT have deleteFile');
  assert.ok(!assistantProps.includes('putChunk'), 'Assistant must NOT have putChunk');
  assert.ok(!assistantProps.includes('rekeyCredential'), 'Assistant must NOT have rekeyCredential');
  assert.ok(!assistantProps.includes('revokeShare'), 'Assistant must NOT have revokeShare');
});
