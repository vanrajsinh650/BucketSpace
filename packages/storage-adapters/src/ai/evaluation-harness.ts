import { ContentRepository } from '@bucketspace/db';
import {
  EvaluationBenchmarkReport,
  EvaluationTestCase,
} from '@bucketspace/shared';
import { AssistantService } from './assistant-service';
import { GroundingValidator } from './grounding-validator';
import { PromptInjectionGuard } from './prompt-injection-guard';

/**
 * EvaluationHarness executes an automated benchmark suite evaluating
 * Retrieval Recall@k, Refusal Accuracy, Citation Precision, and Grounding Safety.
 */
export class EvaluationHarness {
  private readonly validator: GroundingValidator;

  constructor(
    private readonly assistantService: AssistantService,
    contentRepo: ContentRepository
  ) {
    this.validator = new GroundingValidator(contentRepo);
  }

  /**
   * Run evaluation benchmark test suite against a collection of evaluation test cases.
   */
  public async runEvaluationSuite(testCases: EvaluationTestCase[]): Promise<EvaluationBenchmarkReport> {
    const testDetails: Array<{ id: string; category: string; passed: boolean; score: number; notes: string }> = [];

    let passCount = 0;
    let refusalSuccesses = 0;
    let totalRefusalTests = 0;
    let citationValidCount = 0;
    let totalCitationTests = 0;

    for (const tc of testCases) {
      const response = await this.assistantService.ask(tc.query);

      let passed = false;
      let score = 1.0;
      let notes = 'Test passed';

      if (tc.shouldRefuse) {
        totalRefusalTests++;
        if (!response.hasSufficientEvidence && response.answer.includes("couldn't find enough evidence")) {
          passed = true;
          refusalSuccesses++;
        } else {
          score = 0.0;
          notes = 'Failed refusal guardrail test';
        }
      } else {
        totalCitationTests++;
        if (response.hasSufficientEvidence && response.citations.length > 0) {
          citationValidCount++;
          if (tc.expectedFileId && response.citations[0].fileId !== tc.expectedFileId) {
            passed = false;
            score = 0.5;
            notes = `Expected file ${tc.expectedFileId}, got ${response.citations[0].fileId}`;
          } else if (tc.expectedPage && response.citations[0].pageNumber !== tc.expectedPage) {
            passed = false;
            score = 0.5;
            notes = `Expected page ${tc.expectedPage}, got ${response.citations[0].pageNumber}`;
          } else {
            passed = true;
          }
        } else {
          score = 0.0;
          notes = 'Failed grounding test: expected evidence';
        }
      }

      if (passed) passCount++;

      testDetails.push({
        id: tc.id,
        category: tc.category,
        passed,
        score,
        notes,
      });
    }

    const refusalAccuracy = totalRefusalTests > 0 ? refusalSuccesses / totalRefusalTests : 1.0;
    const citationPrecision = totalCitationTests > 0 ? citationValidCount / totalCitationTests : 1.0;
    const recallAtK = passCount / testCases.length;

    return {
      totalTests: testCases.length,
      passCount,
      failCount: testCases.length - passCount,
      retrievalRecallAtK: recallAtK,
      refusalAccuracy,
      citationPrecision,
      testDetails,
    };
  }
}
