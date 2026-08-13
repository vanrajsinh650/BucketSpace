import { SqliteMetadataRepository } from '@bucketspace/db';
import { AssistantResponse, ILLMProvider } from '@bucketspace/shared';
import { HybridSearchEngine } from '../search/hybrid-search-engine';
import { MockLLMProvider } from './mock-llm-provider';

/**
 * AssistantService orchestrates the end-to-end Grounded RAG workflow:
 *   1. Performs Hybrid RRF Search (BM25 + Semantic Vectors)
 *   2. Resolves source file names
 *   3. Evaluates evidence sufficiency & context formatting
 *   4. Generates source-grounded response with page/timestamp citations
 */
export class AssistantService {
  private llmProvider: ILLMProvider;

  constructor(
    private readonly hybridEngine: HybridSearchEngine,
    private readonly metadataRepo: SqliteMetadataRepository,
    llmProvider?: ILLMProvider
  ) {
    this.llmProvider = llmProvider ?? new MockLLMProvider();
  }

  /** Set active LLM provider (MockLLMProvider, OllamaLLMProvider, OpenAI, Gemini) */
  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  /** Get active LLM provider */
  public getLLMProvider(): ILLMProvider {
    return this.llmProvider;
  }

  /**
   * Submit a user question: executes hybrid RRF retrieval, applies grounding checks,
   * calls LLM provider, and returns AssistantResponse with citations.
   *
   * @param authorizedFileIds - Optional set of file IDs the caller is authorized to access.
   *   When provided, the LLM will ONLY see context from these files. Authorization is
   *   enforced at the application level, never delegated to the LLM.
   */
  public async ask(
    question: string,
    limit: number = 5,
    authorizedFileIds?: Set<string>
  ): Promise<AssistantResponse> {
    if (!question.trim()) {
      return {
        answer: "Please provide a valid question.",
        citations: [],
        hasSufficientEvidence: false,
        modelUsed: this.llmProvider.providerId,
        retrievedChunkCount: 0,
      };
    }

    // 1. Execute Hybrid RRF Search (scoped to authorized files only)
    const searchHits = await this.hybridEngine.searchHybrid(question, limit, authorizedFileIds);

    // 2. Resolve source file names
    const fileNamesMap = new Map<string, string>();
    for (const hit of searchHits) {
      const meta = await this.metadataRepo.getFileById(hit.fileId);
      if (meta) {
        fileNamesMap.set(hit.fileId as string, meta.name);
      }
    }

    // 3. Generate Grounded Response via LLM Provider
    return this.llmProvider.generateResponse(question, searchHits, fileNamesMap);
  }
}
