import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Lifecycle Policy Schemas                                          */
/* ------------------------------------------------------------------ */

export const LifecycleActionSchema = z.enum(['MIGRATE', 'ARCHIVE', 'DELETE']);
export type LifecycleAction = z.infer<typeof LifecycleActionSchema>;

export const CreateLifecycleRuleSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  sourceBucketId: z.string().uuid().optional(),
  targetProvider: z.enum(['TELEGRAM_DRIVE', 'AWS_S3', 'CLOUDFLARE_R2', 'GCP_STORAGE', 'AZURE_BLOB', 'MINIO']),
  minAgeDays: z.number().int().nonnegative().default(30),
  minSizeBytes: z.number().int().nonnegative().default(0),
  action: LifecycleActionSchema.default('MIGRATE'),
  enabled: z.boolean().default(true),
});

export type CreateLifecycleRuleInput = z.infer<typeof CreateLifecycleRuleSchema>;

/* ------------------------------------------------------------------ */
/*  Cost Analytics Interfaces & Responses                            */
/* ------------------------------------------------------------------ */

export interface ProviderCostItem {
  provider: string;
  totalSizeBytes: number;
  totalFiles: number;
  ratePerGbMonth: number;
  estimatedMonthlyCostUsd: number;
}

export interface CostRecommendationItem {
  id: string;
  title: string;
  description: string;
  potentialMonthlySavingsUsd: number;
  actionType: 'MIGRATE_TO_TELEGRAM' | 'ENABLE_R2' | 'LIFECYCLE_AUTO_DELETE' | 'TIER_COLD_STORAGE';
  affectedFilesCount: number;
  affectedSizeBytes: number;
}

export interface MultiCloudCostAnalyticsResponse {
  statusCode: number;
  workspaceId: string;
  totalSizeBytes: number;
  totalFiles: number;
  totalMonthlyCostUsd: number;
  potentialMonthlySavingsUsd: number;
  providers: ProviderCostItem[];
  recommendations: CostRecommendationItem[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  SOC 2 & HIPAA Compliance Audit Log Export Interfaces              */
/* ------------------------------------------------------------------ */

export const ComplianceExportQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type ComplianceExportQueryInput = z.infer<typeof ComplianceExportQuerySchema>;

export interface ComplianceAuditLogEntry {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  resource: string;
  ipAddress: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  entryHmacHash: string;
}

export interface ComplianceAuditReport {
  reportHeader: {
    reportId: string;
    workspaceId: string;
    generatedAt: string;
    frameworkStandard: 'SOC2_TYPE_II' | 'HIPAA_AUDIT_TRAIL';
    totalEntries: number;
    chainOfCustodyHmacSignature: string;
  };
  logs: ComplianceAuditLogEntry[];
}
