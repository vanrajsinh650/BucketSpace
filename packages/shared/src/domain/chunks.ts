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
  locations?: ChunkLocation[];
}

/* ─── V2.3 Multi-Provider Redundancy ─── */

/** Whether a chunk location is the original placement or a redundancy copy */
export type LocationRole = 'PRIMARY' | 'REPLICA';

/**
 * State machine for chunk location lifecycle:
 *
 *   PENDING → COPYING → VERIFYING → VERIFIED
 *                                  → CORRUPTED / FAILED / MISSING
 *   CORRUPTED / MISSING → REPAIRING → VERIFYING → VERIFIED
 *   VERIFIED → STALE (when periodic re-verification fails)
 */
export type LocationState =
  | 'PENDING'
  | 'COPYING'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'STALE'
  | 'MISSING'
  | 'CORRUPTED'
  | 'FAILED'
  | 'REPAIRING';

/**
 * A single chunk's presence on a specific storage provider.
 * Each chunk can have multiple locations (PRIMARY on Telegram, REPLICA on Local Disk, etc.).
 * A replica is not considered valid until state === 'VERIFIED'.
 */
export interface ChunkLocation {
  id: string;
  chunkId: string;
  fileId: string;
  providerId: string;
  providerRef: ProviderChunkRef;
  role: LocationRole;
  state: LocationState;
  verifiedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
