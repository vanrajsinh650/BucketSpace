import { createHash } from 'crypto';
import {
  ChunkLocation,
  ChunkMetadata,
  LocationRole,
  ProviderChunkRef,
} from '@/shared';
import { ChunkLocationRepository } from '@/modules/db';
import { ProviderRegistry } from '../registry/provider-registry';

/* ─── Types ─── */

export interface ReplicationProgress {
  fileId: string;
  targetProviderId: string;
  totalChunks: number;
  copiedChunks: number;
  verifiedChunks: number;
  failedChunks: number;
}

/* ─── Engine ─── */

/**
 * ReplicationEngine copies chunks from a verified source to a target provider.
 *
 * The replication sequence for each chunk is:
 *   1. State → PENDING
 *   2. Read from source provider
 *   3. State → COPYING → write to target provider
 *   4. State → VERIFYING → download from target → SHA-256 compare
 *   5. Hash matches? → VERIFIED
 *      Hash mismatches? → CORRUPTED
 *      Error? → FAILED (retryable)
 *
 * Key invariant: source data is NEVER deleted during replication.
 * Replication is resumable: PENDING/COPYING/FAILED locations are retried.
 */
export class ReplicationEngine {
  constructor(
    private readonly locationRepo: ChunkLocationRepository,
  ) {}

  /**
   * Replicate all chunks of a file to a target provider.
   * Creates REPLICA locations and verifies each one.
   */
  public async replicateFile(
    fileId: string,
    chunks: ChunkMetadata[],
    targetProviderId: string,
    onProgress?: (progress: ReplicationProgress) => void,
  ): Promise<ReplicationProgress> {
    const targetProvider = ProviderRegistry.get(targetProviderId);

    const progress: ReplicationProgress = {
      fileId,
      targetProviderId,
      totalChunks: chunks.length,
      copiedChunks: 0,
      verifiedChunks: 0,
      failedChunks: 0,
    };

    for (const chunk of chunks) {
      const existingLocations = this.locationRepo.getLocationsForChunk(chunk.id as string);

      // Skip if target already has a VERIFIED location
      const targetLoc = existingLocations.find(
        (l) => l.providerId === targetProviderId && l.state === 'VERIFIED'
      );
      if (targetLoc) {
        progress.copiedChunks++;
        progress.verifiedChunks++;
        onProgress?.(progress);
        continue;
      }

      // Find a VERIFIED source to copy from
      const sourceLocation = existingLocations.find(
        (l) => l.state === 'VERIFIED' && l.providerId !== targetProviderId
      );

      if (!sourceLocation) {
        // Try using the PRIMARY providerRef from chunk metadata as fallback
        if (!chunk.providerRef) {
          progress.failedChunks++;
          onProgress?.(progress);
          continue;
        }

        // Use chunk.providerRef as the source directly
        const result = await this.copyAndVerifyChunk(
          chunk,
          chunk.providerRef,
          targetProviderId,
          'REPLICA',
          existingLocations,
        );

        if (result) {
          progress.copiedChunks++;
          progress.verifiedChunks++;
        } else {
          progress.failedChunks++;
        }
        onProgress?.(progress);
        continue;
      }

      // Copy from verified source
      const result = await this.copyAndVerifyChunk(
        chunk,
        sourceLocation.providerRef,
        targetProviderId,
        'REPLICA',
        existingLocations,
      );

      if (result) {
        progress.copiedChunks++;
        progress.verifiedChunks++;
      } else {
        progress.failedChunks++;
      }

      onProgress?.(progress);
    }

    return progress;
  }

  /**
   * Copy a single chunk from source to target, then verify the target.
   * Returns the created ChunkLocation or null on failure.
   */
  private async copyAndVerifyChunk(
    chunk: ChunkMetadata,
    sourceRef: ProviderChunkRef,
    targetProviderId: string,
    role: LocationRole,
    existingLocations: ChunkLocation[],
  ): Promise<ChunkLocation | null> {
    const locationId = `loc-${chunk.id}-${targetProviderId}`;
    const now = new Date();

    // Check if there's already a pending/failed location to resume
    let location = existingLocations.find(
      (l) => l.providerId === targetProviderId
    );

    if (location && (location.state === 'VERIFIED')) {
      return location; // Already done
    }

    // Create or reset the location record
    if (!location) {
      location = {
        id: locationId,
        chunkId: chunk.id as string,
        fileId: chunk.fileId as string,
        providerId: targetProviderId,
        providerRef: { providerId: targetProviderId, reference: null },
        role,
        state: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };
      this.locationRepo.saveLocation(location);
    }

    try {
      // State: COPYING — read source bytes
      this.locationRepo.updateLocationState(location.id, 'COPYING');

      const sourceProvider = ProviderRegistry.get(sourceRef.providerId);
      const sourceStream = await sourceProvider.getChunk(sourceRef);

      // Buffer the entire chunk to re-stream for upload and verification
      const sourceBuffers: Uint8Array[] = [];
      for await (const piece of sourceStream) {
        sourceBuffers.push(piece);
      }
      const fullBuffer = concatBuffers(sourceBuffers);

      // Write to target provider
      const targetProvider = ProviderRegistry.get(targetProviderId);
      const targetRef = await targetProvider.putChunk({
        chunkId: chunk.id as string,
        size: fullBuffer.byteLength,
        hash: chunk.hash,
        data: (async function* () { yield fullBuffer; })(),
      });

      // Update location with the actual provider reference
      location.providerRef = targetRef;
      location.updatedAt = new Date();
      this.locationRepo.saveLocation(location);

      // State: VERIFYING — read back from target and hash
      this.locationRepo.updateLocationState(location.id, 'VERIFYING');

      const verifyStream = await targetProvider.getChunk(targetRef);
      const hasher = createHash('sha256');
      for await (const piece of verifyStream) {
        hasher.update(piece);
      }
      const actualHash = hasher.digest('hex');

      if (actualHash === chunk.hash) {
        this.locationRepo.updateLocationState(location.id, 'VERIFIED');
        return this.locationRepo.getLocationById(location.id)!;
      } else {
        this.locationRepo.updateLocationState(
          location.id,
          'CORRUPTED',
          `Verification failed: expected ${chunk.hash}, got ${actualHash}`,
        );
        return null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Replication failed';
      this.locationRepo.updateLocationState(location.id, 'FAILED', msg);
      return null;
    }
  }
}

/** Concatenate an array of Uint8Arrays into a single buffer */
function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.byteLength;
  }
  return result;
}
