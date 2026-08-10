import { ProviderChunkRef } from './chunks';

export interface PutChunkInput {
  chunkId: string;
  size: number;
  hash: string; // Expected SHA-256 digest
  data: AsyncIterable<Uint8Array>;
}

export interface ChunkStat {
  exists: boolean;
  size?: number;
}

/**
 * Core Storage Provider Contract.
 * Pure stream/byte-source oriented, independent of Node Buffer or file-level orchestration.
 */
export interface IStorageProvider {
  readonly providerId: string;

  /** Put a chunk stream into storage and return an opaque reference */
  putChunk(input: PutChunkInput): Promise<ProviderChunkRef>;

  /** Retrieve a chunk as an async byte stream using an opaque reference */
  getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>>;

  /** Check if a chunk exists and return basic stat metadata */
  hasChunk(ref: ProviderChunkRef): Promise<ChunkStat>;

  /** Remove a chunk from storage */
  deleteChunk(ref: ProviderChunkRef): Promise<boolean>;
}
