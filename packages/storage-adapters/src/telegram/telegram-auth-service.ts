import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

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
 * Real Telegram MTProto 2.0 Authentication Service.
 *
 * Dispatches real OTP verification codes directly to the user's Telegram app/SMS
 * using GramJS MTProto client and handles 2FA cloud password challenges.
 */
export class TelegramAuthService {
  private static activeSessions = new Map<string, ActiveLoginSession>();

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
}
