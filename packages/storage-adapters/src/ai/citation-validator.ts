import { ContentRepository } from '@bucketspace/db';
import { Citation, CitationValidationResult } from '@bucketspace/shared';

/**
 * CitationValidator verifies that citations attached to assistant answers
 * accurately match the canonical SQLite segment text and page numbers.
 */
export class CitationValidator {
  constructor(private readonly contentRepo: ContentRepository) {}

  /**
   * Validate an array of citations against SQLite content segments.
   */
  public validateCitations(citations: Citation[]): CitationValidationResult[] {
    const results: CitationValidationResult[] = [];

    for (const c of citations) {
      const segments = this.contentRepo.getSegments(c.fileId as string);

      if (segments.length === 0) {
        results.push({
          isValid: false,
          citationIndex: c.index,
          fileId: c.fileId,
          pageNumber: c.pageNumber,
          matchedSnippet: '',
          confidenceScore: 0.0,
          reason: `No extracted segments found in database for file ${c.fileId}`,
        });
        continue;
      }

      // Check if page number matches (if page number was specified)
      let pageMatched = true;
      if (c.pageNumber !== undefined) {
        const segOnPage = segments.find((s) => s.pageNumber === c.pageNumber);
        if (!segOnPage) {
          pageMatched = false;
        }
      }

      // Check text snippet overlap
      const cSnippetLower = c.snippet.toLowerCase().trim();
      const snippetMatched = segments.some((s) => s.text.toLowerCase().includes(cSnippetLower));

      const isValid = pageMatched && (cSnippetLower.length === 0 || snippetMatched);

      results.push({
        isValid,
        citationIndex: c.index,
        fileId: c.fileId,
        pageNumber: c.pageNumber,
        matchedSnippet: c.snippet,
        confidenceScore: isValid ? 1.0 : 0.0,
        reason: isValid
          ? 'Citation text and page number verified against database'
          : `Citation mismatch: pageMatched=${pageMatched}, textMatched=${snippetMatched}`,
      });
    }

    return results;
  }
}
