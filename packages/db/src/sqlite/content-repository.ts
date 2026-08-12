import { DatabaseSync } from 'node:sqlite';
import { ExtractedContent, FileId, SegmentProvenance } from '@bucketspace/shared';

export interface ContentSearchResult {
  fileId: string;
  snippet: string;
  matchedSegments: SegmentProvenance[];
}

interface ContentMetadataRow {
  file_id: string;
  extractor_id: string;
  mime_type: string;
  full_text: string;
  language: string | null;
  metadata_json: string;
  extracted_at: string;
}

interface ContentSegmentRow {
  id: string;
  file_id: string;
  segment_index: number;
  text: string;
  page_number: number | null;
  char_offset: number | null;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
  confidence: number | null;
  bounding_box_json: string | null;
}

/**
 * ContentRepository manages the SQLite persistence of extracted file text,
 * granular segment provenance, and zero-cost FTS5 full-text indexing.
 */
export class ContentRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Save extracted content and segment provenance to SQLite and update FTS index */
  public saveExtractedContent(content: ExtractedContent): void {
    // 1. Save metadata
    const metaStmt = this.db.prepare(`
      INSERT OR REPLACE INTO content_metadata
        (file_id, extractor_id, mime_type, full_text, language, metadata_json, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    metaStmt.run(
      content.fileId as string,
      content.extractorId,
      content.mimeType,
      content.fullText,
      content.language ?? null,
      JSON.stringify(content.metadata),
      content.extractedAt.toISOString()
    );

    // 2. Clear existing segments & insert new ones
    this.db.prepare('DELETE FROM content_segments WHERE file_id = ?').run(content.fileId as string);

    const segStmt = this.db.prepare(`
      INSERT INTO content_segments
        (id, file_id, segment_index, text, page_number, char_offset, start_time_seconds, end_time_seconds, confidence, bounding_box_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const seg of content.segments) {
      segStmt.run(
        seg.id,
        content.fileId as string,
        seg.segmentIndex,
        seg.text,
        seg.pageNumber ?? null,
        seg.charOffset ?? null,
        seg.startTimeSeconds ?? null,
        seg.endTimeSeconds ?? null,
        seg.confidence ?? null,
        seg.boundingBox ? JSON.stringify(seg.boundingBox) : null
      );
    }

    // 3. Update FTS index
    this.db.prepare('DELETE FROM content_fts WHERE file_id = ?').run(content.fileId as string);
    const ftsStmt = this.db.prepare('INSERT INTO content_fts (file_id, full_text) VALUES (?, ?)');
    ftsStmt.run(content.fileId as string, content.fullText);
  }

  /** Retrieve full ExtractedContent record by fileId */
  public getContent(fileId: string): ExtractedContent | null {
    const metaStmt = this.db.prepare('SELECT * FROM content_metadata WHERE file_id = ?');
    const row = (metaStmt.get(fileId) as unknown) as ContentMetadataRow | undefined;
    if (!row) return null;

    const segments = this.getSegments(fileId);

    return {
      fileId: row.file_id as FileId,
      extractorId: row.extractor_id,
      mimeType: row.mime_type,
      fullText: row.full_text,
      language: row.language ?? undefined,
      metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
      segments,
      extractedAt: new Date(row.extracted_at),
    };
  }

  /** Retrieve granular segment provenance for a file */
  public getSegments(fileId: string): SegmentProvenance[] {
    const segStmt = this.db.prepare(
      'SELECT * FROM content_segments WHERE file_id = ? ORDER BY segment_index ASC'
    );
    const rows = (segStmt.all(fileId) as unknown) as ContentSegmentRow[];

    return rows.map((r) => ({
      id: r.id,
      segmentIndex: r.segment_index,
      text: r.text,
      pageNumber: r.page_number ?? undefined,
      charOffset: r.char_offset ?? undefined,
      startTimeSeconds: r.start_time_seconds ?? undefined,
      endTimeSeconds: r.end_time_seconds ?? undefined,
      confidence: r.confidence ?? undefined,
      boundingBox: r.bounding_box_json ? JSON.parse(r.bounding_box_json) : undefined,
    }));
  }

  /** Search extracted text using SQLite FTS5 index */
  public searchContentFts(query: string, limit: number = 20): ContentSearchResult[] {
    if (!query.trim()) return [];

    // FTS query with snippet extraction
    const ftsQuery = query
      .trim()
      .split(/\s+/)
      .map((term) => `"${term.replace(/"/g, '""')}"*`)
      .join(' AND ');

    const stmt = this.db.prepare(`
      SELECT file_id, snippet(content_fts, 1, '<mark>', '</mark>', '...', 15) as snippet
      FROM content_fts
      WHERE content_fts MATCH ?
      LIMIT ?
    `);

    try {
      const rows = (stmt.all(ftsQuery, limit) as unknown) as { file_id: string; snippet: string }[];

      return rows.map((r) => {
        const segments = this.getSegments(r.file_id);
        const lowerQuery = query.toLowerCase();
        const matchedSegments = segments.filter((s) => s.text.toLowerCase().includes(lowerQuery));

        return {
          fileId: r.file_id,
          snippet: r.snippet,
          matchedSegments: matchedSegments.length > 0 ? matchedSegments : segments.slice(0, 2),
        };
      });
    } catch {
      return [];
    }
  }

  /** Delete extracted content by fileId */
  public deleteContent(fileId: string): void {
    this.db.prepare('DELETE FROM content_metadata WHERE file_id = ?').run(fileId);
    this.db.prepare('DELETE FROM content_segments WHERE file_id = ?').run(fileId);
    this.db.prepare('DELETE FROM content_fts WHERE file_id = ?').run(fileId);
  }
}
