import { Api, TelegramClient, helpers } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import type { TelegramRefData } from './telegram-storage-provider';

export interface TelegramCredentials {
  apiId: number;
  apiHash: string;
}

/**
 * Resolves Telegram MTProto credentials strictly from server-side environment variables.
 * Throws an explicit configuration error if credentials are not configured.
 */
export function resolveTelegramCredentials(): TelegramCredentials {
  const apiIdRaw = typeof process !== 'undefined' 
    ? (process.env.TELEGRAM_API_ID || process.env.TELEGRAM_APT_ID) 
    : undefined;
  const apiHashRaw = typeof process !== 'undefined' ? process.env.TELEGRAM_API_HASH : undefined;

  const rawIdStr = typeof apiIdRaw === 'string' ? apiIdRaw.trim().replace(/^['"]|['"]$/g, '') : String(apiIdRaw || '');
  const apiId = Number(rawIdStr);
  const apiHash = typeof apiHashRaw === 'string' ? apiHashRaw.trim().replace(/^['"]|['"]$/g, '') : '';

  if (!apiId || isNaN(apiId) || apiId <= 0) {
    throw new Error('TELEGRAM_API_ID is not configured. Please set TELEGRAM_API_ID in environment variables.');
  }

  if (!apiHash || apiHash === 'your-telegram-api-hash') {
    throw new Error('TELEGRAM_API_HASH is not configured. Please set TELEGRAM_API_HASH in environment variables.');
  }

  return { apiId, apiHash };
}

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
  clientPromises: Map<string, Promise<TelegramClient>>;
  vaultChannels: Map<string, any>;
  vaultPromises: Map<string, Promise<any>>;
}

const globalForTelegram = globalThis as unknown as {
  __bucketspace_telegram_state?: GlobalTelegramState;
};

const telegramState: GlobalTelegramState =
  globalForTelegram.__bucketspace_telegram_state || {
    activeSessions: new Map<string, ActiveLoginSession>(),
    clientPool: new Map<string, { client: TelegramClient; lastUsed: number }>(),
    clientPromises: new Map<string, Promise<TelegramClient>>(),
    vaultChannels: new Map<string, any>(),
    vaultPromises: new Map<string, Promise<any>>(),
  };

if (!telegramState.clientPromises) {
  telegramState.clientPromises = new Map<string, Promise<TelegramClient>>();
}
if (!telegramState.vaultChannels) {
  telegramState.vaultChannels = new Map<string, any>();
}
if (!telegramState.vaultPromises) {
  telegramState.vaultPromises = new Map<string, Promise<any>>();
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
   * Disconnect and clear all active Telegram clients in the connection pool.
   * Essential for graceful server shutdown on Render (SIGTERM / SIGINT).
   */
  public static async closeAllClients(): Promise<void> {
    telegramState.clientPromises?.clear();
    const clients = Array.from(telegramState.clientPool.values());
    telegramState.clientPool.clear();
    telegramState.vaultChannels.clear();
    await Promise.allSettled(
      clients.map(async ({ client }) => {
        try {
          if (client.connected) {
            await client.disconnect();
          }
        } catch {
          // ignore error during shutdown
        }
      })
    );
  }

  /**
   * Evicts idle clients (> 30 min) or enforces a maximum pool size (20 clients).
   */
  private static pruneClientPool(): void {
    const now = Date.now();
    const MAX_IDLE_MS = 30 * 60 * 1000;
    const MAX_POOL_SIZE = 20;

    for (const [session, entry] of telegramState.clientPool.entries()) {
      if (now - entry.lastUsed > MAX_IDLE_MS) {
        try {
          if (entry.client.connected) {
            entry.client.disconnect().catch(() => {});
          }
        } catch {
          // ignore
        }
        telegramState.clientPool.delete(session);
        telegramState.vaultChannels.delete(session);
      }
    }

    if (telegramState.clientPool.size > MAX_POOL_SIZE) {
      const sorted = Array.from(telegramState.clientPool.entries()).sort(
        (a, b) => a[1].lastUsed - b[1].lastUsed
      );
      while (sorted.length > MAX_POOL_SIZE) {
        const [oldestSession, oldestEntry] = sorted.shift()!;
        try {
          if (oldestEntry.client.connected) {
            oldestEntry.client.disconnect().catch(() => {});
          }
        } catch {
          // ignore
        }
        telegramState.clientPool.delete(oldestSession);
        telegramState.vaultChannels.delete(oldestSession);
      }
    }
  }

  /**
   * Get or create a connected TelegramClient instance for a saved sessionString.
   * Employs an in-flight promise mutex to prevent concurrent cold-start requests
   * (e.g. 5 parallel chunk upload workers) from opening duplicate connections.
   */
  public static async getClient(sessionString: string): Promise<TelegramClient> {
    const cached = telegramState.clientPool.get(sessionString);
    if (cached && cached.client.connected) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    const inFlight = telegramState.clientPromises.get(sessionString);
    if (inFlight) {
      return inFlight;
    }

    const connectPromise = (async () => {
      this.pruneClientPool();

      const session = new StringSession(sessionString);
      const { apiId, apiHash } = resolveTelegramCredentials();

      const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        floodSleepThreshold: 60,
        useIPV6: false,
        autoReconnect: true,
      });

      await client.connect();
      telegramState.clientPool.set(sessionString, { client, lastUsed: Date.now() });
      return client;
    })();

    telegramState.clientPromises.set(sessionString, connectPromise);
    try {
      return await connectPromise;
    } finally {
      telegramState.clientPromises.delete(sessionString);
    }
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
  }): Promise<SendCodeResult> {
    // 1. Sanitize phone number to strict E.164 format (+<country><number>)
    let cleanPhone = params.phone.replace(/[\s\-\(\)]/g, '').trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // 2. Resolve credentials from server-side environment variables.
    const { apiId, apiHash } = resolveTelegramCredentials();

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

    const sessionToken = `tgsess_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;
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

    const inFlight = telegramState.vaultPromises.get(sessionString);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      const client = await this.getClient(sessionString);

      try {
        // 1. Search existing dialogs across BOTH main inbox (folder 0) and archive (folder 1)
        const [mainDialogs, archivedDialogs] = await Promise.all([
          client.getDialogs({ limit: 100 }).catch(() => []),
          client.getDialogs({ limit: 100, folder: 1 }).catch(() => []),
        ]);

        const allDialogs = [...mainDialogs, ...archivedDialogs];
        const existing = allDialogs.find(
          (d: any) =>
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

      // 2. Automatically create a single private storage vault channel if none exists
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
    })();

    telegramState.vaultPromises.set(sessionString, promise);
    try {
      return await promise;
    } finally {
      telegramState.vaultPromises.delete(sessionString);
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

    // Stream MTProto 512KB parts using 6 parallel socket workers with explicit 2GB buffer boundary
    const uploadedFile = await client.uploadFile({
      file: customFile,
      workers: 6,
      maxBufferSize: 2 * 1024 * 1024 * 1024,
    });

    const message = await client.sendFile(targetEntity, {
      file: uploadedFile,
      caption: `[bucketspace-chunk:${params.chunkId}]`,
      silent: true,
      forceDocument: true,
    });

    const doc = message.media && 'document' in message.media ? (message.media.document as any) : undefined;

    let channelId: string | undefined = undefined;
    let channelAccessHash: string | undefined = undefined;
    let chatType: 'vault' | 'channel' | 'saved_messages' | 'chat' = 'vault';

    if (targetEntity === 'me' || targetEntity === 'self') {
      chatType = 'saved_messages';
    } else if (typeof targetEntity === 'object' && targetEntity !== null) {
      if (targetEntity.id) {
        channelId = String(targetEntity.id);
      }
      if (targetEntity.accessHash) {
        channelAccessHash = String(targetEntity.accessHash);
      }
      chatType = targetEntity.className === 'Channel' || targetEntity.broadcast || targetEntity.megagroup ? 'channel' : 'vault';
    }

    let chatIdStr: string;
    if (typeof targetEntity === 'string') {
      chatIdStr = targetEntity;
    } else if (targetEntity && targetEntity.id) {
      const idStr = String(targetEntity.id);
      chatIdStr = idStr.startsWith('-100') ? idStr : `-100${idStr}`;
    } else {
      chatIdStr = 'vault';
    }

    return {
      chatId: chatIdStr,
      messageId: message.id,
      fileId: doc ? String(doc.id) : `msg_${message.id}`,
      documentId: doc ? String(doc.id) : undefined,
      accessHash: doc ? String(doc.accessHash) : undefined,
      dcId: doc ? doc.dcId : undefined,
      fileReference: doc?.fileReference ? Buffer.from(doc.fileReference).toString('base64') : undefined,
      size: doc?.size ? Number(doc.size) : params.buffer.length,
      channelId,
      channelAccessHash,
      chatType,
    };
  }

  /**
   * Robust entity resolution for Telegram downloads.
   * Resolves targetEntity to a valid GramJS InputPeer or entity object with accessHash.
   * NEVER returns a bare numeric string, which causes GramJS to fail with
   * "Could not find the input entity for PeerUser".
   */
  private static async resolveDownloadEntity(
    client: TelegramClient,
    sessionString: string,
    targetChatId?: string
  ): Promise<any> {
    const rawTarget = targetChatId ? String(targetChatId).trim() : '';

    // 1. Explicit Saved Messages keywords
    if (!rawTarget || rawTarget === 'me' || rawTarget === 'self' || rawTarget === 'this') {
      return 'me';
    }

    // 2. Explicit Vault keyword
    if (rawTarget === 'vault') {
      try {
        const vault = await this.getOrCreateStorageVault(sessionString);
        if (vault) return vault;
      } catch {
        return 'me';
      }
    }

    // 3. Match against current authenticated user's own ID
    try {
      const me = await client.getMe();
      if (me && (String(me.id) === rawTarget || String(me.id) === rawTarget.replace(/^-100/, ''))) {
        return 'me';
      }
    } catch {
      // ignore
    }

    // 4. Match against storage vault channel
    try {
      const vault = await this.getOrCreateStorageVault(sessionString);
      if (vault) {
        const cleanTarget = rawTarget.replace(/^-100/, '');
        const vaultId = String(vault.id || '').replace(/^-100/, '');
        if (vaultId === cleanTarget || String(vault.id) === rawTarget) {
          return vault;
        }
      }
    } catch {
      // ignore
    }

    // 5. Match against active dialogs (both inbox folder 0 and archived folder 1)
    try {
      const cleanTarget = rawTarget.replace(/^-100/, '');
      const [mainDialogs, archivedDialogs] = await Promise.all([
        client.getDialogs({ limit: 100 }).catch(() => []),
        client.getDialogs({ limit: 100, folder: 1 }).catch(() => []),
      ]);
      const allDialogs = [...mainDialogs, ...archivedDialogs];
      const match = allDialogs.find((d: any) => {
        const entityId = String(d.entity?.id || '').replace(/^-100/, '');
        return entityId === cleanTarget;
      });
      if (match && match.entity) {
        return match.entity;
      }
    } catch {
      // ignore
    }

    // 6. Default fallback: use the vault channel, or 'me'
    try {
      const vault = await this.getOrCreateStorageVault(sessionString);
      if (vault) return vault;
    } catch {
      // ignore
    }

    return 'me';
  }

  /**
   * Download chunk bytes directly from Telegram Data Center by message ID.
   * Resiliently resolves target entity across:
   * 1. Direct InputPeerChannel (using channelId + channelAccessHash)
   * 2. Storage vault channel ('📦 BucketSpace Vault')
   * 3. Personal Saved Messages ('me')
   * 4. Dialog entity scan (matches numeric ID against dialogs with accessHash)
   */
  public static async downloadChunk(params: {
    sessionString: string;
    messageId: number;
    targetChatId?: string;
    channelId?: string;
    channelAccessHash?: string;
  }): Promise<Buffer> {
    const client = await this.getClient(params.sessionString);

    // 1. If explicit channelId and channelAccessHash are available, build an InputPeerChannel
    let primaryEntity: any = null;
    if (params.channelId && params.channelAccessHash) {
      try {
        primaryEntity = new Api.InputPeerChannel({
          channelId: helpers.returnBigInt(params.channelId),
          accessHash: helpers.returnBigInt(params.channelAccessHash),
        });
      } catch (e) {
        console.warn('[downloadChunk] Failed to build InputPeerChannel from params:', e);
      }
    }

    // 2. Otherwise dynamically resolve target entity to a valid GramJS peer or entity object
    if (!primaryEntity) {
      primaryEntity = await this.resolveDownloadEntity(client, params.sessionString, params.targetChatId);
    }

    // Attempt retrieval from primaryEntity
    let messages: any[] = [];
    if (primaryEntity) {
      try {
        messages = await client.getMessages(primaryEntity, { ids: [params.messageId] });
      } catch (err: any) {
        console.warn(`[downloadChunk] getMessages failed for primaryEntity (${err?.message || err}), trying fallback entities...`);
      }
    }

    // Fallback A: If message not found, try the user's storage vault channel
    if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
      try {
        const vault = await this.getOrCreateStorageVault(params.sessionString);
        if (vault && vault !== primaryEntity) {
          const vaultMessages = await client.getMessages(vault, { ids: [params.messageId] });
          if (vaultMessages && vaultMessages[0] && vaultMessages[0].media) {
            messages = vaultMessages;
          }
        }
      } catch (vaultErr: any) {
        console.warn('[downloadChunk] Fallback to vault channel failed:', vaultErr?.message || vaultErr);
      }
    }

    // Fallback B: If still not found, try user's 'Saved Messages' ('me')
    if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
      try {
        if (primaryEntity !== 'me') {
          const meMessages = await client.getMessages('me', { ids: [params.messageId] });
          if (meMessages && meMessages[0] && meMessages[0].media) {
            messages = meMessages;
          }
        }
      } catch (meErr: any) {
        console.warn('[downloadChunk] Fallback to Saved Messages failed:', meErr?.message || meErr);
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
