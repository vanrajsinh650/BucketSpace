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
  OllamaLLMProvider,
  RagContextBuilder,
} from '../src';

/* ─── V3.2 AI Assistant & Grounding Test Suite ─── */

test('V3.2 — RagContextBuilder: Context Formatting & Exact Provenance Citations', () => {
  const fileNamesMap = new Map<string, string>([
    ['f-ins', 'insurance_policy_2025.pdf'],
  ]);

  const searchHits = [
    {
      fileId: createFileId('f-ins'),
      rrfScore: 0.032,
      snippet: 'Water damage deductible is $500.',
      provenance: {
        id: 'p1',
        segmentIndex: 0,
        text: 'Water damage deductible is $500.',
        pageNumber: 14,
      },
    },
  ];

  const result = RagContextBuilder.buildContext(searchHits, fileNamesMap);

  assert.strictEqual(result.hasSufficientEvidence, true);
  assert.strictEqual(result.citations.length, 1);
  assert.strictEqual(result.citations[0].fileName, 'insurance_policy_2025.pdf');
  assert.strictEqual(result.citations[0].pageNumber, 14);
  assert.ok(result.formattedContext.includes('[Source 1: insurance_policy_2025.pdf, Page 14]'));
});

test('V3.2 — Strict "I Don\'t Know" Fallback Guardrail (Insufficient Evidence)', async () => {
  const llmProvider = new MockLLMProvider();
  const fileNamesMap = new Map<string, string>();

  // Empty or below-threshold search hits
  const emptyHits: import('@bucketspace/shared').HybridSearchResult[] = [];

  const response = await llmProvider.generateResponse('What is my nuclear launch code?', emptyHits, fileNamesMap);

  assert.strictEqual(response.hasSufficientEvidence, false);
  assert.strictEqual(response.citations.length, 0);
  assert.strictEqual(
    response.answer,
    "I couldn't find enough evidence in your stored files to answer this question."
  );
});

test('V3.2 — MockLLMProvider: Grounded Answer & Source Citations', async () => {
  const llmProvider = new MockLLMProvider();
  const fileNamesMap = new Map<string, string>([['f-tax', 'tax_return_2025.pdf']]);

  const searchHits = [
    {
      fileId: createFileId('f-tax'),
      rrfScore: 0.028,
      snippet: 'Total income tax paid for FY2025 was $4,200.',
      provenance: {
        id: 'p1',
        segmentIndex: 0,
        text: 'Total income tax paid for FY2025 was $4,200.',
        pageNumber: 1,
      },
    },
  ];

  const response = await llmProvider.generateResponse('How much tax did I pay in 2025?', searchHits, fileNamesMap);

  assert.strictEqual(response.hasSufficientEvidence, true);
  assert.strictEqual(response.citations.length, 1);
  assert.ok(response.answer.includes('[Source 1: tax_return_2025.pdf]'));
  assert.ok(response.answer.includes('$4,200'));
});

test('V3.2 — OllamaLLMProvider: System Prompt Grounding Instructions', async () => {
  const ollamaProvider = new OllamaLLMProvider({ modelName: 'llama3' });
  assert.strictEqual(ollamaProvider.providerId, 'ollama-local');
  assert.strictEqual(ollamaProvider.modelName, 'llama3');

  const fileNamesMap = new Map<string, string>();
  const emptyHits: import('@bucketspace/shared').HybridSearchResult[] = [];

  const response = await ollamaProvider.generateResponse('Where is my passport?', emptyHits, fileNamesMap);

  // Fallback guardrail check when no context is provided
  assert.strictEqual(response.hasSufficientEvidence, false);
  assert.strictEqual(
    response.answer,
    "I couldn't find enough evidence in your stored files to answer this question."
  );
});

test('V3.2 — AssistantService: End-to-End RAG Workflow Execution', async () => {
  const db = createSqliteDatabase(':memory:');
  const now = new Date().toISOString();

  // Seed files table for metadata resolution
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-ins', 'health_insurance.pdf', 2048, 'application/pdf', 'hash-ins', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const metaRepo = new SqliteMetadataRepository(db);
  const contentRepo = new ContentRepository(db);
  const vectorRepo = new VectorRepository(db);
  const embedProvider = new LocalEmbeddingProvider();
  const hybridEngine = new HybridSearchEngine(contentRepo, vectorRepo, embedProvider);

  // Ingest document
  const extracted: ExtractedContent = {
    fileId: createFileId('f-ins'),
    extractorId: 'pdf-extractor',
    mimeType: 'application/pdf',
    fullText: 'Health Insurance Policy #9988. Maximum annual coverage is $50,000.',
    segments: [
      {
        id: 's-1',
        segmentIndex: 0,
        text: 'Health Insurance Policy #9988. Maximum annual coverage is $50,000.',
        pageNumber: 3,
      },
    ],
    metadata: {},
    extractedAt: new Date(),
  };

  contentRepo.saveExtractedContent(extracted);
  await hybridEngine.indexContent(extracted);

  const assistantService = new AssistantService(hybridEngine, metaRepo, new MockLLMProvider());

  // 1. Valid Grounded Query
  const res1 = await assistantService.ask('What is my maximum coverage?');
  assert.strictEqual(res1.hasSufficientEvidence, true);
  assert.strictEqual(res1.citations.length, 1);
  assert.strictEqual(res1.citations[0].fileName, 'health_insurance.pdf');
  assert.strictEqual(res1.citations[0].pageNumber, 3);

  // 2. Unrelated Query -> Fallback Guardrail Triggered
  const res2 = await assistantService.ask('What is the secret recipe for Coca-Cola?');
  assert.strictEqual(res2.hasSufficientEvidence, false);
  assert.strictEqual(
    res2.answer,
    "I couldn't find enough evidence in your stored files to answer this question."
  );
});
