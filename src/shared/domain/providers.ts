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

export interface StorageProviderCapabilities {
  providerId: string;

  // Hard physical object limit for one provider object (in bytes).
  // null means provider has no declared hard object limit (e.g. local disk).
  maxObjectSizeBytes: number | null;

  // Preferred chunk/part size for this provider (e.g. 512KB for Telegram MTProto, 5MB for S3/Local).
  optimalChunkSizeBytes: number;

  supportsStreamingRead: boolean;
  supportsStreamingWrite: boolean;
  supportsByteRangeRead: boolean;
  supportsParallelUploads: boolean;
  supportsResumableUpload: boolean;
  supportsDirectMediaPlayback: boolean;

  // Provider can represent one logical file as multiple physical objects.
  supportsMultipartLogicalFiles: boolean;
}

/**
 * Core Storage Provider Contract.
 * Pure stream/byte-source oriented, independent of Node Buffer or file-level orchestration.
 */
export interface IStorageProvider {
  readonly providerId: string;

  /** Retrieve declared capabilities and size boundaries for this provider */
  getCapabilities(): StorageProviderCapabilities;

  /** Put a chunk stream into storage and return an opaque reference */
  putChunk(input: PutChunkInput): Promise<ProviderChunkRef>;

  /** Retrieve a chunk as an async byte stream using an opaque reference */
  getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>>;

  /** Check if a chunk exists and return basic stat metadata */
  hasChunk(ref: ProviderChunkRef): Promise<ChunkStat>;

  /** Remove a chunk from storage */
  deleteChunk(ref: ProviderChunkRef): Promise<boolean>;
}

