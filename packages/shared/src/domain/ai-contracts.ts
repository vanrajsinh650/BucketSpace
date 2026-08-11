import { FileId } from './ids';

/* ─── AI & Content Processing Domain Contracts (V3 Boundary) ─── */

export interface ExtractedMetadata {
  fileId: FileId;
  text?: string;
  language?: string;
  pageCount?: number;
  tags?: string[];
  extractedAt: Date;
}

export interface SemanticSearchResult {
  fileId: FileId;
  score: number; // Relevance score between 0.0 and 1.0
  snippet?: string;
}

/**
 * Content Extractor contract for OCR, text extraction, and document understanding.
 * Operates strictly on byte streams from storage service.
 * Storage providers (Telegram, S3, Local Disk) know NOTHING about this interface.
 */
export interface IContentExtractor {
  supports(mimeType: string): boolean;
  extract(fileId: FileId, stream: AsyncIterable<Uint8Array>, mimeType: string): Promise<ExtractedMetadata>;
}

/**
 * AI Index contract for managing document vector embeddings and semantic search.
 * Storage providers know NOTHING about vector embeddings or semantic indices.
 */
export interface IAIIndex {
  indexDocument(metadata: ExtractedMetadata): Promise<void>;
  searchSemantic(query: string, limit?: number): Promise<SemanticSearchResult[]>;
  removeDocument(fileId: FileId): Promise<void>;
}
