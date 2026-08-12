import assert from 'node:assert';
import test from 'node:test';
import {
  createFileId,
  IOCRProvider,
  ITranscriptionProvider,
} from '@bucketspace/shared';
import {
  createSqliteDatabase,
  ContentRepository,
} from '@bucketspace/db';
import {
  AudioTranscriptionAdapter,
  ContentPipeline,
  OcrExtractorAdapter,
  PdfExtractor,
  PlainTextExtractor,
} from '../src';

/* ─── Helpers ─── */

async function* stringToStream(text: string): AsyncIterable<Uint8Array> {
  yield new TextEncoder().encode(text);
}

/* ─── Mock OCR & Transcription Engines ─── */

class MockOcrEngine implements IOCRProvider {
  public readonly providerId = 'mock-tesseract';

  public async recognizeText(): Promise<{
    text: string;
    confidence: number;
    segments: import('@bucketspace/shared').SegmentProvenance[];
  }> {
    return {
      text: 'INVOICE #9988\nElectricity Bill: $142.50\nDue Date: 2026-09-15',
      confidence: 0.96,
      segments: [
        {
          id: 'seg-ocr-1',
          segmentIndex: 0,
          text: 'INVOICE #9988',
          confidence: 0.98,
          boundingBox: { x: 10, y: 10, width: 200, height: 30 },
        },
        {
          id: 'seg-ocr-2',
          segmentIndex: 1,
          text: 'Electricity Bill: $142.50',
          confidence: 0.95,
          boundingBox: { x: 10, y: 50, width: 300, height: 30 },
        },
      ],
    };
  }
}

class MockWhisperEngine implements ITranscriptionProvider {
  public readonly providerId = 'mock-whisper';

  public async transcribe(): Promise<{
    text: string;
    language?: string;
    segments: import('@bucketspace/shared').SegmentProvenance[];
  }> {
    return {
      text: 'Welcome to the computer science lecture on database normalization and index optimization.',
      language: 'en',
      segments: [
        {
          id: 'seg-audio-1',
          segmentIndex: 0,
          text: 'Welcome to the computer science lecture',
          startTimeSeconds: 0.0,
          endTimeSeconds: 3.5,
        },
        {
          id: 'seg-audio-2',
          segmentIndex: 1,
          text: 'on database normalization and index optimization.',
          startTimeSeconds: 3.5,
          endTimeSeconds: 8.2,
        },
      ],
    };
  }
}

/* ─── V3.0 Content Ingestion Test Suite ─── */

test('V3.0 — PlainTextExtractor: Ingestion & Paragraph Character Offset Provenance', async () => {
  const extractor = new PlainTextExtractor();
  const fileId = createFileId('file-text-doc');

  const text = `# Quarterly Financial Report\n\nRevenue for Q1 was $1.2M driven by cloud storage expansion.\n\nExpenses remained under budget.`;
  const result = await extractor.extract(fileId, stringToStream(text), 'text/markdown', 'report.md');

  assert.strictEqual(result.extractorId, 'text-extractor');
  assert.strictEqual(result.segments.length, 3);

  // Provenance check
  assert.strictEqual(result.segments[0].text, '# Quarterly Financial Report');
  assert.strictEqual(result.segments[0].charOffset, 0);
  assert.ok(result.segments[1].text.includes('Revenue for Q1'));
});

test('V3.0 — PdfExtractor: Page-Level Segment Provenance (pageNumber: 1, pageNumber: 2)', async () => {
  const extractor = new PdfExtractor();
  const fileId = createFileId('file-pdf-doc');

  // Simulated PDF stream with BT/ET text markers
  const mockPdfData = `%PDF-1.4
1 0 obj << /Type /Page >> endobj
BT (Page 1: Insurance Policy Agreement) Tj ET
2 0 obj << /Type /Page >> endobj
BT (Page 2: Deductible details and claims procedure) Tj ET`;

  const result = await extractor.extract(fileId, stringToStream(mockPdfData), 'application/pdf', 'insurance.pdf');

  assert.strictEqual(result.extractorId, 'pdf-extractor');
  assert.strictEqual(result.segments.length, 2);

  // Page-level provenance invariant
  assert.strictEqual(result.segments[0].pageNumber, 1);
  assert.ok(result.segments[0].text.includes('Insurance Policy'));

  assert.strictEqual(result.segments[1].pageNumber, 2);
  assert.ok(result.segments[1].text.includes('Deductible details'));
});

test('V3.0 — OcrExtractorAdapter: Image Text Recognition & Bounding Box Confidence Provenance', async () => {
  const ocrAdapter = new OcrExtractorAdapter(new MockOcrEngine());
  const fileId = createFileId('file-ocr-receipt');

  const result = await ocrAdapter.extract(fileId, stringToStream('fake-png-bytes'), 'image/png', 'receipt.png');

  assert.ok(result.extractorId.includes('mock-tesseract'));
  assert.ok(result.fullText.includes('Electricity Bill'));
  assert.strictEqual(result.segments.length, 2);

  // OCR confidence & bbox provenance check
  assert.strictEqual(result.segments[1].confidence, 0.95);
  assert.strictEqual(result.segments[1].boundingBox?.x, 10);
});

test('V3.0 — AudioTranscriptionAdapter: Timestamp Segment Provenance (startTime, endTime)', async () => {
  const audioAdapter = new AudioTranscriptionAdapter(new MockWhisperEngine());
  const fileId = createFileId('file-audio-lecture');

  const result = await audioAdapter.extract(fileId, stringToStream('fake-mp3-bytes'), 'audio/mpeg', 'lecture.mp3');

  assert.ok(result.extractorId.includes('mock-whisper'));
  assert.strictEqual(result.language, 'en');

  // Audio timestamp provenance check
  assert.strictEqual(result.segments[0].startTimeSeconds, 0.0);
  assert.strictEqual(result.segments[0].endTimeSeconds, 3.5);
  assert.strictEqual(result.segments[1].startTimeSeconds, 3.5);
});

test('V3.0 — ContentPipeline & Zero-Cost SQLite FTS5 Search End-to-End', async () => {
  const db = createSqliteDatabase(':memory:');
  const contentRepo = new ContentRepository(db);

  // Seed files table for FK constraint
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-1', 'utility_bill.png', 1024, 'image/png', 'h1', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES ('f-2', 'cs_lecture.mp3', 2048, 'audio/mpeg', 'h2', 'COMPLETE', 'ACTIVE', ?, ?)
  `).run(now, now);

  const pipeline = new ContentPipeline(contentRepo);
  pipeline.registerExtractor(new OcrExtractorAdapter(new MockOcrEngine()));
  pipeline.registerExtractor(new AudioTranscriptionAdapter(new MockWhisperEngine()));

  // Ingest image OCR
  await pipeline.ingestContent(
    createFileId('f-1'),
    stringToStream('png-bytes'),
    'image/png',
    'utility_bill.png'
  );

  // Ingest audio transcript
  await pipeline.ingestContent(
    createFileId('f-2'),
    stringToStream('mp3-bytes'),
    'audio/mpeg',
    'cs_lecture.mp3'
  );

  // 1. Zero-Cost SQLite FTS5 Search for "Electricity"
  const search1 = contentRepo.searchContentFts('Electricity');
  assert.strictEqual(search1.length, 1);
  assert.strictEqual(search1[0].fileId, 'f-1');
  assert.ok(search1[0].snippet.includes('Electricity'));

  // Provenance check on search results
  assert.strictEqual(search1[0].matchedSegments[0].confidence, 0.95);

  // 2. Zero-Cost SQLite FTS5 Search for "normalization"
  const search2 = contentRepo.searchContentFts('normalization');
  assert.strictEqual(search2.length, 1);
  assert.strictEqual(search2[0].fileId, 'f-2');

  // Provenance check: exact audio timestamps returned
  assert.strictEqual(search2[0].matchedSegments[0].startTimeSeconds, 3.5);
});
