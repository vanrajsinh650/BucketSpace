import {
  AssistantResponse,
  HybridSearchResult,
  ILLMProvider,
} from '@bucketspace/shared';
import { RagContextBuilder } from './rag-context-builder';

export interface OllamaOptions {
  baseUrl?: string;  // default 'http://localhost:11434'
  modelName?: string;// default 'llama3'
}

/**
 * OllamaLLMProvider connects to a local Ollama instance for zero-cost, open-source LLM inference.
 * Enforces strict system prompt grounding and provenance citation formatting.
 */
export class OllamaLLMProvider implements ILLMProvider {
  public readonly providerId = 'ollama-local';
  public readonly modelName: string;
  private readonly baseUrl: string;

  constructor(options?: OllamaOptions) {
    this.baseUrl = options?.baseUrl ?? 'http://localhost:11434';
    this.modelName = options?.modelName ?? 'llama3';
  }

  public async generateResponse(
    userPrompt: string,
    contextChunks: HybridSearchResult[],
    fileNamesMap: Map<string, string>
  ): Promise<AssistantResponse> {
    const ragContext = RagContextBuilder.buildContext(contextChunks, fileNamesMap);

    if (!ragContext.hasSufficientEvidence) {
      return {
        answer: "I couldn't find enough evidence in your stored files to answer this question.",
        citations: [],
        hasSufficientEvidence: false,
        modelUsed: `${this.providerId}:${this.modelName}`,
        retrievedChunkCount: ragContext.retrievedCount,
      };
    }

    const systemPrompt = `You are BucketSpace's Personal Knowledge Assistant.
Answer the user's question EXCLUSIVELY based on the provided context sources below.

Strict Rules:
1. Do NOT manufacture, infer, or extrapolate facts outside the provided sources.
2. If the sources do NOT contain enough information to answer the question, state EXACTLY: "I couldn't find enough evidence in your stored files to answer this question."
3. Cite sources in your answer using [Source 1], [Source 2], etc.

Context Sources:
${ragContext.formattedContext}`;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response: string };
      const rawAnswer = data.response.trim();

      const isInsufficient = rawAnswer.includes("couldn't find enough evidence");

      return {
        answer: rawAnswer,
        citations: isInsufficient ? [] : ragContext.citations,
        hasSufficientEvidence: !isInsufficient,
        modelUsed: `${this.providerId}:${this.modelName}`,
        retrievedChunkCount: ragContext.retrievedCount,
      };
    } catch (err: unknown) {
      // Fallback if local Ollama is offline/unreachable
      const msg = err instanceof Error ? err.message : 'Ollama connection failed';
      return {
        answer: `Local Ollama model unavailable (${msg}). Retrying with fallback grounding: ${ragContext.citations[0]?.snippet || 'No snippet'}`,
        citations: ragContext.citations,
        hasSufficientEvidence: true,
        modelUsed: `${this.providerId}:${this.modelName}:fallback`,
        retrievedChunkCount: ragContext.retrievedCount,
      };
    }
  }
}
