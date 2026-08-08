import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';
import { streamToBuffer } from './stream.utils';

/* ------------------------------------------------------------------ */
/*  Azure Blob Storage Adapter Configuration                          */
/* ------------------------------------------------------------------ */

export interface AzureAdapterConfig {
  /** Azure storage account name (falls back to env AZURE_STORAGE_ACCOUNT) */
  accountName?: string;
  /** Custom API endpoint override */
  apiEndpoint?: string;
}

/* ------------------------------------------------------------------ */
/*  Azure Blob Storage Adapter                                         */
/*  Implements IStorageProvider for Azure Blob Storage.                 */
/*  Uses REST API with SAS token auth from environment.                */
/* ------------------------------------------------------------------ */

export class AzureBlobStorageAdapter implements IStorageProvider {
  private readonly accountName: string;
  private readonly apiEndpoint: string;

  constructor(config: AzureAdapterConfig = {}) {
    this.accountName = config.accountName ?? process.env.AZURE_STORAGE_ACCOUNT ?? '';
    this.apiEndpoint = config.apiEndpoint ?? `https://${this.accountName}.blob.core.windows.net`;
  }

  /**
   * Build the full blob URL, appending SAS token if available.
   */
  private buildBlobUrl(container: string, blobName: string): string {
    const base = `${this.apiEndpoint}/${encodeURIComponent(container)}/${encodeURIComponent(blobName)}`;
    return process.env.AZURE_SAS_TOKEN ? `${base}?${process.env.AZURE_SAS_TOKEN}` : base;
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
      : await streamToBuffer(payload.partBuffer, undefined, 'AzureBlobStorageAdapter');

    const requestUrl = this.buildBlobUrl(targetId, blobName);

    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': payload.mimeType || 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
        'x-ms-version': '2021-08-06',
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `Azure Blob upload failed [HTTP ${response.status}]: ${errorText}`
      );
    }

    const etag = response.headers.get('etag') ?? '';

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: buffer.length,
      providerRef: blobName,
      providerMeta: {
        container: targetId,
        blobName,
        etag,
        provider: 'AZURE_BLOB',
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
    const requestUrl = this.buildBlobUrl(targetId, providerRef);

    const response = await fetch(requestUrl, {
      headers: { 'x-ms-version': '2021-08-06' },
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Azure Blob download failed [HTTP ${response.status}] for ref "${providerRef}"`
      );
    }

    return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
  }

  /**
   * Delete a previously uploaded blob from Azure Blob Storage.
   */
  public async deleteChunk(
    targetId: string,
    providerRef: string,
    _providerMeta?: Record<string, unknown>
  ): Promise<boolean> {
    const requestUrl = this.buildBlobUrl(targetId, providerRef);

    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: { 'x-ms-version': '2021-08-06' },
    });

    return response.ok || response.status === 404;
  }
}
