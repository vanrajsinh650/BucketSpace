import { HybridSearchResult } from '@bucketspace/shared';

/**
 * PromptInjectionGuard scrubs retrieved context chunks for malicious adversarial instructions
 * embedded inside user-uploaded files (e.g. "ignore previous instructions", "system prompt override").
 */
export class PromptInjectionGuard {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(?:all\s+)?previous\s+instructions/i,
    /system\s+prompt\s+override/i,
    /disregard\s+(?:all\s+)?prior\s+directives/i,
    /reveal\s+(?:all\s+)?secret\s+keys/i,
    /print\s+environment\s+variables/i,
    /you\s+are\s+now\s+(?:an?\s+)?unrestricted/i,
  ];

  /**
   * Inspect and sanitize retrieved search results to neutralize prompt injection payloads.
   */
  public static sanitizeContextChunks(chunks: HybridSearchResult[]): {
    sanitizedChunks: HybridSearchResult[];
    injectionsDetected: number;
  } {
    let count = 0;

    const sanitizedChunks = chunks.map((chunk) => {
      let cleanText = chunk.snippet;
      let textWasModified = false;

      for (const pattern of PromptInjectionGuard.INJECTION_PATTERNS) {
        if (pattern.test(cleanText)) {
          cleanText = cleanText.replace(pattern, '[REDACTED ADVERSARIAL PROMPT INSTRUCTION]');
          textWasModified = true;
          count++;
        }
      }

      if (!textWasModified) return chunk;

      return {
        ...chunk,
        snippet: cleanText,
        provenance: chunk.provenance
          ? {
              ...chunk.provenance,
              text: cleanText,
            }
          : undefined,
      };
    });

    return {
      sanitizedChunks,
      injectionsDetected: count,
    };
  }
}
