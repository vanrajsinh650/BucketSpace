import { DatabaseSync } from 'node:sqlite';

export type AuditEventType =
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SHARE_CREATED'
  | 'SHARE_ACCESSED'
  | 'SHARE_REVOKED'
  | 'PROVIDER_ADDED'
  | 'PROVIDER_REMOVED'
  | 'CREDENTIAL_ROTATED'
  | 'FILE_MOVED'
  | 'FILE_PURGED'
  | 'REPAIR_STARTED'
  | 'REPAIR_COMPLETED';

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  actor: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

interface AuditRow {
  id: string;
  event_type: string;
  actor: string;
  details_json: string;
  timestamp: string;
}

/**
 * AuditLogRepository manages an append-only audit trail in SQLite for security,
 * compliance, and system transparency across operations.
 */
export class AuditLogRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Record a new audit log event */
  public logEvent(
    eventType: AuditEventType,
    details: Record<string, unknown>,
    actor: string = 'SYSTEM'
  ): AuditLogEntry {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, event_type, actor, details_json, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, eventType, actor, JSON.stringify(details), now.toISOString());

    return {
      id,
      eventType,
      actor,
      details,
      timestamp: now,
    };
  }

  /** List audit events with optional filtering */
  public listEvents(filter?: { eventType?: AuditEventType; limit?: number }): AuditLogEntry[] {
    const limit = filter?.limit ?? 100;

    let rows: AuditRow[];
    if (filter?.eventType) {
      const stmt = this.db.prepare(
        'SELECT * FROM audit_logs WHERE event_type = ? ORDER BY timestamp DESC LIMIT ?'
      );
      rows = (stmt.all(filter.eventType, limit) as unknown) as AuditRow[];
    } else {
      const stmt = this.db.prepare(
        'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?'
      );
      rows = (stmt.all(limit) as unknown) as AuditRow[];
    }

    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type as AuditEventType,
      actor: r.actor,
      details: JSON.parse(r.details_json) as Record<string, unknown>,
      timestamp: new Date(r.timestamp),
    }));
  }

  /** Get total count of audit logs */
  public countEvents(eventType?: AuditEventType): number {
    if (eventType) {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE event_type = ?');
      const row = (stmt.get(eventType) as unknown) as { count: number };
      return row.count;
    }
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs');
    const row = (stmt.get() as unknown) as { count: number };
    return row.count;
  }
}
