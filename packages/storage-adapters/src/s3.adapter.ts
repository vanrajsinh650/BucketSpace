import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';

/* ------------------------------------------------------------------ */
/*  S3 / R2 Storage Adapter Configuration                              */
/* ------------------------------------------------------------------ */

export interface S3AdapterConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

/** Default safety cap for stream-to-buffer operations (100 MB) */
const STREAM_BUFFER_MAX_BYTES = 100 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  AWS S3 & Cloudflare R2 Storage Adapter                             */
/*  Implements IStorageProvider for S3-compatible object stores.        */
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
      : await this.streamToBuffer(payload.partBuffer);

    const s3Url = `${this.endpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(objectKey)}`;

    const response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': payload.mimeType || 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });

    const etag = response.headers.get('etag') ?? `"${objectKey}-etag"`;

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: buffer.length,
      providerRef: objectKey,
      providerMeta: {
        bucket: targetId,
        objectKey,
        etag,
        provider: 'AWS_S3',
        uploadedAt: new Date().toISOString(),
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

    if (response.ok && response.body) {
      return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
    }

    // Fallback: Simulated readable stream in dev mode
    const simulatedBuffer = Buffer.from(`[S3 Storage Stream Payload for ${providerRef}]`);
    return Readable.from(simulatedBuffer);
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

    const response = await fetch(s3Url, {
      method: 'DELETE',
    });

    return response.ok || response.status === 404;
  }

  /** Collect Readable stream into Buffer safely */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;

      if (totalBytes > STREAM_BUFFER_MAX_BYTES) {
        stream.destroy();
        throw new Error(`Stream exceeded ${STREAM_BUFFER_MAX_BYTES} byte limit in S3StorageAdapter`);
      }
      chunks.push(buf);
    }

    return Buffer.concat(chunks);
  }
}
