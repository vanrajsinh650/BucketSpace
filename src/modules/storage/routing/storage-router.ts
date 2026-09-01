import { FileRoutingInfo, StorageRule } from '@/shared';
import { PolicyEvaluationResult, StoragePolicyEngine } from './storage-policy-engine';
import { ProviderCircuitBreaker } from '../resilience/circuit-breaker';

/**
 * StorageRouter resolves which provider a file should be stored on.
 * It delegates rule evaluation to StoragePolicyEngine, which evaluates
 * user-defined rules deterministically in priority order.
 *
 * Policy-Authoritative Circuit Breaker Integration:
 *   If a matching rule's target provider circuit is OPEN, the router evaluates
 *   remaining policy rules for a healthy authorized alternative. It NEVER
 *   silently violates the storage policy.
 */
export class StorageRouter {
  private defaultProviderId: string;
  private policyEngine: StoragePolicyEngine;
  private rules: StorageRule[];
  private circuitBreaker?: ProviderCircuitBreaker;

  constructor(
    defaultProviderId: string = 'telegram',
    policyEngine?: StoragePolicyEngine,
    circuitBreaker?: ProviderCircuitBreaker,
  ) {
    this.defaultProviderId = defaultProviderId;
    this.policyEngine = policyEngine ?? new StoragePolicyEngine();
    this.circuitBreaker = circuitBreaker;
    this.rules = this.getDefaultRules();
  }

  /** Attach or update the circuit breaker instance */
  public setCircuitBreaker(circuitBreaker: ProviderCircuitBreaker): void {
    this.circuitBreaker = circuitBreaker;
  }

  /** Get the attached circuit breaker */
  public getCircuitBreaker(): ProviderCircuitBreaker | undefined {
    return this.circuitBreaker;
  }

  /** Set the rules to evaluate. Typically loaded from StorageRuleRepository. */
  public setRules(rules: StorageRule[]): void {
    this.rules = rules;
  }

  /** Add a single rule */
  public addRule(rule: StorageRule): void {
    this.rules = [rule, ...this.rules];
  }

  /** Remove a rule by ID */
  public removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get current rules */
  public getRules(): StorageRule[] {
    return [...this.rules];
  }

  /** Clear all rules */
  public clearRules(): void {
    this.rules = [];
  }

  /** Update the default fallback provider */
  public setDefaultProvider(providerId: string): void {
    this.defaultProviderId = providerId;
  }

  /** Get the default fallback provider */
  public getDefaultProviderId(): string {
    return this.defaultProviderId;
  }

  /**
   * Resolve which provider should store a file.
   * Evaluates rules via PolicyEngine. If a target provider's circuit is OPEN,
   * remaining rules are evaluated to find a healthy policy-authorized alternative.
   */
  public resolveProviderId(file: { name: string; mimeType: string; size?: number }): string {
    const fileRoutingInfo: FileRoutingInfo = {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ?? 0,
    };

    // Filter active rules to those targeting healthy providers if circuit breaker is present
    let candidateRules = this.rules;
    if (this.circuitBreaker) {
      candidateRules = this.rules.filter((rule) =>
        this.circuitBreaker!.isAvailable(rule.action.providerId)
      );
    }

    const result = this.policyEngine.evaluate(candidateRules, fileRoutingInfo, this.defaultProviderId);

    // If result points to an unavailable provider (e.g. fallback default is OPEN)
    if (this.circuitBreaker && !this.circuitBreaker.isAvailable(result.providerId)) {
      throw new Error(`Storage policy target '${result.providerId}' is currently unavailable (circuit OPEN)`);
    }

    return result.providerId;
  }

  /**
   * Evaluate rules and return detailed results including which rule matched
   * and which conditions passed/failed. Used for rule preview UI.
   */
  public evaluateDetailed(file: FileRoutingInfo): PolicyEvaluationResult {
    return this.policyEngine.evaluate(this.rules, file, this.defaultProviderId);
  }

  /** Default rules for out-of-the-box system initialization */
  private getDefaultRules(): StorageRule[] {
    const now = new Date('2026-01-01T00:00:00.000Z');
    return [
      {
        id: 'rule-all-telegram',
        name: 'All Files to Telegram Drive',
        priority: 1,
        enabled: true,
        conditions: [],
        action: { type: 'STORE', providerId: 'telegram' },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}
