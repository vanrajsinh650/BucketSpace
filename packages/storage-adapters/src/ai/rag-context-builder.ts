import {
  Citation,
  FileId,
  HybridSearchResult,
} from '@bucketspace/shared';

export interface RagContextResult {
  formattedContext: string;
  citations: Citation[];
  hasSufficientEvidence: boolean;
  retrievedCount: number;
}

export class RagContextBuilder {
  private static readonly MIN_RRF_SCORE_THRESHOLD = 0.008;

  /**
   * Build RAG context from Hybrid Search Results and evaluate evidence sufficiency.
   */
  public static buildContext(
    results: HybridSearchResult[],
    fileNamesMap: Map<string, string>
  ): RagContextResult {
    if (!results || results.length === 0) {
      return {
        formattedContext: '',
        citations: [],
        hasSufficientEvidence: false,
        retrievedCount: 0,
      };
    }

    // Filter results meeting minimum RRF score threshold (0.008)
    const validResults = results.filter((r) => r.rrfScore >= RagContextBuilder.MIN_RRF_SCORE_THRESHOLD);

    if (validResults.length === 0) {
      return {
        formattedContext: '',
        citations: [],
        hasSufficientEvidence: false,
        retrievedCount: results.length,
      };
    }

    const citations: Citation[] = [];
    const contextBlocks: string[] = [];

    for (let i = 0; i < validResults.length; i++) {
      const item = validResults[i];
      const index = i + 1;
      const fileName = fileNamesMap.get(item.fileId as string) || `file-${item.fileId}`;
      const prov = item.provenance;

      let locationLabel = '';
      if (prov?.pageNumber) {
        locationLabel = `, Page ${prov.pageNumber}`;
      } else if (prov?.startTimeSeconds !== undefined) {
        const mins = Math.floor(prov.startTimeSeconds / 60);
        const secs = Math.floor(prov.startTimeSeconds % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        locationLabel = `, ${timeStr}`;
      }

      citations.push({
        index,
        fileId: item.fileId as FileId,
        fileName,
        pageNumber: prov?.pageNumber,
        charOffset: prov?.charOffset,
        startTimeSeconds: prov?.startTimeSeconds,
        endTimeSeconds: prov?.endTimeSeconds,
        snippet: item.snippet || prov?.text || '',
      });

      contextBlocks.push(
        `[Source ${index}: ${fileName}${locationLabel}]\n"${item.snippet || prov?.text || ''}"`
      );
    }

    return {
      formattedContext: contextBlocks.join('\n\n'),
      citations,
      hasSufficientEvidence: true,
      retrievedCount: validResults.length,
    };
  }
}
