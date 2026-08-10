/* ─── Storage Rule Domain Types ─── */

/**
 * Fields that a rule condition can evaluate against.
 * - mimeType: the file's MIME type string (e.g., "image/jpeg")
 * - extension: the file's extension derived from its name (e.g., "pdf")
 * - size: the file's size in bytes
 */
export type ConditionField = 'mimeType' | 'extension' | 'size';

/**
 * Operators for condition evaluation.
 * String operators work on mimeType and extension fields.
 * Numeric operators work on the size field.
 */
export type ConditionOperator =
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

/** A single condition within a storage rule. ALL conditions in a rule use AND logic. */
export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string; // For size: string-encoded bytes, e.g. "1073741824" for 1GB
}

/** The action to take when a rule matches. Currently only STORE is supported. */
export interface StorageRuleAction {
  type: 'STORE';
  providerId: string;
}

/**
 * A user-defined storage routing rule.
 * Rules are data, not code — they are persisted in SQLite and evaluated
 * deterministically by the StoragePolicyEngine in priority order (highest first).
 */
export interface StorageRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  action: StorageRuleAction;
  createdAt: Date;
  updatedAt: Date;
}

/** File metadata subset used for rule evaluation (no chunk/provider details needed) */
export interface FileRoutingInfo {
  name: string;
  mimeType: string;
  size: number;
}
