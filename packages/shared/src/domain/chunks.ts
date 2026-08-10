import { ChunkId, FileId } from './ids';

/**
 * Opaque reference returned by a storage provider for a persisted chunk.
 * `reference` is an opaque black box to the core domain, narrowed internally by provider adapters.
 */
export interface ProviderChunkRef {
  providerId: string;
  reference: unknown;
}

export interface ChunkMetadata {
  id: ChunkId;
  fileId: FileId;
  index: number;
  size: number;
  hash: string; // SHA-256 digest of this chunk's bytes
  providerRef?: ProviderChunkRef;
}
