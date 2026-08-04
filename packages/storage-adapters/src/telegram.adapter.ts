import { Readable } from 'stream';
import { IStorageProvider, UploadPartPayload, UploadPartResult } from './provider.interface';

/* ------------------------------------------------------------------ */
/*  Telegram Bot API response types (replaces `as any` casts)          */
/* ------------------------------------------------------------------ */

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_name?: string;
}

interface TelegramMessage {
  message_id: number;
  document?: TelegramDocument;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  description?: string;
  result?: T;
  parameters?: { retry_after?: number };
}

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface TelegramAdapterConfig {
  botToken: string;
  apiBaseUrl?: string;
  /** Maximum retries on 429 rate-limit errors (default: 3) */
  maxRetries?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Telegram Bot API hard limit for sendDocument (50 MB) */
const TELEGRAM_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Safety cap to prevent OOM when buffering streams (default: 52 MB) */
const STREAM_BUFFER_MAX_BYTES = 52 * 1024 * 1024;

/** Default retry count for 429 responses */
const DEFAULT_MAX_RETRIES = 3;

/** Fallback backoff seconds when Telegram doesn't send retry_after */
const DEFAULT_BACKOFF_SECONDS = 5;

/* ------------------------------------------------------------------ */
/*  Telegram Storage Adapter                                           */
/*  Stores file chunks as document attachments in Telegram channels.   */
/* ------------------------------------------------------------------ */

export class TelegramStorageAdapter implements IStorageProvider {
  private readonly botToken: string;
  private readonly apiBaseUrl: string;
  private readonly maxRetries: number;

  constructor(config: TelegramAdapterConfig) {
    if (!config.botToken) {
      throw new Error('TelegramStorageAdapter requires a non-empty botToken');
    }
    this.botToken = config.botToken;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.telegram.org';
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /* ---------------------------------------------------------------- */
  /*  Upload a chunk                                                   */
  /* ---------------------------------------------------------------- */

  public async uploadChunk(
    targetId: string,
    payload: UploadPartPayload
  ): Promise<UploadPartResult> {
    // Resolve the payload buffer (streams get collected first)
    const buffer = Buffer.isBuffer(payload.partBuffer)
      ? payload.partBuffer
      : await this.streamToBuffer(payload.partBuffer);

    // Guard: reject chunks exceeding Telegram's 50 MB upload limit
    if (buffer.length > TELEGRAM_MAX_UPLOAD_BYTES) {
      throw new Error(
        `Chunk size ${buffer.length} bytes exceeds Telegram's ` +
        `${TELEGRAM_MAX_UPLOAD_BYTES} byte upload limit`
      );
    }

    const url = `${this.apiBaseUrl}/bot${this.botToken}/sendDocument`;
    const formData = new FormData();
    formData.append('chat_id', targetId);

    const blob = new Blob([new Uint8Array(buffer)], {
      type: payload.mimeType || 'application/octet-stream',
    });
    formData.append('document', blob, `${payload.filename}.part${payload.chunkIndex}`);
    formData.append('caption', `Part ${payload.chunkIndex} | ${payload.filename}`);

    // Send with automatic retry on 429 rate-limit responses
    const json = await this.fetchWithRetry<TelegramMessage>(url, {
      method: 'POST',
      body: formData,
    });

    const message = json.result!;
    const document = message.document!;

    return {
      chunkIndex: payload.chunkIndex,
      sizeBytes: document.file_size ?? buffer.length,
      providerRef: document.file_id,
      providerMeta: {
        messageId: message.message_id,
        fileUniqueId: document.file_unique_id,
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Download / stream a chunk                                        */
  /* ---------------------------------------------------------------- */

  public async getChunkStream(
    _targetId: string,
    providerRef: string
  ): Promise<Readable> {
    // Step 1: Resolve file path via Telegram's getFile API
    const getFileUrl =
      `${this.apiBaseUrl}/bot${this.botToken}/getFile?file_id=${encodeURIComponent(providerRef)}`;

    const json = await this.fetchWithRetry<{ file_path?: string }>(getFileUrl);

    if (!json.result?.file_path) {
      throw new Error(
        `Telegram getFile returned no file_path for ref "${providerRef}": ` +
        `${json.description ?? 'unknown error'}`
      );
    }

    // Step 2: Stream the file content
    const downloadUrl =
      `${this.apiBaseUrl}/file/bot${this.botToken}/${json.result.file_path}`;
    const fileResponse = await fetch(downloadUrl);

    if (!fileResponse.ok || !fileResponse.body) {
      throw new Error(
        `Failed to download Telegram file (HTTP ${fileResponse.status}) from ${downloadUrl}`
      );
    }

    // Convert Web ReadableStream → Node.js Readable
    return Readable.fromWeb(fileResponse.body as import('stream/web').ReadableStream);
  }

  /* ---------------------------------------------------------------- */
  /*  Delete a chunk                                                   */
  /* ---------------------------------------------------------------- */

  public async deleteChunk(
    targetId: string,
    _providerRef: string,
    providerMeta?: Record<string, unknown>
  ): Promise<boolean> {
    const messageId = providerMeta?.messageId;
    if (typeof messageId !== 'number') {
      throw new Error(
        'Telegram deleteChunk requires providerMeta.messageId (number)'
      );
    }

    const deleteUrl = `${this.apiBaseUrl}/bot${this.botToken}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: targetId, message_id: messageId }),
    });

    if (!response.ok) return false;

    const json = (await response.json()) as TelegramApiResponse<boolean>;
    return Boolean(json.ok);
  }

  /* ================================================================ */
  /*  Private Helpers                                                  */
  /* ================================================================ */

  /**
   * Wraps `fetch` with automatic retry on Telegram 429 rate-limit errors.
   * Respects the `retry_after` value from Telegram's response body.
   */
  private async fetchWithRetry<T>(
    url: string,
    init?: RequestInit
  ): Promise<TelegramApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await fetch(url, init);

      // Rate-limited — wait and retry
      if (response.status === 429 && attempt < this.maxRetries) {
        const body = (await response.json()) as TelegramApiResponse<T>;
        const waitSeconds = body.parameters?.retry_after ?? DEFAULT_BACKOFF_SECONDS;
        await this.sleep(waitSeconds * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(
          `Telegram API error [HTTP ${response.status}]: ${errorText}`
        );
        // Only retry on 429; other HTTP errors fail immediately
        throw lastError;
      }

      const json = (await response.json()) as TelegramApiResponse<T>;
      if (!json.ok) {
        throw new Error(
          `Telegram API returned error: ${json.description ?? 'Unknown error'}`
        );
      }
      return json;
    }

    throw lastError ?? new Error('Telegram API request failed after max retries');
  }

  /**
   * Collects a Readable stream into a single Buffer.
   * Throws if the accumulated size exceeds the safety cap.
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;

      if (totalBytes > STREAM_BUFFER_MAX_BYTES) {
        stream.destroy();
        throw new Error(
          `Stream exceeded ${STREAM_BUFFER_MAX_BYTES} byte safety cap ` +
          `(received ${totalBytes} bytes so far)`
        );
      }

      chunks.push(buf);
    }

    return Buffer.concat(chunks);
  }

  /** Promise-based sleep for retry backoff */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
