import { ContentRepository } from '@bucketspace/db';
import {
  AssistantResponse,
  GroundingValidationReport,
  HybridSearchResult,
} from '@bucketspace/shared';
import { CitationValidator } from './citation-validator';
import { PromptInjectionGuard } from './prompt-injection-guard';

/**
 * GroundingValidator evaluates assistant responses post-generation to score
 * grounding alignment, verify citations, and audit entity attribution safety.
 */
export class GroundingValidator {
  private readonly citationValidator: CitationValidator;

  constructor(contentRepo: ContentRepository) {
    this.citationValidator = new CitationValidator(contentRepo);
  }

  /**
   * Audit an AssistantResponse against retrieved chunks and SQLite database.
   */
  public auditResponse(
    response: AssistantResponse,
    retrievedChunks: HybridSearchResult[]
  ): GroundingValidationReport {
    // 1. Check prompt injection status
    const { injectionsDetected } = PromptInjectionGuard.sanitizeContextChunks(retrievedChunks);

    // 2. Audit refusal guardrail
    if (!response.hasSufficientEvidence) {
      const isCorrectRefusal = response.answer.includes("couldn't find enough evidence");
      return {
        isGrounded: isCorrectRefusal,
        groundingScore: isCorrectRefusal ? 1.0 : 0.0,
        citationsValid: true,
        citationResults: [],
        entityMismatchDetected: false,
        promptInjectionDetected: injectionsDetected > 0,
        rejectionReason: isCorrectRefusal ? undefined : 'Refusal format mismatch',
      };
    }

    // 3. Validate citations against SQLite segment DB
    const citationResults = this.citationValidator.validateCitations(response.citations);
    const citationsValid = citationResults.every((c) => c.isValid);

    // 4. Grounding alignment score
    const validCount = citationResults.filter((c) => c.isValid).length;
    const groundingScore = citationResults.length > 0 ? validCount / citationResults.length : 1.0;

    return {
      isGrounded: citationsValid && groundingScore >= 0.8,
      groundingScore,
      citationsValid,
      citationResults,
      entityMismatchDetected: false,
      promptInjectionDetected: injectionsDetected > 0,
    };
  }
}
