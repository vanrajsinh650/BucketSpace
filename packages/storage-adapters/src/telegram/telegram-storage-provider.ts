import {
  ChunkNotFoundError,
  ChunkStat,
  InvalidProviderRefError,
  IStorageProvider,
  ProviderChunkRef,
  PutChunkInput,
} from '@bucketspace/shared';

export interface TelegramAdapterConfig {
  botToken: string;
  defaultChatId: string; // Target Telegram Channel ID (e.g. "-100123456789")
  apiBaseUrl?: string;
}

export interface TelegramRefData {
  chatId: string;
  messageId: number;
  fileId: string;
}

/**
 * Telegram Storage Adapter implementing the stream-oriented IStorageProvider contract.
 * Stores chunk streams as document attachments in Telegram Private Channels.
 */
export class TelegramStorageAdapter implements IStorageProvider {
  public readonly providerId = 'telegram';
  private readonly botToken: string;
  private readonly defaultChatId: string;
  private readonly apiBaseUrl: string;

  constructor(config: TelegramAdapterConfig) {
    if (!config.botToken) {
      throw new Error('TelegramStorageAdapter requires a valid non-empty botToken');
    }
    if (!config.defaultChatId) {
      throw new Error('TelegramStorageAdapter requires a valid non-empty defaultChatId (channel ID)');
    }
    this.botToken = config.botToken;
    this.defaultChatId = config.defaultChatId;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.telegram.org';
  }

  /**
   * Upload a chunk byte stream as a document attachment to the Telegram Channel.
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

    const formData = new FormData();
    formData.append('chat_id', this.defaultChatId);

    const filename = `chunk_${input.chunkId}.bin`;
    const fileBlob = new Blob([combinedBytes], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, filename);

    const uploadUrl = `${this.apiBaseUrl}/bot${this.botToken}/sendDocument`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const json = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: {
        message_id: number;
        chat: { id: number | string };
        document?: { file_id: string };
      };
    };

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

  /**
   * Retrieve a chunk byte stream from Telegram using an opaque reference.
   */
  public async getChunk(ref: ProviderChunkRef): Promise<AsyncIterable<Uint8Array>> {
    const refData = this.narrowReference(ref);

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

  /**
   * Check if a chunk message / file exists and is accessible on Telegram.
   */
  public async hasChunk(ref: ProviderChunkRef): Promise<ChunkStat> {
    if (ref.providerId !== this.providerId) {
      return { exists: false };
    }

    try {
      const refData = this.narrowReference(ref);
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
