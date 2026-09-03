import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TelegramAuthService } from '../src/modules/storage/telegram/telegram-auth-service';

describe('TelegramAuthService - MTProto 2.0 Authentication', () => {
  it('should reject invalid or expired verification sessions', async () => {
    await assert.rejects(
      async () => {
        await TelegramAuthService.verifyCode({
          sessionToken: 'invalid_session_token_12345',
          code: '12345',
        });
      },
      /expired or not found/i
    );
  });

  it('should reject invalid session in verify2FA', async () => {
    await assert.rejects(
      async () => {
        await TelegramAuthService.verify2FA({
          sessionToken: 'nonexistent_session',
          password: 'secret',
        });
      },
      /expired|not found/i
    );
  });

  it('should validate and enforce server-configured credentials in resolveTelegramCredentials', () => {
    const { resolveTelegramCredentials } = require('../src/modules/storage/telegram/telegram-auth-service');
    const originalApiId = process.env.TELEGRAM_API_ID;
    const originalApiHash = process.env.TELEGRAM_API_HASH;

    try {
      delete process.env.TELEGRAM_API_ID;
      delete process.env.TELEGRAM_API_HASH;
      assert.throws(() => resolveTelegramCredentials(), /TELEGRAM_API_ID is not configured/i);

      process.env.TELEGRAM_API_ID = '12345';
      assert.throws(() => resolveTelegramCredentials(), /TELEGRAM_API_HASH is not configured/i);

      process.env.TELEGRAM_API_HASH = 'abc123hash';
      const resolved = resolveTelegramCredentials();
      assert.strictEqual(resolved.apiId, 12345);
      assert.strictEqual(resolved.apiHash, 'abc123hash');
    } finally {
      if (originalApiId === undefined) delete process.env.TELEGRAM_API_ID;
      else process.env.TELEGRAM_API_ID = originalApiId;
      if (originalApiHash === undefined) delete process.env.TELEGRAM_API_HASH;
      else process.env.TELEGRAM_API_HASH = originalApiHash;
    }
  });

  it('should reject unauthenticated downloadChunk with controlled error', async () => {
    await assert.rejects(
      async () => {
        await TelegramAuthService.downloadChunk({
          sessionString: '1BVtsInvalidSessionString...',
          messageId: 1234,
          targetChatId: 'vault',
          channelId: '4331787451',
          channelAccessHash: '9876543210',
        });
      },
      /No more data left to read|AUTH_KEY_UNREGISTERED|SESSION_REVOKED|Invalid session|Could not connect|expired/i
    );
  });

  it('should handle backward-compatible numeric chatId without crashing on PeerUser resolution', async () => {
    // Old providerRef references contain raw numeric chatId like '4331787451'
    await assert.rejects(
      async () => {
        await TelegramAuthService.downloadChunk({
          sessionString: '1BVtsInvalidSessionString...',
          messageId: 5678,
          targetChatId: '4331787451',
        });
      },
      // Must fail on auth/connection, NEVER throw unhandled "Could not find the input entity for PeerUser"
      /No more data left to read|AUTH_KEY_UNREGISTERED|SESSION_REVOKED|Invalid session|Could not connect|expired/i
    );
  });
});
