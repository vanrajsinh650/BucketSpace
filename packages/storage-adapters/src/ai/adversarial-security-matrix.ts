import { HybridSearchResult } from '@bucketspace/shared';

export interface SecurityScanResult {
  isSafe: boolean;
  threatsDetected: string[];
  sanitizedChunks: HybridSearchResult[];
}

/**
 * AdversarialSecurityMatrix is a defense-in-depth security scanner protecting RAG context
 * against Unicode obfuscation, typoglycemia, exfiltration payloads, and indirect document poisoning.
 */
export class AdversarialSecurityMatrix {
  private static readonly EXFILTRATION_PATTERNS = [
    /print\s+(?:the\s+)?system\s+prompt/i,
    /show\s+(?:the\s+)?database\s+schema/i,
    /dump\s+sqlite\s+tables/i,
    /reveal\s+(?:aws|telegram|master|api|secret)[_\s\w]*key/i,
    /export\s+credentials/i,
  ];

  private static readonly OBFUSCATED_PATTERNS = [
    /i[\s._-]*g[\s._-]*n[\s._-]*o[\s._-]*r[\s._-]*e/i,
    /s[\s._-]*y[\s._-]*s[\s._-]*t[\s._-]*e[\s._-]*m/i,
    /o[\s._-]*v[\s._-]*e[\s._-]*r[\s._-]*r[\s._-]*i[\s._-]*d[\s._-]*e/i,
  ];

  /**
   * Remove Unicode invisible characters and zero-width joiners.
   */
  public static normalizeUnicode(text: string): string {
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)); // Fullwidth ASCII
  }

  /**
   * Inspect and sanitize RAG context chunks against adversarial payload classes.
   */
  public static scanAndSanitize(chunks: HybridSearchResult[]): SecurityScanResult {
    const threatsDetected: string[] = [];

    const sanitizedChunks = chunks.map((chunk) => {
      let cleanText = AdversarialSecurityMatrix.normalizeUnicode(chunk.snippet);
      let modified = false;

      // 1. Exfiltration Scan
      for (const pattern of AdversarialSecurityMatrix.EXFILTRATION_PATTERNS) {
        if (pattern.test(cleanText)) {
          cleanText = cleanText.replace(pattern, '[REDACTED EXFILTRATION PAYLOAD]');
          threatsDetected.push('Exfiltration Attack');
          modified = true;
        }
      }

      // 2. Obfuscated Injection Scan
      for (const pattern of AdversarialSecurityMatrix.OBFUSCATED_PATTERNS) {
        if (pattern.test(cleanText) && cleanText.includes('instruction')) {
          cleanText = cleanText.replace(pattern, '[REDACTED OBFUSCATED PAYLOAD]');
          threatsDetected.push('Obfuscated Injection');
          modified = true;
        }
      }

      if (!modified) return chunk;

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
      isSafe: threatsDetected.length === 0,
      threatsDetected,
      sanitizedChunks,
    };
  }
}
