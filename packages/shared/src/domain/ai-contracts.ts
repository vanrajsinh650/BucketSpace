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

/** A semantically coherent chunk derived from ExtractedContent with segment provenance */
export interface ContentChunk {
  id: string;
  fileId: FileId;
  chunkIndex: number;
  text: string;
  tokenCount?: number;
  pageNumber?: number;
  charOffset?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  confidence?: number;
}

/** Vector Embedding record with model identity metadata */
export interface VectorEmbedding {
  chunkId: string;
  fileId: FileId;
  vector: number[];
  modelId: string;
  modelVersion: string;
  dimensions: number;
  createdAt: Date;
}

/** Pluggable Embedding Model Provider contract (Local/Ollama/OpenAI/Gemini) */
export interface IEmbeddingProvider {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly dimensions: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** Result from Hybrid Search Engine combining FTS5 and Vector Search via RRF */
export interface HybridSearchResult {
  fileId: FileId;
  rrfScore: number;
  ftsRank?: number;
  semanticRank?: number;
  snippet: string;
  provenance?: SegmentProvenance;
}

/** Citation badge displaying source file and exact page or timestamp location */
export interface Citation {
  index: number;
  fileId: FileId;
  fileName: string;
  pageNumber?: number;
  charOffset?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  snippet: string;
}

/** Structured output of the Grounded RAG Assistant */
export interface AssistantResponse {
  answer: string;
  citations: Citation[];
  hasSufficientEvidence: boolean;
  modelUsed: string;
  retrievedChunkCount: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

/** Pluggable LLM Provider contract for Grounded RAG Generation */
export interface ILLMProvider {
  readonly providerId: string;
  readonly modelName: string;
  generateResponse(
    userPrompt: string,
    contextChunks: HybridSearchResult[],
    fileNamesMap: Map<string, string>
  ): Promise<AssistantResponse>;
}

/* ─── V3.3 Trust & Evaluation Contracts ─── */

export interface CitationValidationResult {
  isValid: boolean;
  citationIndex: number;
  fileId: FileId;
  pageNumber?: number;
  matchedSnippet: string;
  confidenceScore: number;
  reason?: string;
}

export interface GroundingValidationReport {
  isGrounded: boolean;
  groundingScore: number; // 0.0 to 1.0
  citationsValid: boolean;
  citationResults: CitationValidationResult[];
  entityMismatchDetected: boolean;
  promptInjectionDetected: boolean;
  rejectionReason?: string;
}

export interface EvaluationTestCase {
  id: string;
  category: 'answerable' | 'unanswerable' | 'conflicting' | 'entity_ambiguous' | 'citation_verify' | 'adversarial';
  query: string;
  expectedFileId?: string;
  expectedPage?: number;
  shouldRefuse?: boolean;
  disallowedPhrases?: string[];
}

export interface AdvancedEvaluationMetrics {
  totalCases: number;
  unsupportedClaimRate: number;
  citationRecall: number;
  citationCompleteness: number;
  entityAttributionAccuracy: number;
  attackSuccessRate: number;
  falseRefusalRate: number;
  retrievalRecallAtK: number;
  refusalAccuracy: number;
  citationPrecision: number;
}

export interface EvaluationBenchmarkReport {
  totalTests: number;
  passCount: number;
  failCount: number;
  retrievalRecallAtK: number;
  refusalAccuracy: number;
  citationPrecision: number;
  metrics?: AdvancedEvaluationMetrics;
  testDetails: Array<{ id: string; category: string; passed: boolean; score: number; notes: string }>;
}

/** Content Extractor contract for ingesting file byte streams into ExtractedContent */
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
  chunkId: string;
  score: number; // Cosine similarity score between 0.0 and 1.0
  text: string;
  provenance?: SegmentProvenance;
}

/** AI Vector Index contract for V3.1 Semantic Search */
export interface IAIIndex {
  upsertChunks(fileId: FileId, chunks: ContentChunk[], embeddings: number[][], modelId: string): Promise<void>;
  deleteForFile(fileId: FileId): Promise<void>;
  searchSemantic(queryVector: number[], limit?: number, minScore?: number): Promise<SemanticSearchResult[]>;
}
