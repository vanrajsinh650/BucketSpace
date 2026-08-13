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

    // Validate semantic overlap between user prompt and retrieved snippets
    const promptWords = userPrompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    const contextText = ragContext.citations.map((c) => c.snippet.toLowerCase()).join(' ');
    const hasOverlap = promptWords.length === 0 || promptWords.some((w) => contextText.includes(w));

    // Enforce "I don't know" Fallback Guardrail
    if (!ragContext.hasSufficientEvidence || !hasOverlap) {
      return {
        answer: "I couldn't find enough evidence in your stored files to answer this question.",
        citations: [],
        hasSufficientEvidence: false,
        modelUsed: `${this.providerId}:${this.modelName}`,
        retrievedChunkCount: ragContext.retrievedCount,
      };
    }

    // Synthesize grounded response using top source citations
    const sourceRefs = ragContext.citations.map((c) => `[Source ${c.index}: ${c.fileName}]`).join(', ');
    const topSnippet = ragContext.citations[0].snippet;

    const answer = `Based on your stored documents (${sourceRefs}), here is the information found: ${topSnippet}`;

    return {
      answer,
      citations: ragContext.citations,
      hasSufficientEvidence: true,
      modelUsed: `${this.providerId}:${this.modelName}`,
      retrievedChunkCount: ragContext.retrievedCount,
    };
  }
}
