import { FileRoutingInfo, StorageRule } from '@bucketspace/shared';
import { PolicyEvaluationResult, StoragePolicyEngine } from '../routing/storage-policy-engine';

/**
 * StorageRouter resolves which provider a file should be stored on.
 * It delegates rule evaluation to StoragePolicyEngine, which evaluates
 * user-defined rules deterministically in priority order.
 */
export class StorageRouter {
  private defaultProviderId: string;
  private policyEngine: StoragePolicyEngine;
  private rules: StorageRule[];

  constructor(defaultProviderId: string = 'local-disk', policyEngine?: StoragePolicyEngine) {
    this.defaultProviderId = defaultProviderId;
    this.policyEngine = policyEngine ?? new StoragePolicyEngine();
    this.rules = this.getDefaultRules();
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
   * Evaluates rules via PolicyEngine and returns the first match's providerId,
   * or the defaultProviderId if no rules match.
   */
  public resolveProviderId(file: { name: string; mimeType: string; size?: number }): string {
    const fileRoutingInfo: FileRoutingInfo = {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ?? 0,
    };
    const result = this.evaluateDetailed(fileRoutingInfo);
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
        id: 'rule-photos-telegram',
        name: 'Photos to Telegram',
        priority: 10,
        enabled: true,
        conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
        action: { type: 'STORE', providerId: 'telegram' },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-videos-s3',
        name: 'Videos to S3 / Cloudflare R2',
        priority: 10,
        enabled: true,
        conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'video/' }],
        action: { type: 'STORE', providerId: 's3-r2' },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-docs-pdf',
        name: 'PDF Documents to Supabase',
        priority: 10,
        enabled: true,
        conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
        action: { type: 'STORE', providerId: 'supabase' },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}
