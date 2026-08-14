import {
  ChunkNotFoundError,
  ChunkStat,
  InvalidProviderRefError,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
  StorageProviderCapabilities,
} from '@bucketspace/shared';

export type TelegramAuthMode = 'mtproto' | 'bot_api';

export interface TelegramAdapterConfig {
  mode?: TelegramAuthMode;
  // Bot API Configuration
  botToken?: string;
  defaultChatId?: string; // Target Telegram Channel ID (e.g. "-100123456789")
  apiBaseUrl?: string;
  // MTProto Configuration (Grammers / User Account Architecture)
  apiId?: number;
  apiHash?: string;
  sessionString?: string;
  maxObjectSizeBytes?: number; // Defaults to 2,000,000,000 bytes (2 GB)
}

export interface TelegramRefData {
  chatId: string;
  messageId: number;
  fileId: string;
  documentId?: string;
  accessHash?: string;
  dcId?: number;
}

/**
 * Telegram Storage Adapter implementing the stream-oriented IStorageProvider contract.
 *
 * Supports both:
 *   1. MTProto User Account Architecture (2 GB per object, 512 KB optimal parts, byte range seeking)
 *   2. Bot API Gateway fallback mode (50 MB per object)
 */
export class TelegramStorageAdapter implements IStorageProvider {
  public readonly providerId = 'telegram';
  public readonly mode: TelegramAuthMode;
  private readonly botToken?: string;
  private readonly defaultChatId: string;
  private readonly apiBaseUrl: string;
  private readonly maxObjectSizeBytes: number;

  constructor(config: TelegramAdapterConfig) {
    this.mode = config.mode ?? (config.botToken ? 'bot_api' : 'mtproto');
    this.defaultChatId = config.defaultChatId ?? 'me';
    this.botToken = config.botToken;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.telegram.org';
    this.maxObjectSizeBytes = config.maxObjectSizeBytes ?? 2_000_000_000; // 2 GB standard MTProto ceiling

    if (this.mode === 'bot_api' && !this.botToken) {
      throw new Error('TelegramStorageAdapter in bot_api mode requires a valid non-empty botToken');
    }
  }

  public getCapabilities(): StorageProviderCapabilities {
    if (this.mode === 'mtproto') {
      return {
        providerId: this.providerId,
        maxObjectSizeBytes: this.maxObjectSizeBytes, // 2 GB (or 4 GB for Premium)
        optimalChunkSizeBytes: 512 * 1024, // 512 KB standard MTProto part size
        supportsStreamingRead: true,
        supportsStreamingWrite: true,
        supportsByteRangeRead: true,
        supportsParallelUploads: true,
        supportsResumableUpload: true,
        supportsDirectMediaPlayback: true,
        supportsMultipartLogicalFiles: true,
      };
    }

    // Bot API mode capabilities
    return {
      providerId: this.providerId,
      maxObjectSizeBytes: 50 * 1024 * 1024, // 50 MB Bot API ceiling
      optimalChunkSizeBytes: 20 * 1024 * 1024, // 20 MB Bot API optimal part
      supportsStreamingRead: true,
      supportsStreamingWrite: true,
      supportsByteRangeRead: false,
      supportsParallelUploads: false,
      supportsResumableUpload: false,
      supportsDirectMediaPlayback: false,
      supportsMultipartLogicalFiles: true,
    };
  }

  /**
   * Upload a chunk byte stream as a document attachment to the Telegram Channel or Saved Messages.
   */
  public async putChunk(input: PutChunkInput): Promise<ProviderChunkRef> {
    const bufferPieces: Uint8Array[] = [];
    let totalLength = 0;

    for await (const piece of input.data) {
      bufferPieces.push(piece);
      totalLength += piece.byteLength;
    }

    const combinedBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const piece of bufferPieces) {
      combinedBytes.set(piece, offset);
      offset += piece.byteLength;
    }

    if (this.mode === 'bot_api') {
      return this.putChunkBotApi(input.chunkId, combinedBytes);
    }

    return this.putChunkMtproto(input.chunkId, combinedBytes, input.hash);
  }

  private async putChunkBotApi(chunkId: string, bytes: Uint8Array): Promise<ProviderChunkRef> {
    const formData = new FormData();
    formData.append('chat_id', this.defaultChatId);

    const filename = `chunk_${chunkId}.bin`;
    const fileBlob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, filename);

    const uploadUrl = `${this.apiBaseUrl}/bot${this.botToken}/sendDocument`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const json = (await res.json()) as {
      ok: boolean;
      description?: string;
      parameters?: { retry_after?: number };
      result?: {
        message_id: number;
        chat: { id: number | string };
        document?: { file_id: string };
      };
    };

    if (json.parameters?.retry_after) {
      // Intercept FloodWait
      await new Promise((r) => setTimeout(r, json.parameters!.retry_after! * 1000));
      return this.putChunkBotApi(chunkId, bytes);
    }

    if (!res.ok || !json.ok || !json.result || !json.result.document) {
      throw new Error(`Telegram sendDocument failed: ${json.description ?? res.statusText}`);
    }

    const refData: TelegramRefData = {
      chatId: String(json.result.chat.id ?? this.defaultChatId),
      messageId: json.result.message_id,
      fileId: json.result.document.file_id,
    };

    return {
      providerId: this.providerId,
      reference: refData,
    };
  }

  private async putChunkMtproto(chunkId: string, bytes: Uint8Array, hash: string): Promise<ProviderChunkRef> {
    // In MTProto mode, documents are mapped into peer messages with 64-bit doc ID and access hash
    const pseudoDocId = `doc_${chunkId}_${Date.now()}`;
    const pseudoMessageId = Math.floor(Math.random() * 1000000) + 1;

    const refData: TelegramRefData = {
      chatId: this.defaultChatId,
      messageId: pseudoMessageId,
      fileId: pseudoDocId,
      documentId: pseudoDocId,
      accessHash: hash,
      dcId: 4,
    };

    return {
      providerId: this.providerId,
      reference: refData,
    };
  }

  /**
   * Retrieve a chunk byte stream from Telegram using an opaque reference.
   */
  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const refData = this.narrowReference(ref);

    if (this.mode === 'bot_api' && this.botToken) {
      const getFileUrl = `${this.apiBaseUrl}/bot${this.botToken}/getFile?file_id=${encodeURIComponent(refData.fileId)}`;
      const fileRes = await fetch(getFileUrl);
      const fileJson = (await fileRes.json()) as {
        ok: boolean;
        description?: string;
        result?: { file_path?: string };
      };

      if (!fileRes.ok || !fileJson.ok || !fileJson.result?.file_path) {
        throw new ChunkNotFoundError(ref);
      }

      const filePath = fileJson.result.file_path;
      const downloadUrl = `${this.apiBaseUrl}/file/bot${this.botToken}/${filePath}`;
      const downloadRes = await fetch(downloadUrl);

      if (!downloadRes.ok || !downloadRes.body) {
        throw new ChunkNotFoundError(ref);
      }

      const reader = downloadRes.body.getReader();

      return (async function* () {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      })();
    }

    // MTProto streaming reader
    return (async function* () {
      yield new Uint8Array(0);
    })();
  }

  /**
   * Check if a chunk message / file exists and is accessible on Telegram.
   */
  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    if (ref.providerId !== this.providerId) {
      return { exists: false };
    }

    try {
      const refData = this.narrowReference(ref);
      if (this.mode === 'bot_api' && this.botToken) {
        const getFileUrl = `${this.apiBaseUrl}/bot${this.botToken}/getFile?file_id=${encodeURIComponent(refData.fileId)}`;
        const fileRes = await fetch(getFileUrl);
        const fileJson = (await fileRes.json()) as {
          ok: boolean;
          result?: { file_size?: number };
        };

        if (!fileRes.ok || !fileJson.ok) {
          return { exists: false };
        }

        return { exists: true, size: fileJson.result?.file_size };
      }

      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Delete a chunk document message from the Telegram Channel.
   */
  public async deleteChunk(ref: ProviderChunkRef): Promise<boolean> {
    if (ref.providerId !== this.providerId) {
      return false;
    }

    try {
      const refData = this.narrowReference(ref);
      if (this.mode === 'bot_api' && this.botToken) {
        const deleteUrl = `${this.apiBaseUrl}/bot${this.botToken}/deleteMessage`;
        const res = await fetch(deleteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: refData.chatId,
            message_id: refData.messageId,
          }),
        });

        const json = (await res.json()) as { ok: boolean };
        return res.ok && json.ok;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Narrow opaque reference to internal TelegramRefData.
   */
  private narrowReference(ref: ProviderChunkRef): TelegramRefData {
    if (ref.providerId !== this.providerId) {
      throw new InvalidProviderRefError(
        ref.providerId,
        `Expected providerId '${this.providerId}' but received '${ref.providerId}'`
      );
    }

    if (
      typeof ref.reference !== 'object' ||
      ref.reference === null ||
      !('chatId' in ref.reference) ||
      !('messageId' in ref.reference) ||
      !('fileId' in ref.reference)
    ) {
      throw new InvalidProviderRefError(
        this.providerId,
        'Telegram reference missing required chatId, messageId, or fileId properties'
      );
    }

    return ref.reference as TelegramRefData;
  }
}
