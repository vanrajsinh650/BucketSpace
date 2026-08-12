import { DatabaseSync } from 'node:sqlite';
import { ContentChunk, FileId, SemanticSearchResult } from '@bucketspace/shared';

interface VectorChunkRow {
  id: string;
  file_id: string;
  chunk_index: number;
  text: string;
  page_number: number | null;
  char_offset: number | null;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
  confidence: number | null;
  embedding_json: string;
  model_id: string;
  dimensions: number;
  created_at: string;
}

interface EmbeddingModelRow {
  model_id: string;
  model_version: string;
  dimensions: number;
  is_active: number;
  created_at: string;
}

/**
 * VectorRepository manages SQLite persistence of semantic vector chunks,
 * model identity tracking, and in-memory cosine similarity ranking.
 */
export class VectorRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Upsert vector chunks for a file under a specific model identity */
  public upsertVectorChunks(
    fileId: string,
    chunks: ContentChunk[],
    embeddings: number[][],
    modelId: string,
    dimensions: number
  ): void {
    if (chunks.length !== embeddings.length) {
      throw new Error(`Chunks count (${chunks.length}) does not match embeddings count (${embeddings.length})`);
    }

    // Clear old vectors for file
    this.db.prepare('DELETE FROM vector_chunks WHERE file_id = ?').run(fileId);

    const stmt = this.db.prepare(`
      INSERT INTO vector_chunks
        (id, file_id, chunk_index, text, page_number, char_offset, start_time_seconds, end_time_seconds, confidence, embedding_json, model_id, dimensions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const emb = embeddings[i];

      stmt.run(
        c.id,
        fileId,
        c.chunkIndex,
        c.text,
        c.pageNumber ?? null,
        c.charOffset ?? null,
        c.startTimeSeconds ?? null,
        c.endTimeSeconds ?? null,
        c.confidence ?? null,
        JSON.stringify(emb),
        modelId,
        dimensions,
        now
      );
    }
  }

  /** Delete vector chunks for a specific file */
  public deleteForFile(fileId: string): void {
    this.db.prepare('DELETE FROM vector_chunks WHERE file_id = ?').run(fileId);
  }

  /** Search vector chunks using cosine similarity ranking */
  public searchCosineSimilarity(
    queryVector: number[],
    limit: number = 20,
    minScore: number = 0.0,
    modelId?: string
  ): SemanticSearchResult[] {
    let sql = 'SELECT * FROM vector_chunks';
    const params: (string | number)[] = [];

    if (modelId) {
      sql += ' WHERE model_id = ?';
      params.push(modelId);
    }

    const stmt = this.db.prepare(sql);
    const rows = (stmt.all(...params) as unknown) as VectorChunkRow[];

    const results: SemanticSearchResult[] = [];

    for (const r of rows) {
      const chunkVector = JSON.parse(r.embedding_json) as number[];
      const score = cosineSimilarity(queryVector, chunkVector);

      if (score >= minScore) {
        results.push({
          fileId: r.file_id as FileId,
          chunkId: r.id,
          score,
          text: r.text,
          provenance: {
            id: r.id,
            segmentIndex: r.chunk_index,
            text: r.text,
            pageNumber: r.page_number ?? undefined,
            charOffset: r.char_offset ?? undefined,
            startTimeSeconds: r.start_time_seconds ?? undefined,
            endTimeSeconds: r.end_time_seconds ?? undefined,
            confidence: r.confidence ?? undefined,
          },
        });
      }
    }

    // Sort by cosine similarity score DESC
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** Record or update active embedding model identity metadata */
  public setActiveModel(modelId: string, modelVersion: string, dimensions: number): void {
    this.db.prepare('UPDATE embedding_models SET is_active = 0').run();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embedding_models (model_id, model_version, dimensions, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `);

    stmt.run(modelId, modelVersion, dimensions, new Date().toISOString());
  }

  /** Get active embedding model metadata */
  public getActiveModel(): { modelId: string; modelVersion: string; dimensions: number } | null {
    const stmt = this.db.prepare('SELECT * FROM embedding_models WHERE is_active = 1 LIMIT 1');
    const row = (stmt.get() as unknown) as EmbeddingModelRow | undefined;
    if (!row) return null;

    return {
      modelId: row.model_id,
      modelVersion: row.model_version,
      dimensions: row.dimensions,
    };
  }
}

/** Cosine similarity score between two normalized vector arrays */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
