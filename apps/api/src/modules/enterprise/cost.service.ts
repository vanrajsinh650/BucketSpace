import { prisma } from '@bucketspace/db';
import {
  MultiCloudCostAnalyticsResponse,
  ProviderCostItem,
  CostRecommendationItem,
} from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  Multi-Cloud Cost Analytics & Optimization Service                */
/* ------------------------------------------------------------------ */

// Monthly storage rates per GB (USD)
const PROVIDER_RATES: Record<string, number> = {
  TELEGRAM_DRIVE: 0.0, // 100% Free Telegram Channel Storage
  AWS_S3: 0.023, // AWS S3 Standard
  CLOUDFLARE_R2: 0.015, // Cloudflare R2 (0 Egress Fees)
  GCP_STORAGE: 0.02, // GCP Standard Storage
  AZURE_BLOB: 0.018, // Azure Hot Blob Storage
  MINIO: 0.005, // Self-hosted MinIO infrastructure estimate
};

export class MultiCloudCostService {
  /**
   * Analyzes current storage breakdown across providers for a workspace
   * and calculates cost optimization recommendations.
   */
  public async getWorkspaceCostAnalytics(
    workspaceId: string
  ): Promise<MultiCloudCostAnalyticsResponse> {
    const buckets = await prisma.bucket.findMany({
      where: { workspaceId },
      include: {
        files: {
          where: { status: 'PROCESSED' },
          select: { sizeBytes: true, createdAt: true, mimeType: true },
        },
      },
    });

    const providerMap = new Map<
      string,
      { totalSizeBytes: bigint; totalFiles: number }
    >();

    let totalSizeBytesAll = BigInt(0);
    let totalFilesAll = 0;

    // Aggregate storage by provider
    for (const bucket of buckets) {
      const provider = bucket.provider;
      const existing = providerMap.get(provider) || {
        totalSizeBytes: BigInt(0),
        totalFiles: 0,
      };

      for (const file of bucket.files) {
        existing.totalSizeBytes += file.sizeBytes;
        existing.totalFiles += 1;
        totalSizeBytesAll += file.sizeBytes;
        totalFilesAll += 1;
      }

      providerMap.set(provider, existing);
    }

    const providers: ProviderCostItem[] = [];
    let totalMonthlyCostUsd = 0;

    for (const [provider, stats] of providerMap.entries()) {
      const rate = PROVIDER_RATES[provider] ?? 0.02;
      const gbSize = Number(stats.totalSizeBytes) / (1024 * 1024 * 1024);
      const monthlyCost = parseFloat((gbSize * rate).toFixed(2));

      totalMonthlyCostUsd += monthlyCost;

      providers.push({
        provider,
        totalSizeBytes: Number(stats.totalSizeBytes),
        totalFiles: stats.totalFiles,
        ratePerGbMonth: rate,
        estimatedMonthlyCostUsd: monthlyCost,
      });
    }

    // Generate automated cost optimization recommendations
    const recommendations: CostRecommendationItem[] = [];
    let potentialMonthlySavingsUsd = 0;

    // Check for paid cloud files eligible for Telegram Drive migration
    let paidCloudBytes = BigInt(0);
    let paidCloudFiles = 0;

    for (const [provider, stats] of providerMap.entries()) {
      if (provider !== 'TELEGRAM_DRIVE') {
        paidCloudBytes += stats.totalSizeBytes;
        paidCloudFiles += stats.totalFiles;
      }
    }

    if (paidCloudBytes > BigInt(0)) {
      const paidGb = Number(paidCloudBytes) / (1024 * 1024 * 1024);
      const savings = parseFloat((paidGb * 0.02).toFixed(2));
      potentialMonthlySavingsUsd += savings;

      recommendations.push({
        id: 'rec-telegram-migration',
        title: 'Migrate Cold Assets to Free Telegram Cloud Drive',
        description: `Move ${paidCloudFiles} file(s) (${(paidGb).toFixed(
          1
        )} GB) from paid cloud providers to Telegram Channel Storage to eliminate storage fees.`,
        potentialMonthlySavingsUsd: savings,
        actionType: 'MIGRATE_TO_TELEGRAM',
        affectedFilesCount: paidCloudFiles,
        affectedSizeBytes: Number(paidCloudBytes),
      });
    }

    // Check for Cloudflare R2 zero-egress opportunity
    const s3Stats = providerMap.get('AWS_S3');
    if (s3Stats && s3Stats.totalSizeBytes > BigInt(0)) {
      const s3Gb = Number(s3Stats.totalSizeBytes) / (1024 * 1024 * 1024);
      const r2Savings = parseFloat((s3Gb * (0.023 - 0.015)).toFixed(2));
      if (r2Savings > 0) {
        recommendations.push({
          id: 'rec-r2-egress',
          title: 'Switch AWS S3 to Cloudflare R2 for Zero Egress',
          description: `Replicate ${s3Stats.totalFiles} AWS S3 objects to Cloudflare R2 to save on egress bandwidth charges.`,
          potentialMonthlySavingsUsd: r2Savings,
          actionType: 'ENABLE_R2',
          affectedFilesCount: s3Stats.totalFiles,
          affectedSizeBytes: Number(s3Stats.totalSizeBytes),
        });
      }
    }

    return {
      statusCode: 200,
      workspaceId,
      totalSizeBytes: Number(totalSizeBytesAll),
      totalFiles: totalFilesAll,
      totalMonthlyCostUsd: parseFloat(totalMonthlyCostUsd.toFixed(2)),
      potentialMonthlySavingsUsd: parseFloat(
        potentialMonthlySavingsUsd.toFixed(2)
      ),
      providers,
      recommendations,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const multiCloudCostService = new MultiCloudCostService();
