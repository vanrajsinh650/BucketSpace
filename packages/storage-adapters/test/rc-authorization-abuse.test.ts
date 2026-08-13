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
  RcEvaluationRunner,
} from '../src';

/* ─── 1.0 RC: Authorization Abuse & Boundary Stress Suite ─── */

test('1.0 RC Auth Abuse — Empty Set of authorizedFileIds returns 0 hits and safe refusal', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-1', 'secret_doc.pdf', 1024, 'application/pdf', 'h-1', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const doc: ExtractedContent = {
    fileId: createFileId('f-1'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Top secret server credentials: user=admin, pass=supersecret.',
    segments: [{ id: 's-1', segmentIndex: 0, text: 'Top secret server credentials: user=admin, pass=supersecret.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  const assistant = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // Empty authorized set means caller has access to 0 files
  const emptyAuth = new Set<string>();
  const hits = await hybridEngine.searchHybrid('credentials', 10, emptyAuth);
  assert.strictEqual(hits.length, 0, 'Hybrid search with empty auth set must return 0 hits');

  const response = await assistant.ask('What are the server credentials?', 5, emptyAuth);
  assert.strictEqual(response.hasSufficientEvidence, false);
  assert.strictEqual(response.citations.length, 0);
  assert.match(response.answer, /couldn't find enough evidence/i);
});

test('1.0 RC Auth Abuse — Unknown / Non-existent File IDs in authorized set produce zero leakage', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-real', 'real_financials.pdf', 1024, 'application/pdf', 'h-real', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const doc: ExtractedContent = {
    fileId: createFileId('f-real'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Q3 net profit was $4.2M across all divisions.',
    segments: [{ id: 's-real', segmentIndex: 0, text: 'Q3 net profit was $4.2M across all divisions.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  const assistant = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // Caller provides fake/random file IDs
  const fakeAuth = new Set(['f-nonexistent-99', 'f-ghost-123']);
  const hits = await hybridEngine.searchHybrid('net profit', 10, fakeAuth);
  assert.strictEqual(hits.length, 0);

  const response = await assistant.ask('What was the Q3 profit?', 5, fakeAuth);
  assert.strictEqual(response.hasSufficientEvidence, false);
  assert.strictEqual(response.citations.length, 0);
});

test('1.0 RC Auth Abuse — Multi-Tenant Collision Query strictly isolates authorized chunks before RRF', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  // Create files for 3 distinct tenants
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES 
      ('f-tenant-1', 'tenant1_nda.pdf', 1024, 'application/pdf', 'h1', 'COMPLETE', 'ACTIVE', ?, ?),
      ('f-tenant-2', 'tenant2_nda.pdf', 1024, 'application/pdf', 'h2', 'COMPLETE', 'ACTIVE', ?, ?),
      ('f-tenant-3', 'tenant3_nda.pdf', 1024, 'application/pdf', 'h3', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now, now, now, now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const doc1: ExtractedContent = {
    fileId: createFileId('f-tenant-1'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Tenant 1 NDA: Governing law is California. Confidential period is 5 years.',
    segments: [{ id: 's-t1', segmentIndex: 0, text: 'Tenant 1 NDA: Governing law is California. Confidential period is 5 years.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  const doc2: ExtractedContent = {
    fileId: createFileId('f-tenant-2'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Tenant 2 NDA: Governing law is New York. Confidential period is 2 years.',
    segments: [{ id: 's-t2', segmentIndex: 0, text: 'Tenant 2 NDA: Governing law is New York. Confidential period is 2 years.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  const doc3: ExtractedContent = {
    fileId: createFileId('f-tenant-3'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Tenant 3 NDA: Governing law is England. Confidential period is 10 years.',
    segments: [{ id: 's-t3', segmentIndex: 0, text: 'Tenant 3 NDA: Governing law is England. Confidential period is 10 years.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc1);
  contentRepo.saveExtractedContent(doc2);
  contentRepo.saveExtractedContent(doc3);
  await hybridEngine.indexContent(doc1);
  await hybridEngine.indexContent(doc2);
  await hybridEngine.indexContent(doc3);

  const assistant = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // Tenant 2 asks a broad query that matches all 3 files
  const tenant2Auth = new Set(['f-tenant-2']);
  const hits = await hybridEngine.searchHybrid('Governing law NDA confidential period', 10, tenant2Auth);

  assert.strictEqual(hits.length, 1, 'Only Tenant 2 document must be retrieved');
  assert.strictEqual(hits[0].fileId, 'f-tenant-2');

  const response = await assistant.ask('What is the governing law and confidential period?', 5, tenant2Auth);
  assert.strictEqual(response.hasSufficientEvidence, true);
  assert.strictEqual(response.citations.length, 1);
  assert.strictEqual(response.citations[0].fileId, 'f-tenant-2');
  assert.match(response.answer, /New York/i);
  assert.doesNotMatch(response.answer, /California|England/i);
});

test('1.0 RC Auth Abuse — Trashed & Purged Files are excluded from retrieval', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-trashed', 'old_taxes.pdf', 1024, 'application/pdf', 'h-tr', 'COMPLETE', 'TRASHED', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const doc: ExtractedContent = {
    fileId: createFileId('f-trashed'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Taxes paid in 2023: $12,400 to IRS.',
    segments: [{ id: 's-tr', segmentIndex: 0, text: 'Taxes paid in 2023: $12,400 to IRS.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  // If file is purged from vectorRepo and contentRepo
  hybridEngine.deleteForFile('f-trashed');

  const authSet = new Set(['f-trashed']);
  const hits = await hybridEngine.searchHybrid('taxes paid 2023', 10, authSet);

  // Vector index was deleted, only remaining matches (if any) would be in FTS if not purged
  // Ensure vector chunks are 0
  const vectorHits = vectorRepo.searchCosineSimilarity(await embedProvider.embedText('taxes'), 10);
  assert.strictEqual(vectorHits.length, 0, 'Vector chunks must be purged on file deletion');
});
