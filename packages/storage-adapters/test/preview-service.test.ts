import assert from 'node:assert';
import test from 'node:test';
import { createFileId, FileMetadata } from '@bucketspace/shared';
import { PreviewService } from '../src';

/* ─── 1.0 Release Candidate: Universal File Preview Engine ─── */

test('1.0 RC Preview — MIME & Extension Classification Matrix', () => {
  // Images
  assert.strictEqual(PreviewService.classifyFormat('image/png', 'photo.png'), 'IMAGE');
  assert.strictEqual(PreviewService.classifyFormat('application/octet-stream', 'avatar.webp'), 'IMAGE');
  assert.strictEqual(PreviewService.classifyFormat('image/svg+xml', 'diagram.svg'), 'IMAGE');

  // Video & Audio
  assert.strictEqual(PreviewService.classifyFormat('video/mp4', 'presentation.mp4'), 'VIDEO');
  assert.strictEqual(PreviewService.classifyFormat('audio/mpeg', 'podcast.mp3'), 'AUDIO');
  assert.strictEqual(PreviewService.isStreamableMedia('VIDEO'), true);
  assert.strictEqual(PreviewService.isStreamableMedia('AUDIO'), true);
  assert.strictEqual(PreviewService.isStreamableMedia('IMAGE'), false);

  // PDF & Markdown
  assert.strictEqual(PreviewService.classifyFormat('application/pdf', 'whitepaper.pdf'), 'PDF');
  assert.strictEqual(PreviewService.classifyFormat('text/markdown', 'README.md'), 'MARKDOWN');

  // Text / Code
  assert.strictEqual(PreviewService.classifyFormat('text/plain', 'notes.txt'), 'TEXT_CODE');
  assert.strictEqual(PreviewService.classifyFormat('application/json', 'config.json'), 'TEXT_CODE');
  assert.strictEqual(PreviewService.classifyFormat('text/typescript', 'server.ts'), 'TEXT_CODE');

  // Extracted text documents
  assert.strictEqual(PreviewService.classifyFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'contract.docx'), 'EXTRACTED_TEXT');

  // Unsupported binary fallback
  assert.strictEqual(PreviewService.classifyFormat('application/zip', 'backup.zip'), 'UNSUPPORTED');
  assert.strictEqual(PreviewService.supportsInlineViewing('UNSUPPORTED'), false);
});

test('1.0 RC Preview — PreviewInfo Metadata & Extracted Text Fallback', () => {
  const dummyFile: FileMetadata = {
    id: createFileId('f-doc'),
    name: 'archived_contract.docx',
    size: 50000,
    mimeType: 'application/msword',
    wholeFileHash: 'hash-doc-123',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    chunks: [],
  };

  const previewWithExtracted = PreviewService.getPreviewInfo(
    dummyFile,
    'Contract terms: All parties agree to deliver services by Q4 2026.'
  );

  assert.strictEqual(previewWithExtracted.format, 'EXTRACTED_TEXT');
  assert.strictEqual(previewWithExtracted.canInlineView, true);
  assert.strictEqual(previewWithExtracted.hasExtractedText, true);
  assert.ok(previewWithExtracted.extractedSnippet?.includes('Contract terms'));
});
