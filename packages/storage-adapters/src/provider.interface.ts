import { Readable } from 'stream';

export interface UploadPartPayload {
  chunkIndex: number;
  partBuffer: Buffer | Readable;
  filename: string;
  mimeType: string;
}

export interface UploadPartResult {
  chunkIndex: number;
  messageId: number;
  telegramFileId: string;
  sizeBytes: number;
}

/**
 * Universal Storage Provider Interface Contract
 */
export interface IStorageProvider {
  /**
   * Upload a chunked document part to the target storage channel/bucket
   */
  uploadChunk(
    targetChannelId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult>;

  /**
   * Download / Stream a chunk attachment from storage
   */
  getChunkStream(
    targetChannelId: string,
    telegramFileId: string
  ): Promise<Readable>;

  /**
   * Delete a message chunk from storage
   */
  deleteChunk(
    targetChannelId: string,
    messageId: number
  ): Promise<boolean>;
}
