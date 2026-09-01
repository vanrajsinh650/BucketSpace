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
});
