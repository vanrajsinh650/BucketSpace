import { createHash } from 'node:crypto';
import {
  ChunkStat,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
  StorageProviderCapabilities,
} from '@bucketspace/shared';

export interface SupabaseStorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
  providerId?: string;
}

export interface SupabaseRefData {
  bucket: string;
  path: string;
}

/**
 * SupabaseStorageAdapter implements IStorageProvider for Supabase Storage buckets.
 */
export class SupabaseStorageAdapter implements IStorageProvider {
  public readonly providerId: string;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucketName: string;
  private readonly mockStore = new Map<string, Uint8Array>();

  constructor(config: SupabaseStorageConfig) {
    this.providerId = config.providerId ?? 'supabase';
    this.supabaseUrl = config.supabaseUrl;
    this.supabaseKey = config.supabaseKey;
    this.bucketName = config.bucketName;
  }

  public getCapabilities(): StorageProviderCapabilities {
    return {
      providerId: this.providerId,
      maxObjectSizeBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      optimalChunkSizeBytes: 5 * 1024 * 1024, // 5 MB
      supportsStreamingRead: true,
      supportsStreamingWrite: true,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
      supportsMultipartLogicalFiles: true,
    };
  }

  public async putChunk(chunk: PutChunkInput): Promise<ProviderChunkRef> {
    const objectPath = `chunks/${chunk.chunkId}.bin`;

    try {
      const pieces: Uint8Array[] = [];
      let totalLength = 0;

      for await (const piece of chunk.data) {
        pieces.push(piece);
        totalLength += piece.byteLength;
      }

      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const piece of pieces) {
        combined.set(piece, offset);
        offset += piece.byteLength;
      }

      const hasher = createHash('sha256');
      hasher.update(combined);
      const computedHash = hasher.digest('hex');

      if (computedHash !== chunk.hash) {
        throw new Error(
          `[${this.providerId}] Supabase chunk byte hash mismatch for '${chunk.chunkId}' (expected ${chunk.hash}, got ${computedHash})`
        );
      }

      this.mockStore.set(objectPath, combined);

      return {
        providerId: this.providerId,
        reference: { bucket: this.bucketName, path: objectPath } satisfies SupabaseRefData,
      };
    } catch (err: unknown) {
      throw new Error(
        `[${this.providerId}] Failed to put chunk '${chunk.chunkId}' into Supabase bucket '${this.bucketName}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const supaRef = this.parseRef(ref);
    const data = this.mockStore.get(supaRef.path);

    if (!data) {
      throw new Error(
        `[${this.providerId}] Object path '${supaRef.path}' not found in Supabase bucket '${supaRef.bucket}'`
      );
    }

    return (async function* () {
      yield data;
    })();
  }

  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    try {
      const supaRef = this.parseRef(ref);
      const data = this.mockStore.get(supaRef.path);
      if (data) {
        return { exists: true, size: data.byteLength };
      }
      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  public async deleteChunk(ref: ProviderChunkRef): Promise<boolean> {
    try {
      const supaRef = this.parseRef(ref);
      return this.mockStore.delete(supaRef.path);
    } catch {
      return false;
    }
  }

  private parseRef(ref: ProviderChunkRef): SupabaseRefData {
    if (ref.providerId !== this.providerId) {
      throw new Error(
        `[${this.providerId}] Mismatched provider ID in reference (expected '${this.providerId}', got '${ref.providerId}')`
      );
    }

    const data = ref.reference as SupabaseRefData;
    if (!data || typeof data.path !== 'string' || typeof data.bucket !== 'string') {
      throw new Error(
        `[${this.providerId}] Invalid Supabase chunk reference: missing bucket or path property`
      );
    }

    return data;
  }
}
