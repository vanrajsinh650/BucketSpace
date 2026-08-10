import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  ChunkStat,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
} from '@bucketspace/shared';

export interface LocalStorageConfig {
  rootDir: string;
  providerId?: string;
}

export interface LocalRefData {
  relPath: string;
}

/**
 * LocalStorageAdapter implements IStorageProvider for local filesystem storage.
 * Chunks are stored as individual files under the configured root directory.
 */
export class LocalStorageAdapter implements IStorageProvider {
  public readonly providerId: string;
  private readonly rootDir: string;

  constructor(config: LocalStorageConfig) {
    this.providerId = config.providerId ?? 'local-disk';
    this.rootDir = path.resolve(config.rootDir);

    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  public async putChunk(chunk: PutChunkInput): Promise<ProviderChunkRef> {
    const filename = `${chunk.chunkId}.bin`;
    const filePath = path.join(this.rootDir, filename);
    const tempPath = path.join(this.rootDir, `${chunk.chunkId}.tmp`);

    try {
      const hasher = createHash('sha256');
      let writtenBytes = 0;

      const nodeReadable = Readable.from(chunk.data);
      const writeStream = fs.createWriteStream(tempPath);

      nodeReadable.on('data', (data: Uint8Array) => {
        hasher.update(data);
        writtenBytes += data.byteLength;
      });

      await pipeline(nodeReadable, writeStream);

      const computedHash = hasher.digest('hex');

      if (computedHash !== chunk.hash) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw new Error(
          `[${this.providerId}] Local chunk write hash mismatch for '${chunk.chunkId}' (expected ${chunk.hash}, got ${computedHash})`
        );
      }

      fs.renameSync(tempPath, filePath);

      return {
        providerId: this.providerId,
        reference: { relPath: filename } satisfies LocalRefData,
      };
    } catch (err: unknown) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new Error(
        `[${this.providerId}] Failed to put chunk '${chunk.chunkId}' on local disk: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const localRef = this.parseRef(ref);
    const filePath = path.join(this.rootDir, localRef.relPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `[${this.providerId}] Chunk file not found on local disk: '${localRef.relPath}'`
      );
    }

    const stream = fs.createReadStream(filePath);
    return (async function* () {
      for await (const piece of stream) {
        yield new Uint8Array(piece);
      }
    })();
  }

  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    try {
      const localRef = this.parseRef(ref);
      const filePath = path.join(this.rootDir, localRef.relPath);

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        return { exists: true, size: stat.size };
      }
      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  public async deleteChunk(ref: ProviderChunkRef): Promise<boolean> {
    try {
      const localRef = this.parseRef(ref);
      const filePath = path.join(this.rootDir, localRef.relPath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private parseRef(ref: ProviderChunkRef): LocalRefData {
    if (ref.providerId !== this.providerId) {
      throw new Error(
        `[${this.providerId}] Mismatched provider ID in reference (expected '${this.providerId}', got '${ref.providerId}')`
      );
    }

    const data = ref.reference as LocalRefData;
    if (!data || typeof data.relPath !== 'string') {
      throw new Error(
        `[${this.providerId}] Invalid local chunk reference: missing relPath string property`
      );
    }

    return data;
  }
}
