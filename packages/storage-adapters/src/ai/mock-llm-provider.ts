import {
  AssistantResponse,
  HybridSearchResult,
  ILLMProvider,
} from '@bucketspace/shared';
import { RagContextBuilder } from './rag-context-builder';

/**
 * MockLLMProvider is a deterministic offline LLM provider for unit and integration testing.
 * Synthesizes grounded answers strictly from retrieved context and enforces the "I don't know" fallback policy.
 */
export class MockLLMProvider implements ILLMProvider {
  public readonly providerId = 'mock-llm';
  public readonly modelName = 'mock-grounded-v1';

  public async generateResponse(
    userPrompt: string,
    contextChunks: HybridSearchResult[],
    fileNamesMap: Map<string, string>
  ): Promise<AssistantResponse> {
    const ragContext = RagContextBuilder.buildContext(contextChunks, fileNamesMap);

    // Common stop words (pronouns, prepositions, auxiliaries, articles)
    const STOP_WORDS = new Set([
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'the', 'is', 'are', 'was', 'were', 'for', 'and', 'with', 'does', 'did',
      'this', 'that', 'from', 'your', 'about', 'tell', 'show', 'give', 'any', 'much',
      'my', 'me', 'i', 'we', 'us', 'you', 'he', 'him', 'his', 'she', 'her', 'they',
      'them', 'their', 'our', 'can', 'could', 'should', 'would', 'shall', 'will', 'please',
      'in', 'on', 'at', 'to', 'of', 'by', 'an', 'as', 'if', 'be', 'or', 'so', 'up', 'out',
      'into', 'it', 'its', 'no', 'not', 'do', 'has', 'have', 'had', 'been'
    ]);

    // Extract significant query content words
    const promptWords = userPrompt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

    // Calculate maximum query overlap across individual retrieved chunks
    let maxOverlapCount = 0;
    let bestCitation = ragContext.citations[0];

    for (const cit of ragContext.citations) {
      const citTokens = new Set(
        (cit.snippet + ' ' + (cit.fileName || ''))
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
      );

      const count = promptWords.filter((w) => citTokens.has(w)).length;
      if (count > maxOverlapCount) {
        maxOverlapCount = count;
        bestCitation = cit;
      }
    }

    // Require sufficient overlap:
    // If prompt has <= 2 key words: need at least 1 exact keyword match
    // If prompt has >= 3 key words: need at least 2 exact keyword matches
    const requiredOverlap = promptWords.length <= 2 ? Math.min(1, promptWords.length) : 2;
    const hasSufficientGrounding = promptWords.length === 0 || maxOverlapCount >= requiredOverlap;

    // Enforce "I don't know" Fallback Guardrail
    if (!ragContext.hasSufficientEvidence || !hasSufficientGrounding || !bestCitation) {
      return {
        answer: "I couldn't find enough evidence in your stored files to answer this question.",
        citations: [],
        hasSufficientEvidence: false,
        modelUsed: `${this.providerId}:${this.modelName}`,
        retrievedChunkCount: ragContext.retrievedCount,
      };
    }

    // Synthesize grounded response using source citations
    const sourceRefs = ragContext.citations.map((c) => `[Source ${c.index}: ${c.fileName}]`).join(', ');
    const answer = `Based on your stored documents (${sourceRefs}), here is the information found: ${bestCitation.snippet}`;

    return {
      answer,
      citations: ragContext.citations,
      hasSufficientEvidence: true,
      modelUsed: `${this.providerId}:${this.modelName}`,
      retrievedChunkCount: ragContext.retrievedCount,
    };
  }
}
