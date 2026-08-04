import { Readable } from 'stream';

/* ------------------------------------------------------------------ */
/*  Payload & Result types for chunk-level storage operations          */
/* ------------------------------------------------------------------ */

export interface UploadPartPayload {
  chunkIndex: number;
  partBuffer: Buffer | Readable;
  filename: string;
  mimeType: string;
}

export interface UploadPartResult {
  chunkIndex: number;
  sizeBytes: number;

  /**
   * Opaque identifier the provider uses to retrieve this chunk later.
   * Telegram → file_id, S3 → ETag / object key, R2 → object key, etc.
   */
  providerRef: string;

  /**
   * Provider-specific metadata stored alongside the chunk record.
   * Telegram → { messageId }, S3 → { versionId, bucket }, etc.
   */
  providerMeta: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Universal Storage Provider Interface                               */
/* ------------------------------------------------------------------ */

/**
 * Every storage backend (Telegram, S3, R2, GCS, Azure) must satisfy
 * this contract. Consumers never depend on provider-specific fields.
 */
export interface IStorageProvider {
  /**
   * Upload a file chunk to the target storage location.
   * @param targetId - Provider-specific destination (Telegram channel ID, S3 bucket, etc.)
   */
  uploadChunk(
    targetId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult>;

  /**
   * Download / stream a previously uploaded chunk.
   * @param targetId   - Provider-specific destination
   * @param providerRef - The opaque ref returned from `uploadChunk`
   */
  getChunkStream(
    targetId: string,
    providerRef: string
  ): Promise<Readable>;

  /**
   * Delete a previously uploaded chunk.
   * @param targetId   - Provider-specific destination
   * @param providerRef - The opaque ref returned from `uploadChunk`
   * @param providerMeta - Optional metadata needed for deletion (e.g. messageId for Telegram)
   */
  deleteChunk(
    targetId: string,
    providerRef: string,
    providerMeta?: Record<string, unknown>
  ): Promise<boolean>;
}
