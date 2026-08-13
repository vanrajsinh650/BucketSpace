import { HybridSearchResult } from '@bucketspace/shared';

export interface ClaimAuditResult {
  isFullySupported: boolean;
  totalClaimCount: number;
  supportedClaimCount: number;
  unsupportedClaimCount: number;
  unsupportedClaims: string[];
}

/**
 * ClaimValidator splits an LLM response into sentence-level claims and audits
 * each statement against retrieved context chunks to detect ungrounded claim additions.
 */
export class ClaimValidator {
  /**
   * Audit an LLM response string against retrieved context chunks.
   */
  public static auditClaims(answerText: string, contextChunks: HybridSearchResult[]): ClaimAuditResult {
    if (!answerText.trim() || contextChunks.length === 0) {
      return {
        isFullySupported: false,
        totalClaimCount: 0,
        supportedClaimCount: 0,
        unsupportedClaimCount: 0,
        unsupportedClaims: [],
      };
    }

    // Combine all retrieved context into normalized lower-case reference text
    const rawContextText = contextChunks
      .map((c) => c.snippet + ' ' + (c.provenance?.text || ''))
      .join(' ')
      .toLowerCase();
    const normalizedContextText = rawContextText.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    const compactContextText = rawContextText.replace(/[^\p{L}\p{N}]/gu, '');

    // Split answer into sentences
    const sentences = answerText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const unsupportedClaims: string[] = [];
    let supportedCount = 0;

    for (const sentence of sentences) {
      // Ignore system metadata header sentences like "Based on your stored documents..."
      if (sentence.startsWith('Based on your stored documents') || sentence.includes("couldn't find enough evidence")) {
        supportedCount++;
        continue;
      }

      // Extract key terms (length >= 3) from the sentence
      const terms = sentence
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      if (terms.length === 0) {
        supportedCount++;
        continue;
      }

      // Sentence is supported if key terms exist in the normalized or compact retrieved context
      const matchedTerms = terms.filter(
        (term) =>
          normalizedContextText.includes(term) ||
          compactContextText.includes(term) ||
          rawContextText.includes(term)
      );
      const supportRatio = matchedTerms.length / terms.length;

      if (supportRatio >= 0.35) {
        supportedCount++;
      } else {
        unsupportedClaims.push(sentence);
      }
    }

    const unsupportedCount = unsupportedClaims.length;
    const isFullySupported = unsupportedCount === 0;

    return {
      isFullySupported,
      totalClaimCount: sentences.length,
      supportedClaimCount: supportedCount,
      unsupportedClaimCount: unsupportedCount,
      unsupportedClaims,
    };
  }
}
