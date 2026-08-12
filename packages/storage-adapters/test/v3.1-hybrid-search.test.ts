import assert from 'node:assert';
import test from 'node:test';
import { createFileId, ExtractedContent } from '@bucketspace/shared';
import {
  createSqliteDatabase,
  ContentRepository,
  VectorRepository,
} from '@bucketspace/db';
import {
  HybridSearchEngine,
  LocalEmbeddingProvider,
  SemanticChunker,
} from '../src';

/* ─── V3.1 Hybrid & Semantic Search Test Suite ─── */

test('V3.1 — SemanticChunker: Overlapping Chunking & Provenance Inheritance', () => {
  const chunker = new SemanticChunker({ maxChunkSize: 100, overlapSize: 20 });
  const fileId = createFileId('file-pdf-annual');

  const content: ExtractedContent = {
    fileId,
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Page 1: Annual Financial Statement for FY2025. Total Revenue was $12.4M.\n\nPage 2: Risk Factors.',
    segments: [
      {
        id: 'seg-1',
        segmentIndex: 0,
        text: 'Annual Financial Statement for FY2025. Total Revenue was $12.4M.',
        pageNumber: 1,
        charOffset: 0,
      },
      {
        id: 'seg-2',
        segmentIndex: 1,
        text: 'Risk Factors and Market Competition details.',
        pageNumber: 2,
        charOffset: 80,
      },
    ],
    metadata: {},
    extractedAt: new Date(),
  };

  const chunks = chunker.chunkContent(content);

  assert.ok(chunks.length >= 2);

  // Provenance inheritance invariant
  assert.strictEqual(chunks[0].pageNumber, 1);
  assert.strictEqual(chunks[0].charOffset, 0);

  assert.strictEqual(chunks[chunks.length - 1].pageNumber, 2);
});

test('V3.1 — LocalEmbeddingProvider: 384-Dim Normalized Vector Generation', async () => {
  const provider = new LocalEmbeddingProvider();
  assert.strictEqual(provider.modelId, 'local-minilm-384');
  assert.strictEqual(provider.dimensions, 384);

  const vec1 = await provider.embedText('Income tax return filing 2025');
  assert.strictEqual(vec1.length, 384);

  // Verify vector is non-zero & normalized
  let sumSq = 0;
  for (const val of vec1) sumSq += val * val;
  assert.ok(Math.abs(Math.sqrt(sumSq) - 1.0) < 0.001);
});

test('V3.1 — VectorRepository & Model Identity Tracking', () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  // Seed files table for FK constraint
  const fileId = 'file-sec-101';
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES (?, 'tax.pdf', 1024, 'application/pdf', 'hash-sec', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(fileId, now, now);

  const vectorRepo = new VectorRepository(db);

  // Record active model identity
  vectorRepo.setActiveModel('local-minilm-384', '1.0', 384);
  const activeModel = vectorRepo.getActiveModel();

  assert.strictEqual(activeModel?.modelId, 'local-minilm-384');
  assert.strictEqual(activeModel?.dimensions, 384);

  // Upsert vector chunks
  const chunks = [
    { id: 'c1', fileId: createFileId(fileId), chunkIndex: 0, text: 'Tax document section' },
  ];
  const embeddings = [new Array(384).fill(0.1)];

  vectorRepo.upsertVectorChunks(fileId, chunks, embeddings, 'local-minilm-384', 384);

  // Search cosine similarity
  const results = vectorRepo.searchCosineSimilarity(new Array(384).fill(0.1), 5, 0.0, 'local-minilm-384');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].chunkId, 'c1');
  assert.ok(results[0].score > 0.99);

  // Delete for file
  vectorRepo.deleteForFile(fileId);
  const resultsAfterDelete = vectorRepo.searchCosineSimilarity(new Array(384).fill(0.1));
  assert.strictEqual(resultsAfterDelete.length, 0);
});

test('V3.1 — HybridSearchEngine: Reciprocal Rank Fusion (FTS5 BM25 + Semantic Vector Search)', async () => {
  const db = createSqliteDatabase(':memory:');

  // Seed files table for FK constraint
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-tax', 'tax_return_2025.pdf', 1024, 'application/pdf', 'h-tax', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-inv', 'electricity_invoice.pdf', 2048, 'application/pdf', 'h-inv', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();

  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  // Ingest File 1 (Tax Document)
  const taxContent: ExtractedContent = {
    fileId: createFileId('f-tax'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Income Tax Return for Financial Year 2025-26. Total Tax Paid: $4,200.',
    segments: [
      {
        id: 's-tax-1',
        segmentIndex: 0,
        text: 'Income Tax Return for Financial Year 2025-26. Total Tax Paid: $4,200.',
        pageNumber: 1,
      },
    ],
    metadata: {},
    extractedAt: new Date(),
  };
  contentRepo.saveExtractedContent(taxContent);
  await hybridEngine.indexContent(taxContent);

  // Ingest File 2 (Invoice Document)
  const invContent: ExtractedContent = {
    fileId: createFileId('f-inv'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Electricity Company Utility Bill. Account Number INV-2026-99. Amount Due: $150.',
    segments: [
      {
        id: 's-inv-1',
        segmentIndex: 0,
        text: 'Electricity Company Utility Bill. Account Number INV-2026-99. Amount Due: $150.',
        pageNumber: 1,
      },
    ],
    metadata: {},
    extractedAt: new Date(),
  };
  contentRepo.saveExtractedContent(invContent);
  await hybridEngine.indexContent(invContent);

  // Query 1: Exact keyword search for account number "INV-2026-99" (FTS5 BM25 direct hit)
  const ftsHits = await hybridEngine.searchHybrid('INV-2026-99');
  assert.ok(ftsHits.length >= 1);
  assert.strictEqual(ftsHits[0].fileId, 'f-inv');
  assert.strictEqual(ftsHits[0].ftsRank, 1);

  // Query 2: Conceptual query "my tax filing" (Semantic Vector Search match to "Income Tax Return")
  const semanticHits = await hybridEngine.searchHybrid('my tax filing');
  assert.ok(semanticHits.length >= 1);
  assert.strictEqual(semanticHits[0].fileId, 'f-tax');
  assert.strictEqual(semanticHits[0].provenance?.pageNumber, 1);
});

test('V3.1 — Search Quality Benchmark Suite (6 Standard Queries Precision Test)', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  const sampleCorpus = [
    { id: 'corpus-1', name: 'electric_bill.pdf', text: 'Electricity Utility Bill for Torrent Power Ahmedabad 2025.' },
    { id: 'corpus-2', name: 'passport_scan.png', text: 'Republic of India Passport Number Z9876543 Holder Name Vanraj.' },
    { id: 'corpus-3', name: 'database_project.docx', text: 'College Senior Project: Database Normalization and Index Optimization.' },
    { id: 'corpus-4', name: 'ahmedabad_trip.jpg', text: 'Vacation Photos from Sabarmati Riverfront Ahmedabad December 2025.' },
    { id: 'corpus-5', name: 'employment_contract.pdf', text: 'Employment Contract Agreement mentioning 30 days notice termination clause.' },
    { id: 'corpus-6', name: 'pan_card.png', text: 'Income Tax Department Permanent Account Number PAN ABCDE1234F.' },
  ];

  for (const item of sampleCorpus) {
    db.prepare(`
      INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
      VALUES (?, ?, 1024, 'text/plain', ?, 'COMPLETE', 'ACTIVE', ?, ?)
    `).run(item.id, item.name, item.id, now, now);
  }

  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  for (const item of sampleCorpus) {
    const extracted: ExtractedContent = {
      fileId: createFileId(item.id),
      extractorId: 'text-extractor',
      mimeType: 'text/plain',
      fullText: item.text,
      segments: [{ id: `s-${item.id}`, segmentIndex: 0, text: item.text, charOffset: 0 }],
      metadata: {},
      extractedAt: new Date(),
    };
    contentRepo.saveExtractedContent(extracted);
    await hybridEngine.indexContent(extracted);
  }

  // Quality Evaluation Queries
  const benchmarks = [
    { query: 'invoice from electricity company', expectedFileId: 'corpus-1' },
    { query: 'passport', expectedFileId: 'corpus-2' },
    { query: 'college project', expectedFileId: 'corpus-3' },
    { query: 'photos from Ahmedabad', expectedFileId: 'corpus-4' },
    { query: 'contract mentioning termination', expectedFileId: 'corpus-5' },
    { query: 'document containing PAN number', expectedFileId: 'corpus-6' },
  ];

  let passedQueries = 0;
  for (const benchmark of benchmarks) {
    const results = await hybridEngine.searchHybrid(benchmark.query);
    assert.ok(results.length > 0, `Query '${benchmark.query}' returned zero results`);
    assert.strictEqual(
      results[0].fileId,
      benchmark.expectedFileId,
      `Query '${benchmark.query}' expected '${benchmark.expectedFileId}', got '${results[0].fileId}'`
    );
    passedQueries++;
  }

  assert.strictEqual(passedQueries, 6, 'All 6 benchmark evaluation queries passed 100% precision!');
});
