import assert from 'node:assert';
import test from 'node:test';
import { createFileId, sanitizeFilename } from '@bucketspace/shared';
import {
  ContentPipeline,
  PdfExtractor,
  PlainTextExtractor,
} from '../src';
import {
  createSqliteDatabase,
  ContentRepository,
} from '@bucketspace/db';

/* ─── 1.0 RC: File-Processing Security & Extraction Hardening Suite ─── */

test('1.0 RC Ingestion Security — Filename Sanitization rejects null-bytes and path traversal', () => {
  // Test null-byte injection in filenames
  const nullByteName = 'confidential_report\0.pdf';
  const clean1 = sanitizeFilename(nullByteName);
  assert.ok(!clean1.includes('\0'), 'Null bytes must be stripped');
  assert.strictEqual(clean1, 'confidential_report.pdf');

  // Test directory traversal attempts
  const traversal1 = '../../../../etc/shadow';
  const clean2 = sanitizeFilename(traversal1);
  assert.ok(!clean2.includes('/'), 'Forward slashes must be stripped');
  assert.ok(!clean2.includes('..'), 'Relative traversal dots must be neutralized');

  const windowsTraversal = '..\\..\\windows\\system32\\cmd.exe';
  const clean3 = sanitizeFilename(windowsTraversal);
  assert.ok(!clean3.includes('\\'), 'Backslashes must be stripped');

  // Test Windows reserved device names
  const reservedName = 'CON.txt';
  const clean4 = sanitizeFilename(reservedName);
  assert.notStrictEqual(clean4.toUpperCase(), 'CON.TXT', 'Reserved DOS device names must be prefixed/safe');
});

test('1.0 RC Ingestion Security — Malformed & Truncated PDF stream does not crash extractor', async () => {
  const extractor = new PdfExtractor();
  const fileId = createFileId('f-malformed-pdf');

  // Corrupted / truncated PDF binary junk (no valid PDF header or objects)
  const corruptedBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, // %PDF-1.7
    0x00, 0xff, 0xfe, 0x12, 0x34, 0x56, 0x78, 0x9a, // corrupt noise
    0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46               // %%EOF early
  ]);

  async function* corruptedStream() {
    yield corruptedBytes;
  }

  const result = await extractor.extract(fileId, corruptedStream(), 'application/pdf', 'corrupted.pdf');

  assert.ok(result, 'Extractor must return ExtractedContent object');
  assert.strictEqual(result.fileId, fileId);
  assert.ok(result.segments.length > 0);
  assert.ok(typeof result.fullText === 'string');
});

test('1.0 RC Ingestion Security — PlainTextExtractor handles null bytes and control characters gracefully', async () => {
  const extractor = new PlainTextExtractor();
  const fileId = createFileId('f-dirty-txt');

  const dirtyText = 'Hello \0World!\x01\x02\x03\x04 Line 2 with secret data.\r\n\r\nParagraph 2.';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(dirtyText);

  async function* dirtyStream() {
    yield bytes;
  }

  const result = await extractor.extract(fileId, dirtyStream(), 'text/plain', 'dirty.txt');

  assert.strictEqual(result.fileId, fileId);
  assert.ok(!result.fullText.includes('\0'), 'Null bytes must be stripped from extracted text');
  assert.ok(result.fullText.includes('Hello World!'));
  assert.ok(result.segments.length >= 1);
});

test('1.0 RC Ingestion Security — Stream size limits enforce boundary on giant streams', async () => {
  const extractor = new PlainTextExtractor();
  const fileId = createFileId('f-giant-stream');

  // Stream 100 chunks of 1KB with a 50KB limit parameter
  const chunk1kb = new Uint8Array(1024).fill(0x61); // 'a'
  async function* giantStream() {
    for (let i = 0; i < 100; i++) {
      yield chunk1kb;
    }
  }

  // Set maxBytes = 10KB (10 * 1024)
  const result = await extractor.extract(
    fileId,
    giantStream(),
    'text/plain',
    'giant.txt',
    10 * 1024
  );

  assert.ok(result.fullText.length <= 11 * 1024, 'Stream extraction must stop once maxBytes limit is reached');
});

test('1.0 RC Ingestion Security — ContentPipeline end-to-end handles unhandled mime types gracefully', async () => {
  const db = createSqliteDatabase(':memory:');
  const contentRepo = new ContentRepository(db);
  const pipeline = new ContentPipeline(contentRepo);

  const fileId = createFileId('f-unknown-mime');
  async function* dummyStream() {
    yield new Uint8Array([0x01, 0x02, 0x03]);
  }

  // Attempt to ingest an unhandled executable file
  const result = await pipeline.ingestContent(fileId, dummyStream(), 'application/x-executable', 'malware.exe');
  assert.strictEqual(result, null, 'Unhandled MIME type should safely return null');
});
