import {
  FileRoutingInfo,
  RuleCondition,
  StorageRule,
} from '@bucketspace/shared';
import { matchesCondition, matchesRule } from './rule-matcher';

/* ─── Types ─── */

export interface ConditionResult {
  condition: RuleCondition;
  passed: boolean;
}

export interface PolicyEvaluationResult {
  matched: boolean;
  rule?: StorageRule;
  providerId: string;
  matchedConditions?: ConditionResult[];
}

/* ─── Engine ─── */

/**
 * StoragePolicyEngine evaluates user-defined storage rules deterministically.
 *
 * Evaluation order:
 * 1. Filter to enabled rules only
 * 2. Sort by priority descending (highest priority first)
 * 3. Evaluate each rule's conditions (AND logic within a rule)
 * 4. Return the FIRST matching rule's action.providerId
 * 5. If no rules match, return defaultProviderId
 *
 * This is a stateless evaluator — it does not own the rules.
 * Rules are loaded from whatever storage the caller provides (SQLite, in-memory, etc.).
 */
export class StoragePolicyEngine {

  /**
   * Evaluate a list of rules against a file's routing info.
   * Returns a detailed result including which rule matched and which conditions passed.
   */
  public evaluate(
    rules: StorageRule[],
    fileInfo: FileRoutingInfo,
    defaultProviderId: string,
  ): PolicyEvaluationResult {
    // Filter enabled rules and sort by priority descending
    const activeRules = rules
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      // Evaluate each condition and record pass/fail
      const conditionResults: ConditionResult[] = rule.conditions.map((cond) => ({
        condition: cond,
        passed: matchesCondition(cond, fileInfo),
      }));

      const allPassed = conditionResults.length > 0 && conditionResults.every((cr) => cr.passed);

      if (allPassed) {
        return {
          matched: true,
          rule,
          providerId: rule.action.providerId,
          matchedConditions: conditionResults,
        };
      }
    }

    // No rule matched — fall back to default
    return {
      matched: false,
      providerId: defaultProviderId,
    };
  }
}
