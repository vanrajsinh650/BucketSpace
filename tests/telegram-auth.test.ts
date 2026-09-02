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

  it('should validate and enforce configured credentials in resolveTelegramCredentials', () => {
    const { resolveTelegramCredentials } = require('../src/modules/storage/telegram/telegram-auth-service');
    assert.throws(
      () => resolveTelegramCredentials({ apiId: 0, apiHash: 'valid_hash' }),
      /TELEGRAM_API_ID is not configured/i
    );
    assert.throws(
      () => resolveTelegramCredentials({ apiId: 12345, apiHash: '' }),
      /TELEGRAM_API_HASH is not configured/i
    );
    const resolved = resolveTelegramCredentials({ apiId: 12345, apiHash: 'abc123hash' });
    assert.strictEqual(resolved.apiId, 12345);
    assert.strictEqual(resolved.apiHash, 'abc123hash');
  });
});
