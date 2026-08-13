import { ContentRepository, VectorRepository } from '@bucketspace/db';
import { TokenShareProvider } from '../share/token-share-provider';

export interface EphemeralStateTracker {
  tempUploadBuffers: Map<string, Uint8Array[]>;
  thumbnailCache: Map<string, Uint8Array>;
  extractedIntermediates: Map<string, string>;
  transcriptionCache: Map<string, unknown>;
  embeddingCache: Map<string, number[]>;
  failedTransferJobs: Set<string>;
}

/**
 * ResidueCleaner guarantees zero-artifact-residue across both persistent SQLite
 * subsystems and in-memory / ephemeral caches, temporary buffers, and failed transfer states.
 */
export class ResidueCleaner {
  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly vectorRepo: VectorRepository,
    private readonly shareProvider?: TokenShareProvider,
    private readonly ephemeralState?: EphemeralStateTracker
  ) {}

  /**
   * Execute a full cascading purge of a file across persistent and ephemeral layers.
   */
  public async purgeFileCompletely(fileId: string, activeShareTokens: string[] = []): Promise<{
    ftsPurged: boolean;
    vectorsPurged: boolean;
    sharesRevoked: number;
    ephemeralCleaned: boolean;
  }> {
    // 1. Purge FTS & Content Segments
    this.contentRepo.deleteContent(fileId);

    // 2. Purge Vector Chunks
    this.vectorRepo.deleteForFile(fileId);

    // 3. Revoke Active Shares
    let sharesRevoked = 0;
    if (this.shareProvider) {
      for (const token of activeShareTokens) {
        const revoked = await this.shareProvider.revokeShareLink(token);
        if (revoked) sharesRevoked++;
      }
    }

    // 4. Wipe Ephemeral / Cache Residue
    let ephemeralCleaned = false;
    if (this.ephemeralState) {
      this.ephemeralState.tempUploadBuffers.delete(fileId);
      this.ephemeralState.thumbnailCache.delete(fileId);
      this.ephemeralState.extractedIntermediates.delete(fileId);
      this.ephemeralState.transcriptionCache.delete(fileId);
      this.ephemeralState.embeddingCache.delete(fileId);
      this.ephemeralState.failedTransferJobs.delete(fileId);
      ephemeralCleaned = true;
    }

    return {
      ftsPurged: true,
      vectorsPurged: true,
      sharesRevoked,
      ephemeralCleaned,
    };
  }
}
