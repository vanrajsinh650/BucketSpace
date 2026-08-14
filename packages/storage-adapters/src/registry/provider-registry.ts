import { createHash, randomUUID } from 'node:crypto';
import { IStorageProvider, StorageProviderCapabilities } from '@bucketspace/shared';

/* ─── Types ─── */

export interface ProviderInfo {
  providerId: string;
  registered: boolean;
  capabilities?: StorageProviderCapabilities;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  latencyMs: number;
  error?: string;
}

/* ─── ProviderRegistry ─── */

/**
 * ProviderRegistry manages registered IStorageProvider instances by provider ID.
 * Supports listing, removal, capability queries, and connectivity health checks via probe chunks.
 */
export class ProviderRegistry {
  private static readonly providers = new Map<string, IStorageProvider>();

  /** Register an IStorageProvider instance */
  public static register(provider: IStorageProvider): void {
    if (!provider.providerId) {
      throw new Error('Cannot register provider with invalid or empty providerId');
    }
    this.providers.set(provider.providerId, provider);
  }

  /** Retrieve a registered IStorageProvider instance by provider ID */
  public static get(providerId: string): IStorageProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Storage provider '${providerId}' is not registered in ProviderRegistry`);
    }
    return provider;
  }

  /** Retrieve declared capabilities for a registered provider */
  public static getCapabilities(providerId: string): StorageProviderCapabilities {
    const provider = this.get(providerId);
    return provider.getCapabilities();
  }

  /** Check if a provider ID is registered */
  public static has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /** List all registered providers with their declared capabilities */
  public static list(): ProviderInfo[] {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      providerId: id,
      registered: true,
      capabilities: provider.getCapabilities(),
    }));
  }

  /** Remove a registered provider by ID */
  public static remove(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Health check: write a 1KB probe chunk → read back → verify SHA-256 → delete.
   * Returns latency and connectivity status without leaving artifacts behind.
   */
  public static async healthCheck(providerId: string): Promise<ProviderHealth> {
    const start = Date.now();

    try {
      const provider = this.get(providerId);

      // Generate a 1KB random probe payload
      const probeBytes = new Uint8Array(1024);
      for (let i = 0; i < probeBytes.length; i++) {
        probeBytes[i] = Math.floor(Math.random() * 256);
      }

      const probeHash = createHash('sha256').update(probeBytes).digest('hex');
      const probeChunkId = `health-probe-${randomUUID()}`;

      // 1. Write probe chunk
      const ref = await provider.putChunk({
        chunkId: probeChunkId,
        size: probeBytes.length,
        hash: probeHash,
        data: (async function* () { yield probeBytes; })(),
      });

      // 2. Read back and verify hash
      const readStream = await provider.getChunk(ref);
      const readHasher = createHash('sha256');
      for await (const piece of readStream) {
        readHasher.update(piece);
      }
      const readHash = readHasher.digest('hex');

      if (readHash !== probeHash) {
        await provider.deleteChunk(ref);
        return {
          providerId,
          status: 'degraded',
          latencyMs: Date.now() - start,
          error: `Probe read-back hash mismatch (wrote ${probeHash}, read ${readHash})`,
        };
      }

      // 3. Clean up probe chunk
      await provider.deleteChunk(ref);

      return {
        providerId,
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      return {
        providerId,
        status: 'unreachable',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Clear all registered providers (useful for tests or runtime re-configuration) */
  public static clear(): void {
    this.providers.clear();
  }
}
