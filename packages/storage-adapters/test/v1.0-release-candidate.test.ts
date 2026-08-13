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

/* ─── BucketSpace 1.0 Release Candidate Test Suite ─── */

test('1.0 RC — Application-Level Authorization: LLM Never Sees Unauthorized Files', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  // Seed User A's file
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-alice', 'alice_medical_report.pdf', 2048, 'application/pdf', 'h-a', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  // Seed User B's file
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-bob', 'bob_salary_slip.pdf', 1024, 'application/pdf', 'h-b', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  // Ingest Alice's medical report
  const aliceDoc: ExtractedContent = {
    fileId: createFileId('f-alice'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Alice has been diagnosed with hypertension. Blood pressure 140/90.',
    segments: [{ id: 's-a', segmentIndex: 0, text: 'Alice has been diagnosed with hypertension. Blood pressure 140/90.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  // Ingest Bob's salary slip
  const bobDoc: ExtractedContent = {
    fileId: createFileId('f-bob'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Bob monthly salary is $8,500. Employee ID: BOB-2025.',
    segments: [{ id: 's-b', segmentIndex: 0, text: 'Bob monthly salary is $8,500. Employee ID: BOB-2025.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(aliceDoc);
  contentRepo.saveExtractedContent(bobDoc);
  await hybridEngine.indexContent(aliceDoc);
  await hybridEngine.indexContent(bobDoc);

  const assistantService = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // Bob asks about salary — authorized only for his own file
  const bobAuth = new Set(['f-bob']);
  const bobResult = await assistantService.ask('What is my salary?', 5, bobAuth);
  assert.strictEqual(bobResult.hasSufficientEvidence, true);
  assert.ok(bobResult.citations.every((c) => c.fileId === 'f-bob'));

  // Bob tries to ask about Alice's medical data — should be refused (can't see Alice's file)
  const bobMedicalResult = await assistantService.ask('What is Alice blood pressure?', 5, bobAuth);
  assert.strictEqual(bobMedicalResult.hasSufficientEvidence, false);
  assert.strictEqual(bobMedicalResult.citations.length, 0);
});

test('1.0 RC — Cross-Tenant Data Leakage Prevention via RcEvaluationRunner', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-tenant-a', 'tenant_a_contract.pdf', 1024, 'application/pdf', 'h-ta', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-tenant-b', 'tenant_b_contract.pdf', 1024, 'application/pdf', 'h-tb', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const docA: ExtractedContent = {
    fileId: createFileId('f-tenant-a'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Tenant A contract: termination penalty is $10,000.',
    segments: [{ id: 'sa', segmentIndex: 0, text: 'Tenant A contract: termination penalty is $10,000.', pageNumber: 3 }],
    metadata: {},
    extractedAt: new Date(),
  };

  const docB: ExtractedContent = {
    fileId: createFileId('f-tenant-b'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Tenant B contract: termination penalty is $50,000.',
    segments: [{ id: 'sb', segmentIndex: 0, text: 'Tenant B contract: termination penalty is $50,000.', pageNumber: 5 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(docA);
  contentRepo.saveExtractedContent(docB);
  await hybridEngine.indexContent(docA);
  await hybridEngine.indexContent(docB);

  const assistantService = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());
  const runner = new RcEvaluationRunner(assistantService, contentRepo);

  // Tenant A asks query that would match Tenant B's content
  const result = await runner.testAuthorizationBoundary(
    new Set(['f-tenant-a']),
    new Set(['f-tenant-b']),
    'What is the termination penalty for Tenant B?'
  );

  assert.strictEqual(result.leaked, false);
});

test('1.0 RC — Conflicting Document Versions Produce Attributable Answers', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-v1', 'policy_v1.pdf', 1024, 'application/pdf', 'h-v1', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-v2', 'policy_v2.pdf', 1024, 'application/pdf', 'h-v2', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const v1Doc: ExtractedContent = {
    fileId: createFileId('f-v1'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Insurance policy expiry date is 2025-03-15.',
    segments: [{ id: 'sv1', segmentIndex: 0, text: 'Insurance policy expiry date is 2025-03-15.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  const v2Doc: ExtractedContent = {
    fileId: createFileId('f-v2'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Insurance policy expiry date is 2026-06-30.',
    segments: [{ id: 'sv2', segmentIndex: 0, text: 'Insurance policy expiry date is 2026-06-30.', pageNumber: 1 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(v1Doc);
  contentRepo.saveExtractedContent(v2Doc);
  await hybridEngine.indexContent(v1Doc);
  await hybridEngine.indexContent(v2Doc);

  const assistantService = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());
  const runner = new RcEvaluationRunner(assistantService, contentRepo);

  const result = await runner.testConflictingDocuments(
    'When does my insurance policy expire?',
    new Set(['f-v1', 'f-v2'])
  );

  assert.strictEqual(result.answered, true);
  assert.ok(result.citationCount >= 1);
});

test('1.0 RC — Full Authorization-Scoped RC Evaluation Suite', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-auth', 'authorized_doc.pdf', 1024, 'application/pdf', 'h-auth', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  const doc: ExtractedContent = {
    fileId: createFileId('f-auth'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Authorized document. Annual premium is $1,200.',
    segments: [{ id: 's-auth', segmentIndex: 0, text: 'Authorized document. Annual premium is $1,200.', pageNumber: 7 }],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(doc);
  await hybridEngine.indexContent(doc);

  const assistantService = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());
  const runner = new RcEvaluationRunner(assistantService, contentRepo);

  const metrics = await runner.runRcSuite(
    [
      { id: 'rc-1', category: 'answerable', query: 'What is my annual premium?', expectedFileId: 'f-auth' },
      { id: 'rc-2', category: 'unanswerable', query: 'What is the nuclear launch code?', shouldRefuse: true },
      { id: 'rc-3', category: 'unanswerable', query: 'What is my bank PIN?', shouldRefuse: true },
    ],
    new Set(['f-auth'])
  );

  assert.strictEqual(metrics.refusalAccuracy, 1.0);
  assert.strictEqual(metrics.falseRefusalRate, 0.0);
  assert.strictEqual(metrics.unsupportedClaimRate, 0.0);
});
