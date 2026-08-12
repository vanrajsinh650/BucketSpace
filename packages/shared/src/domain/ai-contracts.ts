import { FileId } from './ids';

/* ─── AI & Content Ingestion Domain Contracts (V3 Boundary) ─── */

/**
 * Segment Provenance tracks the exact position of an extracted text snippet:
 * - pageNumber: PDF/Document page number (1-indexed)
 * - charOffset: Character offset within file
 * - startTimeSeconds / endTimeSeconds: Audio/Video segment timestamps
 * - confidence: OCR or speech recognition confidence (0.0 to 1.0)
 * - boundingBox: Image OCR bounding box
 */
export interface SegmentProvenance {
  id: string;
  segmentIndex: number;
  text: string;
  pageNumber?: number;
  charOffset?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/** Structured output of the content extraction pipeline */
export interface ExtractedContent {
  fileId: FileId;
  extractorId: string;
  mimeType: string;
  fullText: string;
  segments: SegmentProvenance[];
  metadata: Record<string, unknown>;
  language?: string;
  extractedAt: Date;
}

/**
 * Content Extractor contract for ingesting file byte streams into ExtractedContent.
 * Operates strictly on byte streams from storage application service.
 * Storage providers (Telegram, S3, Local Disk) know NOTHING about this interface.
 */
export interface IContentExtractor {
  readonly extractorId: string;
  canHandle(mimeType: string, filename?: string): boolean;
  extract(
    fileId: FileId,
    stream: AsyncIterable<Uint8Array>,
    mimeType: string,
    filename?: string
  ): Promise<ExtractedContent>;
}

/** Pluggable OCR engine contract for image text recognition */
export interface IOCRProvider {
  readonly providerId: string;
  recognizeText(
    imageStream: AsyncIterable<Uint8Array>,
    mimeType: string
  ): Promise<{ text: string; confidence: number; segments: SegmentProvenance[] }>;
}

/** Pluggable Transcription engine contract for speech-to-text */
export interface ITranscriptionProvider {
  readonly providerId: string;
  transcribe(
    audioStream: AsyncIterable<Uint8Array>,
    mimeType: string
  ): Promise<{ text: string; language?: string; segments: SegmentProvenance[] }>;
}

export interface SemanticSearchResult {
  fileId: FileId;
  score: number; // Relevance score between 0.0 and 1.0
  snippet?: string;
  provenance?: SegmentProvenance;
}

/** AI Vector Index contract for V3.1 Semantic Search */
export interface IAIIndex {
  indexDocument(content: ExtractedContent): Promise<void>;
  searchSemantic(query: string, limit?: number): Promise<SemanticSearchResult[]>;
  removeDocument(fileId: FileId): Promise<void>;
}
