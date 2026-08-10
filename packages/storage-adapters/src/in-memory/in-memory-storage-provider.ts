import {
  ChunkNotFoundError,
  ChunkStat,
  InvalidProviderRefError,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
} from '@bucketspace/shared';

interface InMemoryRefData {
  key: string;
}

/**
 * In-Memory Storage Adapter for testing the IStorageProvider abstraction.
 * Operates purely on async iterable byte streams and opaque provider references.
 */
export class InMemoryStorageProvider implements IStorageProvider {
  public readonly providerId = 'in-memory';

  // Internal storage: key -> array of Uint8Array chunks
  private readonly store = new Map<string, { chunks: Uint8Array[]; size: number }>();

  /**
   * Put a chunk stream into in-memory storage and return an opaque reference.
   */
  public async putChunk(input: PutChunkInput): Promise<ProviderChunkRef> {
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // Consume the async byte stream incrementally
    for await (const piece of input.data) {
      chunks.push(piece);
      totalSize += piece.byteLength;
    }

    const key = `chunk_${input.chunkId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.store.set(key, { chunks, size: totalSize });

    return {
      providerId: this.providerId,
      reference: { key } satisfies InMemoryRefData,
    };
  }

  /**
   * Retrieve a stored chunk as an async byte stream using an opaque reference.
   */
  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const key = this.narrowReference(ref);
    const entry = this.store.get(key);

    if (!entry) {
      throw new ChunkNotFoundError(ref);
    }

    const chunks = entry.chunks;
    return (async function* () {
      for (const piece of chunks) {
        yield piece;
      }
    })();
  }

  /**
   * Check if a chunk exists in memory.
   */
  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    if (ref.providerId !== this.providerId) {
      return { exists: false };
    }

    try {
      const key = this.narrowReference(ref);
      const entry = this.store.get(key);
      if (!entry) {
        return { exists: false };
      }
      return { exists: true, size: entry.size };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Delete a stored chunk from memory.
   */
  public async deleteChunk(ref: ProviderChunkRef): Promise<boolean> {
    if (ref.providerId !== this.providerId) {
      return false;
    }

    const key = this.narrowReference(ref);
    return this.store.delete(key);
  }

  /**
   * Helper: Narrow opaque unknown reference to internal InMemoryRefData
   */
  private narrowReference(ref: ProviderChunkRef): string {
    if (ref.providerId !== this.providerId) {
      throw new InvalidProviderRefError(
        ref.providerId,
        `Expected providerId '${this.providerId}' but received '${ref.providerId}'`
      );
    }

    if (
      typeof ref.reference !== 'object' ||
      ref.reference === null ||
      !('key' in ref.reference) ||
      typeof (ref.reference as Record<string, unknown>).key !== 'string'
    ) {
      throw new InvalidProviderRefError(
        this.providerId,
        'Opaque reference missing required internal key property'
      );
    }

    return (ref.reference as InMemoryRefData).key;
  }
}
