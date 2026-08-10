import { DatabaseSync } from 'node:sqlite';
import {
  RuleCondition,
  StorageRule,
  StorageRuleAction,
} from '@bucketspace/shared';

interface RuleRow {
  id: string;
  name: string;
  priority: number;
  enabled: number;
  conditions_json: string;
  action_json: string;
  created_at: string;
  updated_at: string;
}

/**
 * StorageRuleRepository persists user-defined storage routing rules in SQLite.
 * Rules are stored as JSON-serialized conditions and actions, with explicit priority ordering.
 */
export class StorageRuleRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** Create a new rule */
  public createRule(rule: StorageRule): StorageRule {
    const stmt = this.db.prepare(`
      INSERT INTO storage_rules (id, name, priority, enabled, conditions_json, action_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      rule.id,
      rule.name,
      rule.priority,
      rule.enabled ? 1 : 0,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.action),
      rule.createdAt.toISOString(),
      rule.updatedAt.toISOString(),
    );

    return rule;
  }

  /** Update an existing rule */
  public updateRule(rule: StorageRule): StorageRule {
    const stmt = this.db.prepare(`
      UPDATE storage_rules
      SET name = ?, priority = ?, enabled = ?, conditions_json = ?, action_json = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      rule.name,
      rule.priority,
      rule.enabled ? 1 : 0,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.action),
      new Date().toISOString(),
      rule.id,
    );

    return rule;
  }

  /** Delete a rule by ID */
  public deleteRule(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM storage_rules WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes ?? 0) > 0;
  }

  /** Get a single rule by ID */
  public getRuleById(id: string): StorageRule | null {
    const stmt = this.db.prepare('SELECT * FROM storage_rules WHERE id = ?');
    const row = (stmt.get(id) as unknown) as RuleRow | undefined;
    return row ? this.rowToRule(row) : null;
  }

  /** List all rules, sorted by priority descending (highest first) */
  public listRules(): StorageRule[] {
    const stmt = this.db.prepare('SELECT * FROM storage_rules ORDER BY priority DESC');
    const rows = (stmt.all() as unknown) as RuleRow[];
    return rows.map((row) => this.rowToRule(row));
  }

  /** Enable or disable a rule */
  public setRuleEnabled(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare('UPDATE storage_rules SET enabled = ?, updated_at = ? WHERE id = ?');
    const result = stmt.run(enabled ? 1 : 0, new Date().toISOString(), id);
    return (result.changes ?? 0) > 0;
  }

  /**
   * Disable all rules that target a specific provider.
   * Called when a provider is removed to prevent orphaned routing rules.
   */
  public disableRulesByProvider(providerId: string): number {
    const rules = this.listRules();
    let count = 0;

    for (const rule of rules) {
      if (rule.action.providerId === providerId && rule.enabled) {
        this.setRuleEnabled(rule.id, false);
        count++;
      }
    }

    return count;
  }

  private rowToRule(row: RuleRow): StorageRule {
    return {
      id: row.id,
      name: row.name,
      priority: row.priority,
      enabled: row.enabled === 1,
      conditions: JSON.parse(row.conditions_json) as RuleCondition[],
      action: JSON.parse(row.action_json) as StorageRuleAction,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
