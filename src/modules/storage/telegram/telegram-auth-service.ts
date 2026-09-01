import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import type { TelegramRefData } from './telegram-storage-provider';

export const DEFAULT_TELEGRAM_API_ID = 37608030;
export const DEFAULT_TELEGRAM_API_HASH = '51ebcc8fbaa1b9ac93d5f410dfb53aa7';

interface ActiveLoginSession {
  client: TelegramClient;
  phone: string;
  phoneCodeHash?: string;
  apiId: number;
  apiHash: string;
  createdAt: number;
}

export interface SendCodeResult {
  sessionToken: string;
  phoneCodeHash: string;
  isCodeViaApp: boolean;
}

export interface VerifyCodeResult {
  success: boolean;
  sessionString?: string;
  requires2FA?: boolean;
}

export interface Verify2FAResult {
  success: boolean;
  sessionString: string;
}

// Attach state to globalThis to survive Next.js App Router hot-reloads across API routes
interface GlobalTelegramState {
  activeSessions: Map<string, ActiveLoginSession>;
  clientPool: Map<string, { client: TelegramClient; lastUsed: number }>;
  vaultChannels: Map<string, any>;
}

const globalForTelegram = globalThis as unknown as {
  __bucketspace_telegram_state?: GlobalTelegramState;
};

const telegramState: GlobalTelegramState =
  globalForTelegram.__bucketspace_telegram_state || {
    activeSessions: new Map<string, ActiveLoginSession>(),
    clientPool: new Map<string, { client: TelegramClient; lastUsed: number }>(),
    vaultChannels: new Map<string, any>(),
  };

if (!telegramState.vaultChannels) {
  telegramState.vaultChannels = new Map<string, any>();
}

globalForTelegram.__bucketspace_telegram_state = telegramState;

/**
 * Real Telegram MTProto 2.0 Authentication & Chunk Storage Service.
 *
 * Provides phone OTP login, 2FA password handling, client connection pooling,
 * and direct MTProto binary chunk upload/download streaming to Telegram Saved Messages.
 */
export class TelegramAuthService {
  /**
   * Get or create a connected TelegramClient instance for a saved sessionString.
   */
  public static async getClient(sessionString: string): Promise<TelegramClient> {
    const cached = telegramState.clientPool.get(sessionString);
    if (cached && cached.client.connected) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    const session = new StringSession(sessionString);
    const apiId = Number(process.env.TELEGRAM_API_ID) || DEFAULT_TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH || DEFAULT_TELEGRAM_API_HASH;

    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      floodSleepThreshold: 60,
      useIPV6: false,
      autoReconnect: true,
    });

    await client.connect();
    telegramState.clientPool.set(sessionString, { client, lastUsed: Date.now() });
    return client;
  }

  /**
   * Check if a sessionString is valid and actively authenticated with Telegram.
   */
  public static async checkSession(sessionString: string): Promise<{
    valid: boolean;
    user?: { id: string; firstName?: string; username?: string; phone?: string };
  }> {
    try {
      const client = await this.getClient(sessionString);
      const me = await client.getMe();
      if (!me) {
        return { valid: false };
      }
      return {
        valid: true,
        user: {
          id: String((me as any).id),
          firstName: (me as any).firstName,
          username: (me as any).username,
          phone: (me as any).phone,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Request a real verification code from Telegram MTProto servers.
   */
  public static async sendCode(params: {
    phone: string;
    apiId?: number;
    apiHash?: string;
  }): Promise<SendCodeResult> {
    // 1. Sanitize phone number to strict E.164 format (+<country><number>)
    let cleanPhone = params.phone.replace(/[\s\-\(\)]/g, '').trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // 2. Resolve credentials (custom override or built-in user credentials)
    const apiId =
      params.apiId && !isNaN(Number(params.apiId)) && Number(params.apiId) > 0
        ? Number(params.apiId)
        : process.env.TELEGRAM_API_ID && !isNaN(Number(process.env.TELEGRAM_API_ID)) && Number(process.env.TELEGRAM_API_ID) > 0
        ? Number(process.env.TELEGRAM_API_ID)
        : DEFAULT_TELEGRAM_API_ID;

    const apiHash =
      params.apiHash && params.apiHash.trim() && params.apiHash !== 'your-telegram-api-hash'
        ? params.apiHash.trim()
        : process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_API_HASH.trim() && process.env.TELEGRAM_API_HASH !== 'your-telegram-api-hash'
        ? process.env.TELEGRAM_API_HASH.trim()
        : DEFAULT_TELEGRAM_API_HASH;

    // 3. Clean up any previous session for this phone number or expired sessions (> 15 min)
    for (const [token, existing] of telegramState.activeSessions.entries()) {
      if (existing.phone === cleanPhone || Date.now() - existing.createdAt > 15 * 60 * 1000) {
        try {
          await existing.client.disconnect();
        } catch {
          // ignore disconnect error
        }
        telegramState.activeSessions.delete(token);
      }
    }

    // 4. Connect to Telegram MTProto and dispatch real OTP code to user's Telegram app
    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const result = await client.sendCode(
      {
        apiId,
        apiHash,
      },
      cleanPhone
    );

    const sessionToken = `tgsess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    telegramState.activeSessions.set(sessionToken, {
      client,
      phone: cleanPhone,
      phoneCodeHash: result.phoneCodeHash,
      apiId,
      apiHash,
      createdAt: Date.now(),
    });

    return {
      sessionToken,
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp ?? true,
    };
  }

  /**
   * Verify the 5-digit OTP code received on Telegram.
   */
  public static async verifyCode(params: {
    sessionToken: string;
    code: string;
  }): Promise<VerifyCodeResult> {
    const session = telegramState.activeSessions.get(params.sessionToken);
    if (!session || !session.phoneCodeHash) {
      throw new Error('Authentication session expired or not found. Please request a new code.');
    }

    try {
      // Use the raw MTProto RPC — preserves the original phoneCodeHash
      const { Api } = await import('telegram');
      await session.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: session.phone,
          phoneCodeHash: session.phoneCodeHash,
          phoneCode: params.code,
        })
      );

      const sessionString = session.client.session.save() as unknown as string;
      telegramState.activeSessions.delete(params.sessionToken);
      return { success: true, sessionString };
    } catch (err: any) {
      const msg = (err?.errorMessage || err?.message || '').toLowerCase();

      // Telegram signals 2FA requirement via SESSION_PASSWORD_NEEDED RPC error
      const requires2FA =
        err?.errorMessage === 'SESSION_PASSWORD_NEEDED' ||
        msg.includes('session_password_needed') ||
        msg.includes('2fa') ||
        msg.includes('password');

      if (requires2FA) {
        // Refresh session timestamp so user has plenty of time to enter their 2FA password
        session.createdAt = Date.now();
        return { success: false, requires2FA: true };
      }
      throw err;
    }
  }

  /**
   * Handle 2FA cloud password if user has two-step verification enabled on Telegram.
   */
  public static async verify2FA(params: {
    sessionToken: string;
    password: string;
  }): Promise<Verify2FAResult> {
    const session = telegramState.activeSessions.get(params.sessionToken);
    if (!session) {
      throw new Error('Authentication session expired. Please start again.');
    }

    try {
      await session.client.signInWithPassword(
        {
          apiId: session.apiId,
          apiHash: session.apiHash,
        },
        {
          password: async () => params.password,
          onError: (err: any) => {
            throw err;
          },
        }
      );

      const sessionString = session.client.session.save() as unknown as string;
      telegramState.activeSessions.delete(params.sessionToken);
      return { success: true, sessionString };
    } catch (err: any) {
      const msg = (err?.errorMessage || err?.message || '').toLowerCase();
      if (msg.includes('password_hash_invalid') || msg.includes('password invalid')) {
        throw new Error('Incorrect 2FA password. Please check your Telegram cloud password and try again.');
      }
      throw err;
    }
  }

  /**
   * Discovers or provisions an automated, hidden, and archived storage vault channel ('📦 BucketSpace Vault').
   * This guarantees user's personal 'Saved Messages' and chat list stay 100% clean.
   */
  public static async getOrCreateStorageVault(sessionString: string): Promise<any> {
    const cached = telegramState.vaultChannels.get(sessionString);
    if (cached) {
      return cached;
    }

    const client = await this.getClient(sessionString);

    try {
      // 1. Search existing dialogs for an existing storage vault channel
      const dialogs = await client.getDialogs({ limit: 100 });
      const existing = dialogs.find(
        (d) =>
          d.isChannel &&
          (d.title === '📦 BucketSpace Vault' ||
            d.title === 'BucketSpace Vault' ||
            (d.title && d.title.includes('BucketSpace')))
      );

      if (existing && existing.entity) {
        telegramState.vaultChannels.set(sessionString, existing.entity);
        return existing.entity;
      }
    } catch {
      // Fall through to channel creation
    }

    // 2. Automatically create a private storage vault channel
    try {
      const createRes = (await client.invoke(
        new Api.channels.CreateChannel({
          title: '📦 BucketSpace Vault',
          about: 'Automated encrypted cloud storage vault for BucketSpace. Do not delete.',
          megagroup: false,
        })
      )) as any;

      const channel = createRes.chats && createRes.chats[0] ? createRes.chats[0] : createRes;
      const inputPeer = await client.getInputEntity(channel);

      // 3. Move channel to Telegram Archive folder (folderId: 1)
      try {
        await client.invoke(
          new Api.folders.EditPeerFolders({
            folderPeers: [
              new Api.InputFolderPeer({
                peer: inputPeer,
                folderId: 1,
              }),
            ],
          })
        );
      } catch {
        // Non-critical if archiving fails
      }

      // 4. Mute notifications indefinitely (muteUntil = max int32)
      try {
        await client.invoke(
          new Api.account.UpdateNotifySettings({
            peer: new Api.InputNotifyPeer({ peer: inputPeer }),
            settings: new Api.InputPeerNotifySettings({
              muteUntil: 2147483647,
              silent: true,
            }),
          })
        );
      } catch {
        // Non-critical if mute fails
      }

      telegramState.vaultChannels.set(sessionString, channel);
      return channel;
    } catch {
      // If channel creation is not permitted by Telegram account limits, fallback safely to 'me'
      return 'me';
    }
  }

  /**
   * Upload a chunk binary buffer directly to Telegram Storage Vault via MTProto.
   * Uses 4-worker parallel streaming and silent notifications for maximum throughput.
   */
  public static async uploadChunk(params: {
    sessionString: string;
    chunkId: string;
    buffer: Buffer;
    filename?: string;
    targetChatId?: string;
  }): Promise<TelegramRefData> {
    const client = await this.getClient(params.sessionString);

    let targetEntity: any = params.targetChatId;
    if (!targetEntity || targetEntity === 'vault') {
      try {
        targetEntity = await this.getOrCreateStorageVault(params.sessionString);
      } catch {
        targetEntity = 'me';
      }
    }

    const filename = params.filename || `chunk_${params.chunkId}.bin`;
    const customFile = new CustomFile(filename, params.buffer.length, '', params.buffer);

    // Stream MTProto 512KB parts using 6 parallel socket workers
    const message = await client.sendFile(targetEntity, {
      file: customFile,
      caption: `[bucketspace-chunk:${params.chunkId}]`,
      silent: true,
      workers: 6,
    });

    const doc = message.media && 'document' in message.media ? (message.media.document as any) : undefined;
    const chatIdStr = typeof targetEntity === 'string' ? targetEntity : String((targetEntity as any)?.id || 'vault');

    return {
      chatId: chatIdStr,
      messageId: message.id,
      fileId: doc ? String(doc.id) : `msg_${message.id}`,
      documentId: doc ? String(doc.id) : undefined,
      accessHash: doc ? String(doc.accessHash) : undefined,
      dcId: doc ? doc.dcId : undefined,
      fileReference: doc?.fileReference ? Buffer.from(doc.fileReference).toString('base64') : undefined,
      size: doc?.size ? Number(doc.size) : params.buffer.length,
    };
  }

  /**
   * Download chunk bytes directly from Telegram Data Center by message ID.
   */
  public static async downloadChunk(params: {
    sessionString: string;
    messageId: number;
    targetChatId?: string;
  }): Promise<Buffer> {
    const client = await this.getClient(params.sessionString);

    let targetEntity: any = params.targetChatId;
    if (!targetEntity || targetEntity === 'vault') {
      try {
        targetEntity = await this.getOrCreateStorageVault(params.sessionString);
      } catch {
        targetEntity = 'me';
      }
    }

    let messages = await client.getMessages(targetEntity, { ids: [params.messageId] });
    if ((!messages || messages.length === 0 || !messages[0] || !messages[0].media) && targetEntity !== 'me') {
      // Fallback for older files stored in 'Saved Messages' before vault creation
      try {
        const fallbackMessages = await client.getMessages('me', { ids: [params.messageId] });
        if (fallbackMessages && fallbackMessages[0] && fallbackMessages[0].media) {
          messages = fallbackMessages;
          targetEntity = 'me';
        }
      } catch {
        // Ignore fallback error
      }
    }

    if (!messages || messages.length === 0 || !messages[0]) {
      throw new Error(`Telegram message #${params.messageId} not found in storage vault or Saved Messages`);
    }

    const message = messages[0];
    if (!message.media) {
      throw new Error(`Telegram message #${params.messageId} does not contain media`);
    }

    const buffer = (await client.downloadMedia(message.media, {})) as Buffer | undefined;

    if (!buffer) {
      throw new Error(`Failed to download media for message #${params.messageId}`);
    }

    return Buffer.from(buffer);
  }

  /**
   * Delete a chunk message from Telegram chat.
   */
  public static async deleteChunk(params: {
    sessionString: string;
    messageId: number;
    targetChatId?: string;
  }): Promise<void> {
    const client = await this.getClient(params.sessionString);

    let targetEntity: any = params.targetChatId;
    if (!targetEntity || targetEntity === 'vault') {
      try {
        targetEntity = await this.getOrCreateStorageVault(params.sessionString);
      } catch {
        targetEntity = 'me';
      }
    }

    try {
      await client.deleteMessages(targetEntity, [params.messageId], { revoke: true });
    } catch {
      // Fallback delete from 'me' if message was from legacy Saved Messages
      if (targetEntity !== 'me') {
        try {
          await client.deleteMessages('me', [params.messageId], { revoke: true });
        } catch {
          // ignore
        }
      }
    }
  }
}
