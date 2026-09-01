import { createHash } from 'crypto';
import {
  ChunkLocation,
  ChunkMetadata,
} from '@/shared';
import { ChunkLocationRepository } from '@/modules/db';
import { ProviderRegistry } from '../registry/provider-registry';

/* ─── Types ─── */

export interface RepairResult {
  fileId: string;
  repairedLocations: number;
  failedRepairs: number;
  details: RepairDetail[];
}

export interface RepairDetail {
  locationId: string;
  chunkId: string;
  targetProviderId: string;
  sourceProviderId: string;
  success: boolean;
  error?: string;
}

/* ─── Engine ─── */

/**
 * RepairEngine reconstructs MISSING or CORRUPTED chunk locations
 * using bytes from a VERIFIED source on another provider.
 *
 * Repair sequence:
 *   1. Find all locations with state MISSING, CORRUPTED, or FAILED
 *   2. For each damaged location, find a VERIFIED source on a different provider
 *   3. State → REPAIRING
 *   4. Download from verified source → upload to damaged provider → verify SHA-256
 *   5. State → VERIFIED (or FAILED if repair didn't work)
 *
 * This supports Primary Provider Loss Recovery:
 *   If Telegram loses chunk data, repair uses Local Disk REPLICA → re-uploads to Telegram.
 */
export class RepairEngine {
  constructor(
    private readonly locationRepo: ChunkLocationRepository,
  ) {}

  /**
   * Repair all damaged locations for a file.
   * A location is repairable if another VERIFIED location exists for the same chunk.
   */
  public async repairFile(
    fileId: string,
    chunks: ChunkMetadata[],
  ): Promise<RepairResult> {
    const result: RepairResult = {
      fileId,
      repairedLocations: 0,
      failedRepairs: 0,
      details: [],
    };

    const allLocations = this.locationRepo.getLocationsForFile(fileId);

    // Group locations by chunk ID
    const locationsByChunk = new Map<string, ChunkLocation[]>();
    for (const loc of allLocations) {
      const existing = locationsByChunk.get(loc.chunkId) ?? [];
      existing.push(loc);
      locationsByChunk.set(loc.chunkId, existing);
    }

    for (const chunk of chunks) {
      const chunkLocations = locationsByChunk.get(chunk.id as string) ?? [];

      // Find damaged locations
      const damagedStates = new Set(['MISSING', 'CORRUPTED', 'FAILED', 'STALE']);
      const damaged = chunkLocations.filter((l) => damagedStates.has(l.state));

      if (damaged.length === 0) continue;

      // Find a VERIFIED source
      const source = chunkLocations.find((l) => l.state === 'VERIFIED');

      if (!source) {
        // No verified source available — record failures
        for (const d of damaged) {
          result.failedRepairs++;
          result.details.push({
            locationId: d.id,
            chunkId: chunk.id as string,
            targetProviderId: d.providerId,
            sourceProviderId: 'none',
            success: false,
            error: 'No VERIFIED source location available for repair',
          });
        }
        continue;
      }

      // Repair each damaged location
      for (const damagedLoc of damaged) {
        const detail = await this.repairSingleLocation(
          chunk,
          source,
          damagedLoc,
        );
        result.details.push(detail);
        if (detail.success) result.repairedLocations++;
        else result.failedRepairs++;
      }
    }

    return result;
  }

  /**
   * Repair a single damaged location by copying from a verified source.
   */
  private async repairSingleLocation(
    chunk: ChunkMetadata,
    source: ChunkLocation,
    damaged: ChunkLocation,
  ): Promise<RepairDetail> {
    const detail: RepairDetail = {
      locationId: damaged.id,
      chunkId: chunk.id as string,
      targetProviderId: damaged.providerId,
      sourceProviderId: source.providerId,
      success: false,
    };

    try {
      // State: REPAIRING
      this.locationRepo.updateLocationState(damaged.id, 'REPAIRING');

      // Read from verified source
      const sourceProvider = ProviderRegistry.get(source.providerId);
      const sourceStream = await sourceProvider.getChunk(source.providerRef);

      const buffers: Uint8Array[] = [];
      for await (const piece of sourceStream) {
        buffers.push(piece);
      }
      const fullBuffer = concatBuffers(buffers);

      // Write to damaged provider
      const targetProvider = ProviderRegistry.get(damaged.providerId);
      const newRef = await targetProvider.putChunk({
        chunkId: chunk.id as string,
        size: fullBuffer.byteLength,
        hash: chunk.hash,
        data: (async function* () { yield fullBuffer; })(),
      });

      // Update providerRef to new reference
      damaged.providerRef = newRef;
      damaged.updatedAt = new Date();
      this.locationRepo.saveLocation(damaged);

      // Verify: read back from target and check SHA-256
      this.locationRepo.updateLocationState(damaged.id, 'VERIFYING');
      const verifyStream = await targetProvider.getChunk(newRef);
      const hasher = createHash('sha256');
      for await (const piece of verifyStream) {
        hasher.update(piece);
      }
      const actualHash = hasher.digest('hex');

      if (actualHash === chunk.hash) {
        this.locationRepo.updateLocationState(damaged.id, 'VERIFIED');
        detail.success = true;
      } else {
        this.locationRepo.updateLocationState(
          damaged.id,
          'CORRUPTED',
          `Repair verification failed: expected ${chunk.hash}, got ${actualHash}`,
        );
        detail.error = 'SHA-256 mismatch after repair';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Repair failed';
      this.locationRepo.updateLocationState(damaged.id, 'FAILED', msg);
      detail.error = msg;
    }

    return detail;
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
