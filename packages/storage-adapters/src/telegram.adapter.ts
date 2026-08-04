import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';

export interface TelegramAdapterConfig {
  botToken: string;
  apiBaseUrl?: string;
}

/**
 * Telegram Storage Adapter
 * Implements chunked document storage inside private Telegram channel buckets.
 */
export class TelegramStorageAdapter implements IStorageProvider {
  private readonly botToken: string;
  private readonly apiBaseUrl: string;

  constructor(config: TelegramAdapterConfig) {
    this.botToken = config.botToken;
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.telegram.org';
  }

  /**
   * Uploads a file chunk attachment to a specified Telegram storage channel.
   */
  public async uploadChunk(
    targetChannelId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult> {
    const url = `${this.apiBaseUrl}/bot${this.botToken}/sendDocument`;

    // Construct FormData for multipart upload
    const formData = new FormData();
    formData.append('chat_id', targetChannelId);

    const buffer = Buffer.isBuffer(payload.partBuffer)
      ? payload.partBuffer
      : await this.streamToBuffer(payload.partBuffer as Readable);

    const uint8 = new Uint8Array(buffer);
    const blob = new Blob([uint8], { type: payload.mimeType || 'application/octet-stream' });
    formData.append('document', blob, `${payload.filename}.part${payload.chunkIndex}`);
    formData.append('caption', `Part ${payload.chunkIndex} | ${payload.filename}`);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API sendDocument failed [HTTP ${response.status}]: ${errorText}`);
    }

    const json = (await response.json()) as any;
    if (!json.ok) {
      throw new Error(`Telegram API returned error: ${json.description || 'Unknown error'}`);
    }

    const message = json.result;
    const document = message.document;

    return {
      chunkIndex: payload.chunkIndex,
      messageId: message.message_id,
      telegramFileId: document.file_id,
      sizeBytes: document.file_size || buffer.length,
    };
  }

  /**
   * Retrieves a file stream for a given Telegram file ID.
   */
  public async getChunkStream(
    _targetChannelId: string,
    telegramFileId: string
  ): Promise<Readable> {
    // Step 1: Resolve File Path via getFile
    const getFileUrl = `${this.apiBaseUrl}/bot${this.botToken}/getFile?file_id=${telegramFileId}`;
    const response = await fetch(getFileUrl);

    if (!response.ok) {
      throw new Error(`Telegram getFile API failed with status ${response.status}`);
    }

    const json = (await response.json()) as any;
    if (!json.ok || !json.result?.file_path) {
      throw new Error(`Telegram getFile failed: ${json.description || 'Missing file_path'}`);
    }

    // Step 2: Download stream from file path
    const downloadUrl = `${this.apiBaseUrl}/file/bot${this.botToken}/${json.result.file_path}`;
    const fileResponse = await fetch(downloadUrl);

    if (!fileResponse.ok || !fileResponse.body) {
      throw new Error(`Failed to download Telegram file stream from ${downloadUrl}`);
    }

    // Convert Web ReadableStream to Node.js Readable stream
    return Readable.fromWeb(fileResponse.body as any);
  }

  /**
   * Deletes a chunk message from the Telegram storage channel.
   */
  public async deleteChunk(
    targetChannelId: string,
    messageId: number
  ): Promise<boolean> {
    const deleteUrl = `${this.apiBaseUrl}/bot${this.botToken}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChannelId,
        message_id: messageId,
      }),
    });

    if (!response.ok) return false;
    const json = (await response.json()) as any;
    return Boolean(json.ok);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
