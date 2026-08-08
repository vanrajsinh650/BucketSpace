import crypto from 'crypto';
import { prisma } from '@bucketspace/db';
import { ComplianceAuditReport, ComplianceAuditLogEntry } from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  SOC 2 & HIPAA Compliance Audit Log Export Engine                  */
/* ------------------------------------------------------------------ */

const HMAC_SECRET = process.env.COMPLIANCE_HMAC_SECRET || 'bucketspace-compliance-audit-secret-key-2026';

export class ComplianceAuditService {
  /**
   * Generates a tamper-evident SOC 2 / HIPAA compliance audit report.
   * Computes SHA-256 HMAC signatures over sequential log entries to form
   * a verified cryptographic chain of custody.
   */
  public async generateComplianceReport(
    workspaceId: string,
    startDate?: string,
    endDate?: string,
    actorUserId?: string,
    action?: string
  ): Promise<ComplianceAuditReport> {
    const whereClause: Record<string, unknown> = { workspaceId };

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate && !isNaN(Date.parse(startDate))) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate && !isNaN(Date.parse(endDate))) {
        dateFilter.lte = new Date(endDate);
      }
      if (Object.keys(dateFilter).length > 0) {
        whereClause.createdAt = dateFilter;
      }
    }

    if (actorUserId) {
      whereClause.actorUserId = actorUserId;
    }

    if (action) {
      whereClause.action = action;
    }

    const rawLogs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    let prevHmac = 'CHAIN_START_ROOT_HMAC_SEED';
    const processedLogs: ComplianceAuditLogEntry[] = [];

    for (const log of rawLogs) {
      const entryPayload = `${log.id}|${log.workspaceId}|${log.actorUserId}|${log.action}|${log.resource}|${log.createdAt.toISOString()}|${prevHmac}`;
      const entryHmacHash = crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(entryPayload)
        .digest('hex');

      prevHmac = entryHmacHash;

      processedLogs.push({
        id: log.id,
        workspaceId: log.workspaceId,
        actorUserId: log.actorUserId,
        action: log.action,
        resource: log.resource,
        ipAddress: log.ipAddress,
        metadata: (log.metadata as Record<string, unknown>) || {},
        createdAt: log.createdAt.toISOString(),
        entryHmacHash,
      });
    }

    // Final report chain signature
    const finalReportHmac = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`REPORT|${workspaceId}|${processedLogs.length}|${prevHmac}`)
      .digest('hex');

    return {
      reportHeader: {
        reportId: `REP-${crypto.randomUUID()}`,
        workspaceId,
        generatedAt: new Date().toISOString(),
        frameworkStandard: 'SOC2_TYPE_II',
        totalEntries: processedLogs.length,
        chainOfCustodyHmacSignature: finalReportHmac,
      },
      logs: processedLogs,
    };
  }

  /**
   * Exports the compliance report to CSV format for external auditors.
   */
  public convertToCsv(report: ComplianceAuditReport): string {
    const headers = [
      'LogId',
      'Timestamp',
      'ActorUserId',
      'Action',
      'Resource',
      'IpAddress',
      'EntryHmacHash',
    ];

    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const rows = report.logs.map((log: ComplianceAuditLogEntry) => [
      escapeCsv(log.id),
      escapeCsv(log.createdAt),
      escapeCsv(log.actorUserId),
      escapeCsv(log.action),
      escapeCsv(log.resource),
      escapeCsv(log.ipAddress),
      escapeCsv(log.entryHmacHash),
    ]);

    return [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
  }
}

export const complianceAuditService = new ComplianceAuditService();
