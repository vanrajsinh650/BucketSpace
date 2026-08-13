import { ContentRepository, VectorRepository } from '@bucketspace/db';
import {
  ExtractedContent,
  FileId,
  HybridSearchResult,
  IEmbeddingProvider,
  SegmentProvenance,
} from '@bucketspace/shared';
import { SemanticChunker } from './semantic-chunker';

export interface HybridSearchOptions {
  rrfConstant?: number; // RRF k constant (default 60)
  ftsWeight?: number;   // Weight for FTS search (default 1.0)
  vectorWeight?: number;// Weight for Vector search (default 1.0)
}

/**
 * HybridSearchEngine fuses SQLite FTS5 lexical keyword matching (BM25)
 * with semantic vector search using Reciprocal Rank Fusion (RRF).
 *
 * Exact keyword queries (invoice numbers, dates, filenames) hit FTS5 with 100% precision,
 * while conceptual queries ("my tax filing") hit semantic vector search.
 */
export class HybridSearchEngine {
  private readonly chunker = new SemanticChunker();
  private readonly rrfK: number;

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly vectorRepo: VectorRepository,
    private readonly embeddingProvider: IEmbeddingProvider,
    options?: HybridSearchOptions
  ) {
    this.rrfK = options?.rrfConstant ?? 60;
  }

  /**
   * Index ExtractedContent: chunks text, embeds vectors under current model identity,
   * updates VectorRepository, and sets model metadata.
   */
  public async indexContent(content: ExtractedContent): Promise<void> {
    const chunks = this.chunker.chunkContent(content);
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => c.text);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    this.vectorRepo.upsertVectorChunks(
      content.fileId as string,
      chunks,
      embeddings,
      this.embeddingProvider.modelId,
      this.embeddingProvider.dimensions
    );

    this.vectorRepo.setActiveModel(
      this.embeddingProvider.modelId,
      this.embeddingProvider.modelVersion,
      this.embeddingProvider.dimensions
    );
  }

  /**
   * Hybrid Search: runs FTS5 and Vector Search in parallel and combines
   * ranks using Reciprocal Rank Fusion (RRF).
   *
   * @param authorizedFileIds - Optional set of file IDs the caller is permitted to access.
   *   When provided, ALL candidate chunks from both FTS5 and Vector search are filtered
   *   to this authorized set BEFORE RRF fusion. The LLM is never trusted to enforce
   *   access control; authorization is an application-level pre-filter.
   */
  public async searchHybrid(
    query: string,
    limit: number = 20,
    authorizedFileIds?: Set<string>
  ): Promise<HybridSearchResult[]> {
    if (!query.trim()) return [];

    // 1. Run FTS5 search
    const rawFtsResults = this.contentRepo.searchContentFts(query, limit * 2);

    // 2. Run Vector Semantic Search
    const queryVector = await this.embeddingProvider.embedText(query);
    const rawVectorResults = this.vectorRepo.searchCosineSimilarity(
      queryVector,
      limit * 2,
      0.0,
      this.embeddingProvider.modelId
    );

    // 3. Application-Level Authorization Filter (pre-RRF)
    const ftsResults = authorizedFileIds
      ? rawFtsResults.filter((r) => authorizedFileIds.has(r.fileId))
      : rawFtsResults;
    const vectorResults = authorizedFileIds
      ? rawVectorResults.filter((r) => authorizedFileIds.has(r.fileId as string))
      : rawVectorResults;

    // 4. Reciprocal Rank Fusion (RRF) Fusing
    const fileRrfMap = new Map<
      string,
      {
        fileId: FileId;
        rrfScore: number;
        ftsRank?: number;
        semanticRank?: number;
        snippet: string;
        provenance?: SegmentProvenance;
      }
    >();

    // Process FTS Ranks
    for (let r = 0; r < ftsResults.length; r++) {
      const item = ftsResults[r];
      const rank = r + 1;
      const rrfContribution = 1.0 / (this.rrfK + rank);

      const existing = fileRrfMap.get(item.fileId);
      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.ftsRank = rank;
        if (!existing.snippet) existing.snippet = item.snippet;
        if (!existing.provenance && item.matchedSegments.length > 0) {
          existing.provenance = item.matchedSegments[0];
        }
      } else {
        fileRrfMap.set(item.fileId, {
          fileId: item.fileId as FileId,
          rrfScore: rrfContribution,
          ftsRank: rank,
          snippet: item.snippet,
          provenance: item.matchedSegments.length > 0 ? item.matchedSegments[0] : undefined,
        });
      }
    }

    // Process Vector Semantic Ranks
    for (let r = 0; r < vectorResults.length; r++) {
      const item = vectorResults[r];
      const rank = r + 1;
      const rrfContribution = 1.0 / (this.rrfK + rank);

      const existing = fileRrfMap.get(item.fileId as string);
      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.semanticRank = rank;
        if (!existing.provenance && item.provenance) {
          existing.provenance = item.provenance;
        }
      } else {
        fileRrfMap.set(item.fileId as string, {
          fileId: item.fileId,
          rrfScore: rrfContribution,
          semanticRank: rank,
          snippet: item.text.substring(0, 150),
          provenance: item.provenance,
        });
      }
    }

    // 5. Sort fused results by RRF score DESC
    const sorted = Array.from(fileRrfMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
    return sorted.slice(0, limit);
  }

  /** Delete vector index entries when a file is purged */
  public deleteForFile(fileId: string): void {
    this.vectorRepo.deleteForFile(fileId);
  }
}
