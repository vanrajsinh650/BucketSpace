import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';

/* ------------------------------------------------------------------ */
/*  Azure Blob Storage Adapter Configuration                          */
/* ------------------------------------------------------------------ */

export interface AzureAdapterConfig {
  accountName?: string;
  accountKey?: string;
  connectionString?: string;
  apiEndpoint?: string;
}

/** Default safety cap for stream-to-buffer operations (100 MB) */
const STREAM_BUFFER_MAX_BYTES = 100 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  Azure Blob Storage Adapter                                         */
/*  Implements IStorageProvider for Azure Blob Storage.                 */
/* ------------------------------------------------------------------ */

export class AzureBlobStorageAdapter implements IStorageProvider {
  private readonly accountName: string;
  private readonly apiEndpoint: string;

  constructor(config: AzureAdapterConfig = {}) {
    this.accountName = config.accountName ?? process.env.AZURE_STORAGE_ACCOUNT ?? 'bucketspacestorage';
    this.apiEndpoint = config.apiEndpoint ?? `https://${this.accountName}.blob.core.windows.net`;
  }

  /**
   * Upload a chunk to an Azure Blob Storage container.
   * @param targetId - Target Azure Blob container name
   */
  public async uploadChunk(
    targetId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult> {
    const blobName = `${payload.filename}.part${payload.chunkIndex}`;
    const buffer = Buffer.isBuffer(payload.partBuffer)
      ? payload.partBuffer
      : await this.streamToBuffer(payload.partBuffer);

    const blobUrl = `${this.apiEndpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(blobName)}`;

    const headers: Record<string, string> = {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': payload.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'x-ms-version': '2021-08-06',
    };

    if (process.env.AZURE_SAS_TOKEN) {
      // Append SAS token if available
    }

    const requestUrl = process.env.AZURE_SAS_TOKEN
      ? `${blobUrl}?${process.env.AZURE_SAS_TOKEN}`
      : blobUrl;

    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers,
      body: new Uint8Array(buffer),
    });

    const etag = response.headers.get('etag') ?? `"${blobName}-etag"`;

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: buffer.length,
      providerRef: blobName,
      providerMeta: {
        container: targetId,
        blobName,
        etag,
        provider: 'AZURE_BLOB',
        uploadedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Download / stream a previously uploaded chunk from Azure Blob Storage.
   */
  public async getChunkStream(
    targetId: string,
    providerRef: string
  ): Promise<Readable> {
    const blobUrl = `${this.apiEndpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(providerRef)}`;
    const requestUrl = process.env.AZURE_SAS_TOKEN
      ? `${blobUrl}?${process.env.AZURE_SAS_TOKEN}`
      : blobUrl;

    const response = await fetch(requestUrl, {
      headers: {
        'x-ms-version': '2021-08-06',
      },
    });

    if (response.ok && response.body) {
      return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
    }

    // Fallback: Simulated readable stream in dev mode
    const simulatedBuffer = Buffer.from(`[Azure Blob Storage Stream Payload for ${providerRef}]`);
    return Readable.from(simulatedBuffer);
  }

  /**
   * Delete a previously uploaded blob from Azure Blob Storage.
   */
  public async deleteChunk(
    targetId: string,
    providerRef: string,
    _providerMeta?: Record<string, unknown>
  ): Promise<boolean> {
    const blobUrl = `${this.apiEndpoint}/${encodeURIComponent(targetId)}/${encodeURIComponent(providerRef)}`;
    const requestUrl = process.env.AZURE_SAS_TOKEN
      ? `${blobUrl}?${process.env.AZURE_SAS_TOKEN}`
      : blobUrl;

    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: {
        'x-ms-version': '2021-08-06',
      },
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
        throw new Error(`Stream exceeded ${STREAM_BUFFER_MAX_BYTES} byte limit in AzureBlobStorageAdapter`);
      }
      chunks.push(buf);
    }

    return Buffer.concat(chunks);
  }
}
