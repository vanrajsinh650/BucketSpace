import { prisma } from '@bucketspace/db';
import { StorageAdapterFactory } from '../media/storage-adapter.factory';
import { streamToBuffer } from '@bucketspace/storage-adapters';

/* ------------------------------------------------------------------ */
/*  Cross-Cloud Automated Sync & Replication Engine                    */
/* ------------------------------------------------------------------ */

export class SyncEngineService {
  /**
   * Triggers immediate execution of a SyncPolicy.
   * Replicates all PROCESSED files from source bucket to destination bucket.
   */
  public async executePolicy(policyId: string): Promise<string> {
    const policy = await prisma.syncPolicy.findUnique({
      where: { id: policyId },
      include: {
        workspace: true,
      },
    });

    if (!policy) {
      throw new Error(`Sync policy ${policyId} not found`);
    }

    if (!policy.enabled) {
      throw new Error(`Sync policy "${policy.name}" is currently disabled`);
    }

    // Look up source and destination buckets
    const sourceBucket = await prisma.bucket.findUnique({
      where: { id: policy.sourceBucketId },
    });
    const destBucket = await prisma.bucket.findUnique({
      where: { id: policy.destinationBucketId },
    });

    if (!sourceBucket || !destBucket) {
      throw new Error('Source or destination bucket no longer exists');
    }

    // Create a new SyncJob record
    const syncJob = await prisma.syncJob.create({
      data: {
        policyId,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Run replication asynchronously to avoid blocking API request
    this.runReplicationJob(syncJob.id, policy, sourceBucket, destBucket).catch((err) => {
      console.error(`[SyncEngineService] Sync job ${syncJob.id} failed:`, err);
    });

    return syncJob.id;
  }

  /**
   * Internal worker function that executes chunk-by-chunk cross-cloud copy.
   */
  private async runReplicationJob(
    jobId: string,
    policy: { id: string; workspaceId: string; conflictStrategy: string },
    sourceBucket: { id: string; provider: string; targetChannelId: string },
    destBucket: { id: string; provider: string; targetChannelId: string }
  ): Promise<void> {
    try {
      // Fetch all eligible source files
      const sourceFiles = await prisma.fileObject.findMany({
        where: {
          bucketId: sourceBucket.id,
          status: 'PROCESSED',
        },
        include: {
          chunks: { orderBy: { chunkIndex: 'asc' } },
        },
      });

      await prisma.syncJob.update({
        where: { id: jobId },
        data: { itemsTotal: sourceFiles.length },
      });

      const sourceAdapter = StorageAdapterFactory.create(sourceBucket.provider);
      const destAdapter = StorageAdapterFactory.create(destBucket.provider);

      let itemsSynced = 0;
      let itemsSkipped = 0;
      let totalBytesTransferred = BigInt(0);

      for (const file of sourceFiles) {
        // Check if file already exists in destination bucket
        const existingDestFile = await prisma.fileObject.findFirst({
          where: {
            bucketId: destBucket.id,
            filename: file.filename,
          },
        });

        if (existingDestFile && policy.conflictStrategy === 'SKIP') {
          itemsSkipped += 1;
          continue;
        }

        // OVERWRITE: delete existing destination file and its chunks first
        if (existingDestFile && policy.conflictStrategy === 'OVERWRITE') {
          await prisma.fileChunk.deleteMany({ where: { fileId: existingDestFile.id } });
          await prisma.fileObject.delete({ where: { id: existingDestFile.id } });
        }

        // Create or overwrite destination file record
        const destFileObject = await prisma.fileObject.create({
          data: {
            workspaceId: policy.workspaceId,
            bucketId: destBucket.id,
            filename: file.filename,
            sizeBytes: file.sizeBytes,
            mimeType: file.mimeType,
            sha256Hash: file.sha256Hash,
            status: 'UPLOADING',
          },
        });

        let fileBytesCopied = BigInt(0);

        for (const chunk of file.chunks) {
          // Download chunk stream from source adapter
          const chunkStream = await sourceAdapter.getChunkStream(
            sourceBucket.targetChannelId,
            chunk.providerRef
          );

          const chunkBuffer = await streamToBuffer(chunkStream, undefined, 'SyncEngine');

          // Upload chunk buffer to destination adapter
          const uploadResult = await destAdapter.uploadChunk(destBucket.targetChannelId, {
            chunkIndex: chunk.chunkIndex,
            partBuffer: chunkBuffer,
            filename: destFileObject.filename,
            mimeType: destFileObject.mimeType,
          });

          // Save destination chunk record
          await prisma.fileChunk.create({
            data: {
              fileId: destFileObject.id,
              chunkIndex: uploadResult.chunkIndex,
              providerRef: uploadResult.providerRef,
              providerMeta: uploadResult.providerMeta as Record<string, string | number>,
              partSizeBytes: BigInt(uploadResult.sizeBytes),
            },
          });

          fileBytesCopied += BigInt(uploadResult.sizeBytes);
        }

        // Mark destination file PROCESSED
        await prisma.fileObject.update({
          where: { id: destFileObject.id },
          data: { status: 'PROCESSED' },
        });

        itemsSynced += 1;
        totalBytesTransferred += fileBytesCopied;

        // Update progress in SyncJob table
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            itemsSynced,
            itemsTotal: sourceFiles.length - itemsSkipped,
            bytesTransferred: totalBytesTransferred,
          },
        });
      }

      // Mark Job COMPLETED
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          workspaceId: policy.workspaceId,
          actorUserId: '00000000-0000-0000-0000-000000000000',
          action: 'CROSS_CLOUD_SYNC_COMPLETED',
          resource: `Policy:${policy.id}`,
          ipAddress: '127.0.0.1',
          metadata: {
            jobId,
            itemsSynced,
            bytesTransferred: totalBytesTransferred.toString(),
            sourceProvider: sourceBucket.provider,
            destProvider: destBucket.provider,
          },
        },
      });
    } catch (err) {
      // Guard: if this DB update itself fails (e.g., connection lost),
      // log the error but don't crash the Node process.
      try {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            errorMessage: (err as Error).message || 'Cross-cloud replication error',
          },
        });
      } catch (updateErr) {
        console.error(`[SyncEngineService] Failed to mark job ${jobId} as FAILED:`, updateErr);
      }
    }
  }
}

export const syncEngineService = new SyncEngineService();
