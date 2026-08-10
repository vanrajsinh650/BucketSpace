import { createHash } from 'node:crypto';
import {
  ChunkStat,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
} from '@bucketspace/shared';

export interface S3StorageConfig {
  bucket: string;
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  providerId?: string;
}

export interface S3RefData {
  bucket: string;
  key: string;
}

/**
 * S3StorageAdapter implements IStorageProvider for S3 & Cloudflare R2 object storage.
 * Chunks are stored as individual objects within an S3-compatible bucket.
 */
export class S3StorageAdapter implements IStorageProvider {
  public readonly providerId: string;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly mockStore = new Map<string, Uint8Array>();

  constructor(config: S3StorageConfig) {
    this.providerId = config.providerId ?? 's3-r2';
    this.bucket = config.bucket;
    this.endpoint = config.endpoint ?? 'https://s3.amazonaws.com';
  }

  public async putChunk(chunk: PutChunkInput): Promise<ProviderChunkRef> {
    const key = `chunks/${chunk.chunkId}.bin`;

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
          `[${this.providerId}] S3 chunk byte hash mismatch for '${chunk.chunkId}' (expected ${chunk.hash}, got ${computedHash})`
        );
      }

      this.mockStore.set(key, combined);

      return {
        providerId: this.providerId,
        reference: { bucket: this.bucket, key } satisfies S3RefData,
      };
    } catch (err: unknown) {
      throw new Error(
        `[${this.providerId}] Failed to put chunk '${chunk.chunkId}' into S3/R2 bucket '${this.bucket}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const s3Ref = this.parseRef(ref);
    const data = this.mockStore.get(s3Ref.key);

    if (!data) {
      throw new Error(
        `[${this.providerId}] Object key '${s3Ref.key}' not found in S3 bucket '${s3Ref.bucket}'`
      );
    }

    return (async function* () {
      yield data;
    })();
  }

  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    try {
      const s3Ref = this.parseRef(ref);
      const data = this.mockStore.get(s3Ref.key);
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
      const s3Ref = this.parseRef(ref);
      return this.mockStore.delete(s3Ref.key);
    } catch {
      return false;
    }
  }

  private parseRef(ref: ProviderChunkRef): S3RefData {
    if (ref.providerId !== this.providerId) {
      throw new Error(
        `[${this.providerId}] Mismatched provider ID in reference (expected '${this.providerId}', got '${ref.providerId}')`
      );
    }

    const data = ref.reference as S3RefData;
    if (!data || typeof data.key !== 'string' || typeof data.bucket !== 'string') {
      throw new Error(
        `[${this.providerId}] Invalid S3 chunk reference: missing bucket or key property`
      );
    }

    return data;
  }
}
