import {
  ContentChunk,
  ExtractedContent,
} from '@bucketspace/shared';

export interface ChunkingOptions {
  maxChunkSize?: number; // Target character length per chunk (default 500)
  overlapSize?: number;  // Overlap character length between chunks (default 100)
}

/**
 * SemanticChunker splits ExtractedContent into semantically coherent overlapping chunks.
 *
 * Invariant: Every generated ContentChunk inherits exact segment provenance
 * (pageNumber, charOffset, startTimeSeconds, endTimeSeconds) from its source segment.
 */
export class SemanticChunker {
  private readonly maxChunkSize: number;
  private readonly overlapSize: number;

  constructor(options?: ChunkingOptions) {
    this.maxChunkSize = options?.maxChunkSize ?? 500;
    this.overlapSize = options?.overlapSize ?? 100;
  }

  /**
   * Split ExtractedContent into overlapping ContentChunk records preserving provenance.
   */
  public chunkContent(content: ExtractedContent): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    let globalIndex = 0;

    // Process each segment individually to preserve strict page/timestamp provenance boundaries
    for (const seg of content.segments) {
      const segText = seg.text.trim();
      if (!segText) continue;

      if (segText.length <= this.maxChunkSize) {
        chunks.push({
          id: `chunk-${content.fileId}-${globalIndex}`,
          fileId: content.fileId,
          chunkIndex: globalIndex++,
          text: segText,
          pageNumber: seg.pageNumber,
          charOffset: seg.charOffset,
          startTimeSeconds: seg.startTimeSeconds,
          endTimeSeconds: seg.endTimeSeconds,
          confidence: seg.confidence,
        });
        continue;
      }

      // Overlapping chunking within segment text
      let start = 0;
      while (start < segText.length) {
        const end = Math.min(start + this.maxChunkSize, segText.length);
        const subText = segText.substring(start, end).trim();

        if (subText) {
          chunks.push({
            id: `chunk-${content.fileId}-${globalIndex}`,
            fileId: content.fileId,
            chunkIndex: globalIndex++,
            text: subText,
            pageNumber: seg.pageNumber,
            charOffset: seg.charOffset ? seg.charOffset + start : start,
            startTimeSeconds: seg.startTimeSeconds,
            endTimeSeconds: seg.endTimeSeconds,
            confidence: seg.confidence,
          });
        }

        start += this.maxChunkSize - this.overlapSize;
      }
    }

    return chunks;
  }
}
