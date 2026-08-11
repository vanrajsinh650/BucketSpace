import { createHash } from 'node:crypto';
import {
  ChunkLocation,
  ChunkMetadata,
  LocationState,
  ProviderChunkRef,
} from '@bucketspace/shared';
import { ChunkLocationRepository } from '@bucketspace/db';
import { ProviderRegistry } from '../registry/provider-registry';

/* ─── Types ─── */

export interface VerificationResult {
  locationId: string;
  chunkId: string;
  providerId: string;
  expectedHash: string;
  actualHash: string;
  valid: boolean;
  error?: string;
}

export interface FileVerificationReport {
  fileId: string;
  totalLocations: number;
  verified: number;
  corrupted: number;
  missing: number;
  results: VerificationResult[];
}

/* ─── Engine ─── */

/**
 * VerificationEngine audits chunk integrity across providers.
 *
 * For each chunk location:
 *   1. Download the bytes from the provider
 *   2. Calculate SHA-256
 *   3. Compare against the canonical hash in SQLite
 *   4. Update the location state accordingly
 *
 * "Provider says the object exists" ≠ "the object is correct."
 */
export class VerificationEngine {
  constructor(
    private readonly locationRepo: ChunkLocationRepository,
  ) {}

  /**
   * Verify a single chunk location against its expected hash.
   * Downloads bytes, hashes them, and compares.
   */
  public async verifyLocation(
    location: ChunkLocation,
    expectedHash: string,
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      locationId: location.id,
      chunkId: location.chunkId,
      providerId: location.providerId,
      expectedHash,
      actualHash: '',
      valid: false,
    };

    try {
      // Check if the provider is available
      if (!ProviderRegistry.has(location.providerId)) {
        this.locationRepo.updateLocationState(location.id, 'MISSING', 'Provider not registered');
        result.error = 'Provider not registered';
        return result;
      }

      const provider = ProviderRegistry.get(location.providerId);

      // Check if the chunk still exists on the provider
      const exists = await provider.hasChunk(location.providerRef);
      if (!exists.exists) {
        this.locationRepo.updateLocationState(location.id, 'MISSING', 'Chunk not found on provider');
        result.error = 'Chunk not found on provider';
        return result;
      }

      // Download and hash
      this.locationRepo.updateLocationState(location.id, 'VERIFYING');

      const stream = await provider.getChunk(location.providerRef);
      const hasher = createHash('sha256');
      const buffers: Uint8Array[] = [];

      for await (const piece of stream) {
        hasher.update(piece);
        buffers.push(piece);
      }

      const actualHash = hasher.digest('hex');
      result.actualHash = actualHash;
      result.valid = actualHash === expectedHash;

      if (result.valid) {
        this.locationRepo.updateLocationState(location.id, 'VERIFIED');
      } else {
        this.locationRepo.updateLocationState(location.id, 'CORRUPTED', `Hash mismatch: expected ${expectedHash}, got ${actualHash}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      this.locationRepo.updateLocationState(location.id, 'FAILED', msg);
      result.error = msg;
    }

    return result;
  }

  /**
   * Verify all locations for a file.
   * Requires chunk metadata to supply expected hashes.
   */
  public async verifyFile(
    fileId: string,
    chunks: ChunkMetadata[],
  ): Promise<FileVerificationReport> {
    const locations = this.locationRepo.getLocationsForFile(fileId);
    const report: FileVerificationReport = {
      fileId,
      totalLocations: locations.length,
      verified: 0,
      corrupted: 0,
      missing: 0,
      results: [],
    };

    for (const loc of locations) {
      const chunk = chunks.find((c) => c.id === loc.chunkId);
      if (!chunk) continue;

      const result = await this.verifyLocation(loc, chunk.hash);
      report.results.push(result);

      if (result.valid) report.verified++;
      else if (result.error?.includes('not found')) report.missing++;
      else report.corrupted++;
    }

    return report;
  }
}
