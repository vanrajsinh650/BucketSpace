import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';
import { streamToBuffer } from './stream.utils';

/* ------------------------------------------------------------------ */
/*  GCP Storage Adapter Configuration                                  */
/* ------------------------------------------------------------------ */

export interface GCPAdapterConfig {
  /** GCP project ID (falls back to env GCP_PROJECT_ID) */
  projectId?: string;
  /** GCP API endpoint override (for emulators or custom endpoints) */
  apiEndpoint?: string;
}

/* ------------------------------------------------------------------ */
/*  GCP Storage Adapter                                                */
/*  Implements IStorageProvider for Google Cloud Storage.               */
/*  Uses GCP JSON API with Bearer token auth from environment.         */
/* ------------------------------------------------------------------ */

export class GCPStorageAdapter implements IStorageProvider {
  private readonly projectId: string;
  private readonly apiEndpoint: string;

  constructor(config: GCPAdapterConfig = {}) {
    this.projectId = config.projectId ?? process.env.GCP_PROJECT_ID ?? '';
    this.apiEndpoint = config.apiEndpoint ?? 'https://storage.googleapis.com';
  }

  /**
   * Upload a chunk/object to Google Cloud Storage bucket.
   * @param targetId - Target GCP bucket name
   */
  public async uploadChunk(
    targetId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult> {
    const objectKey = `${payload.filename}.part${payload.chunkIndex}`;
    const buffer = Buffer.isBuffer(payload.partBuffer)
      ? payload.partBuffer
      : await streamToBuffer(payload.partBuffer, undefined, 'GCPStorageAdapter');

    const uploadUrl = `${this.apiEndpoint}/upload/storage/v1/b/${encodeURIComponent(targetId)}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': payload.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
    };

    if (process.env.GCP_BEARER_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GCP_BEARER_TOKEN}`;
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `GCP Storage upload failed [HTTP ${response.status}]: ${errorText}`
      );
    }

    const json = (await response.json()) as { name?: string; size?: string; generation?: string };

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: json.size ? parseInt(json.size, 10) : buffer.length,
      providerRef: json.name ?? objectKey,
      providerMeta: {
        bucket: targetId,
        objectKey: json.name ?? objectKey,
        generation: json.generation,
        provider: 'GCP_STORAGE',
      },
    };
  }

  /**
   * Download / stream a previously uploaded chunk from GCP Storage.
   */
  public async getChunkStream(
    targetId: string,
    providerRef: string
  ): Promise<Readable> {
    const downloadUrl = `${this.apiEndpoint}/storage/v1/b/${encodeURIComponent(targetId)}/o/${encodeURIComponent(providerRef)}?alt=media`;
    const headers: Record<string, string> = {};

    if (process.env.GCP_BEARER_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GCP_BEARER_TOKEN}`;
    }

    const response = await fetch(downloadUrl, { headers });

    if (!response.ok || !response.body) {
      throw new Error(
        `GCP Storage download failed [HTTP ${response.status}] for ref "${providerRef}"`
      );
    }

    return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
  }

  /**
   * Delete a previously uploaded chunk from GCP Storage bucket.
   */
  public async deleteChunk(
    targetId: string,
    providerRef: string,
    _providerMeta?: Record<string, unknown>
  ): Promise<boolean> {
    const deleteUrl = `${this.apiEndpoint}/storage/v1/b/${encodeURIComponent(targetId)}/o/${encodeURIComponent(providerRef)}`;
    const headers: Record<string, string> = {};

    if (process.env.GCP_BEARER_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GCP_BEARER_TOKEN}`;
    }

    const response = await fetch(deleteUrl, { method: 'DELETE', headers });
    return response.ok || response.status === 404;
  }
}
