import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';
import { streamToBuffer } from './stream.utils';

/* ------------------------------------------------------------------ */
/*  S3 / R2 Storage Adapter Configuration                              */
/* ------------------------------------------------------------------ */

export interface S3AdapterConfig {
  /** S3-compatible endpoint (falls back to env S3_ENDPOINT) */
  endpoint?: string;
}

/* ------------------------------------------------------------------ */
/*  AWS S3 & Cloudflare R2 Storage Adapter                             */
/*  Implements IStorageProvider for S3-compatible object stores.        */
/*                                                                     */
/*  NOTE: This adapter uses unsigned REST requests and is intended for */
/*  use with presigned URLs or public/SAS-token-authorized endpoints.  */
/*  Full AWS SigV4 signing is planned for Phase 3 (@aws-sdk/client-s3) */
/* ------------------------------------------------------------------ */

export class S3StorageAdapter implements IStorageProvider {
  private readonly endpoint: string;

  constructor(config: S3AdapterConfig = {}) {
    this.endpoint = config.endpoint ?? process.env.S3_ENDPOINT ?? 'https://s3.amazonaws.com';
  }

  /**
   * Upload a chunk to an S3 or R2 bucket.
   * @param targetId - S3 / R2 Bucket name
   */
  public async uploadChunk(
    targetId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult> {
    const objectKey = `${payload.filename}.part${payload.chunkIndex}`;
    const buffer = Buffer.isBuffer(payload.partBuffer)
      ? payload.partBuffer
      : await streamToBuffer(payload.partBuffer, undefined, 'S3StorageAdapter');

    const s3Url = `${this.endpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(objectKey)}`;

    const response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': payload.mimeType || 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `S3 upload failed [HTTP ${response.status}]: ${errorText}`
      );
    }

    const etag = response.headers.get('etag') ?? '';

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: buffer.length,
      providerRef: objectKey,
      providerMeta: {
        bucket: targetId,
        objectKey,
        etag,
        provider: 'AWS_S3',
      },
    };
  }

  /**
   * Download / stream a previously uploaded chunk from S3 / R2.
   */
  public async getChunkStream(
    targetId: string,
    providerRef: string
  ): Promise<Readable> {
    const s3Url = `${this.endpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(providerRef)}`;

    const response = await fetch(s3Url);

    if (!response.ok || !response.body) {
      throw new Error(
        `S3 download failed [HTTP ${response.status}] for ref "${providerRef}"`
      );
    }

    return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
  }

  /**
   * Delete a previously uploaded chunk from S3 / R2.
   */
  public async deleteChunk(
    targetId: string,
    providerRef: string,
    _providerMeta?: Record<string, unknown>
  ): Promise<boolean> {
    const s3Url = `${this.endpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(providerRef)}`;

    const response = await fetch(s3Url, { method: 'DELETE' });
    return response.ok || response.status === 404;
  }
}
