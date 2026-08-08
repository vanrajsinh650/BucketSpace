import { prisma } from '@bucketspace/db';
import { CreateLifecycleRuleInput } from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  Automated Lifecycle Migration & Policy Execution Engine            */
/* ------------------------------------------------------------------ */

export class LifecycleEngineService {
  /**
   * Creates a new lifecycle migration rule.
   */
  public async createRule(input: CreateLifecycleRuleInput) {
    return prisma.lifecycleRule.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        sourceBucketId: input.sourceBucketId ?? null,
        targetProvider: input.targetProvider,
        minAgeDays: input.minAgeDays,
        minSizeBytes: BigInt(input.minSizeBytes),
        action: input.action,
        enabled: input.enabled,
      },
    });
  }

  /**
   * Lists all lifecycle rules for a workspace.
   */
  public async listRules(workspaceId: string) {
    return prisma.lifecycleRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Executes a lifecycle rule immediately across eligible files.
   */
  public async executeRule(ruleId: string): Promise<{ itemsProcessed: number; bytesAffected: number }> {
    const rule = await prisma.lifecycleRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error(`Lifecycle rule ${ruleId} not found`);
    }

    if (!rule.enabled) {
      throw new Error(`Lifecycle rule "${rule.name}" is disabled`);
    }

    // Calculate age threshold date
    const ageThresholdDate = new Date();
    ageThresholdDate.setDate(ageThresholdDate.getDate() - rule.minAgeDays);

    // Find eligible files
    const eligibleFiles = await prisma.fileObject.findMany({
      where: {
        workspaceId: rule.workspaceId,
        status: 'PROCESSED',
        createdAt: { lte: ageThresholdDate },
        sizeBytes: { gte: rule.minSizeBytes },
        ...(rule.sourceBucketId ? { bucketId: rule.sourceBucketId } : {}),
      },
      include: { bucket: true },
    });

    let itemsProcessed = 0;
    let itemsFailed = 0;
    let bytesAffected = BigInt(0);

    if (rule.action === 'DELETE') {
      // Soft-delete: marks files as DELETED in the database and removes chunk
      // records. Actual provider object cleanup is deferred to a separate
      // garbage-collection worker to preserve audit trail integrity.
      for (const file of eligibleFiles) {
        try {
          await prisma.fileChunk.deleteMany({ where: { fileId: file.id } });
          await prisma.fileObject.update({
            where: { id: file.id },
            data: { status: 'DELETED' },
          });
          itemsProcessed += 1;
          bytesAffected += file.sizeBytes;
        } catch (err) {
          itemsFailed += 1;
          console.error(`[LifecycleEngine] Failed to soft-delete file ${file.id}:`, err);
        }
      }
    } else if (rule.action === 'MIGRATE' || rule.action === 'ARCHIVE') {
      // Find destination bucket matching targetProvider
      let destBucket = await prisma.bucket.findFirst({
        where: {
          workspaceId: rule.workspaceId,
          provider: rule.targetProvider,
        },
      });

      if (!destBucket) {
        // Create auto lifecycle target bucket if it doesn't exist
        destBucket = await prisma.bucket.create({
          data: {
            workspaceId: rule.workspaceId,
            name: `Lifecycle-Target-${rule.targetProvider.toLowerCase()}`,
            provider: rule.targetProvider,
            targetChannelId: 'auto-lifecycle-channel',
            encryptedCredentials: 'enc-lifecycle-auto',
          },
        });
      }

      // Logical migration: reassigns the file's bucket pointer in the database.
      // Physical chunk replication should be handled via the SyncEngineService
      // after the logical migration completes. This separation ensures atomic
      // DB updates while allowing async chunk streaming.
      for (const file of eligibleFiles) {
        if (file.bucketId === destBucket.id) continue;

        try {
          await prisma.fileObject.update({
            where: { id: file.id },
            data: { bucketId: destBucket.id },
          });
          itemsProcessed += 1;
          bytesAffected += file.sizeBytes;
        } catch (err) {
          itemsFailed += 1;
          console.error(`[LifecycleEngine] Failed to migrate file ${file.id}:`, err);
        }
      }
    }

    // Log lifecycle rule execution in audit log
    await prisma.auditLog.create({
      data: {
        workspaceId: rule.workspaceId,
        actorUserId: '00000000-0000-0000-0000-000000000000',
        action: 'LIFECYCLE_RULE_EXECUTED',
        resource: `LifecycleRule:${rule.id}`,
        ipAddress: '127.0.0.1',
        metadata: {
          ruleName: rule.name,
          action: rule.action,
          targetProvider: rule.targetProvider,
          itemsProcessed,
          itemsFailed,
          bytesAffected: bytesAffected.toString(),
        },
      },
    });

    return { itemsProcessed, bytesAffected: Number(bytesAffected) };
  }
}

export const lifecycleEngineService = new LifecycleEngineService();
