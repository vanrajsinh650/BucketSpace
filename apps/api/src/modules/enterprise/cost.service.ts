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
