import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import type { TelegramRefData } from './telegram-storage-provider';

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

/**
 * Real Telegram MTProto 2.0 Authentication & Chunk Storage Service.
 *
 * Provides phone OTP login, 2FA password handling, client connection pooling,
 * and direct MTProto binary chunk upload/download streaming to Telegram Saved Messages.
 */
export class TelegramAuthService {
  private static activeSessions = new Map<string, ActiveLoginSession>();
  private static clientPool = new Map<string, { client: TelegramClient; lastUsed: number }>();

  /**
   * Get or create a connected TelegramClient instance for a saved sessionString.
   */
  public static async getClient(sessionString: string): Promise<TelegramClient> {
    const cached = this.clientPool.get(sessionString);
    if (cached && cached.client.connected) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    const apiId = Number(process.env.TELEGRAM_API_ID) || 0;
    const apiHash = process.env.TELEGRAM_API_HASH || '';

    if (!apiId || !apiHash) {
      throw new Error('Telegram API ID and Hash are required for MTProto storage.');
    }

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    this.clientPool.set(sessionString, { client, lastUsed: Date.now() });
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
          id: String(me.id),
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
    const apiId = params.apiId || Number(process.env.TELEGRAM_API_ID) || 0;
    const apiHash = params.apiHash || process.env.TELEGRAM_API_HASH || '';

    if (!apiId || !apiHash) {
      throw new Error(
        'Telegram API ID and API Hash are required to send verification codes. You can get them from https://my.telegram.org under API development tools.'
      );
    }

    // Clean up any previous session for this phone number or expired sessions (> 10 min)
    for (const [token, existing] of this.activeSessions.entries()) {
      if (existing.phone === params.phone || Date.now() - existing.createdAt > 10 * 60 * 1000) {
        try {
          await existing.client.disconnect();
        } catch {
          // ignore disconnect error
        }
        this.activeSessions.delete(token);
      }
    }

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
      params.phone
    );

    const sessionToken = `tgsess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.activeSessions.set(sessionToken, {
      client,
      phone: params.phone,
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
    const session = this.activeSessions.get(params.sessionToken);
    if (!session || !session.phoneCodeHash) {
      throw new Error('Authentication session expired or not found. Please request a new code.');
    }

    try {
      await session.client.signInUser(
        {
          apiId: session.apiId,
          apiHash: session.apiHash,
        },
        {
          phoneNumber: async () => session.phone,
          phoneCode: async () => params.code,
          onError: (err) => {
            throw err;
          },
        }
      );

      const sessionString = session.client.session.save() as unknown as string;
      this.activeSessions.delete(params.sessionToken);
      return { success: true, sessionString };
    } catch (err: any) {
      const msg = (err?.errorMessage || err?.message || '').toLowerCase();
      if (
        msg.includes('session_password_needed') ||
        msg.includes('2fa') ||
        msg.includes('password')
      ) {
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
    const session = this.activeSessions.get(params.sessionToken);
    if (!session) {
      throw new Error('Authentication session expired. Please start again.');
    }

    await session.client.signInWithPassword(
      {
        apiId: session.apiId,
        apiHash: session.apiHash,
      },
      {
        password: async () => params.password,
        onError: (err) => {
          throw err;
        },
      }
    );

    const sessionString = session.client.session.save() as unknown as string;
    this.activeSessions.delete(params.sessionToken);
    return { success: true, sessionString };
  }

  /**
   * Upload a chunk binary buffer directly to Telegram Saved Messages ('me') via MTProto.
   */
  public static async uploadChunk(params: {
    sessionString: string;
    chunkId: string;
    buffer: Buffer;
    filename?: string;
    targetChatId?: string;
  }): Promise<TelegramRefData> {
    const client = await this.getClient(params.sessionString);
    const targetEntity = params.targetChatId || 'me';
    const filename = params.filename || `chunk_${params.chunkId}.bin`;

    const customFile = new CustomFile(filename, params.buffer.length, '', params.buffer);
    const message = await client.sendFile(targetEntity, {
      file: customFile,
      caption: `[bucketspace-chunk:${params.chunkId}]`,
    });

    const doc = message.media && 'document' in message.media ? (message.media.document as any) : undefined;

    return {
      chatId: targetEntity,
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
    const targetEntity = params.targetChatId || 'me';

    const messages = await client.getMessages(targetEntity, { ids: [params.messageId] });
    if (!messages || messages.length === 0 || !messages[0]) {
      throw new Error(`Telegram message #${params.messageId} not found in chat '${targetEntity}'`);
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
    const targetEntity = params.targetChatId || 'me';
    await client.deleteMessages(targetEntity, [params.messageId], { revoke: true });
  }
}
