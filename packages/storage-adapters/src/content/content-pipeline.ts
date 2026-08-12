import { ContentRepository } from '@bucketspace/db';
import {
  ExtractedContent,
  FileId,
  IContentExtractor,
} from '@bucketspace/shared';
import { PlainTextExtractor } from './text-extractor';
import { PdfExtractor } from './pdf-extractor';

/**
 * ContentPipeline orchestrates document parsing, OCR, and audio transcription.
 *
 * Ingestion Sequence:
 *   1. Matches target file stream to registered extractor
 *   2. Extracts text with exact segment provenance (page numbers, audio timestamps)
 *   3. Persists metadata & segments to SQLite via ContentRepository
 *   4. Indexes text into SQLite FTS5 for zero-cost deep full-text search
 *
 * Invariant: StorageProviders remain 100% byte-only. ContentPipeline consumes streams cleanly.
 */
export class ContentPipeline {
  private readonly extractors: IContentExtractor[] = [];

  constructor(private readonly contentRepo: ContentRepository) {
    // Register default deterministic extractors out of the box
    this.registerExtractor(new PlainTextExtractor());
    this.registerExtractor(new PdfExtractor());
  }

  /** Register a new custom content extractor or OCR/Transcription adapter */
  public registerExtractor(extractor: IContentExtractor): void {
    this.extractors.unshift(extractor); // Unshift so custom extractors take precedence
  }

  /** Get all registered extractors */
  public getExtractors(): IContentExtractor[] {
    return [...this.extractors];
  }

  /**
   * Ingest a file byte stream: parses text, records segment provenance,
   * updates SQLite content tables, and indexes text into SQLite FTS5.
   */
  public async ingestContent(
    fileId: FileId,
    stream: AsyncIterable<Uint8Array>,
    mimeType: string,
    filename?: string
  ): Promise<ExtractedContent | null> {
    const extractor = this.extractors.find((e) => e.canHandle(mimeType, filename));
    if (!extractor) return null;

    const extracted = await extractor.extract(fileId, stream, mimeType, filename);
    this.contentRepo.saveExtractedContent(extracted);
    return extracted;
  }
}
