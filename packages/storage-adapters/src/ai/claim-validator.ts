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

    // Combine all retrieved context into lower-case reference text
    const fullContextText = contextChunks
      .map((c) => c.snippet.toLowerCase() + ' ' + (c.provenance?.text?.toLowerCase() || ''))
      .join(' ');

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

      // Extract key terms (length >= 4) from the sentence
      const terms = sentence
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      if (terms.length === 0) {
        supportedCount++;
        continue;
      }

      // Sentence is supported if at least 40% of its key terms exist in the retrieved context
      const matchedTerms = terms.filter((term) => fullContextText.includes(term));
      const supportRatio = matchedTerms.length / terms.length;

      if (supportRatio >= 0.4) {
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
