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
});
