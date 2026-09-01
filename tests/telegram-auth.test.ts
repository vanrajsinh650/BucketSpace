import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TelegramAuthService } from '../src/modules/storage/telegram/telegram-auth-service';

describe('TelegramAuthService - MTProto 2.0 Authentication', () => {
  it('should generate sandbox demo session when placeholder credentials are used', async () => {
    const result = await TelegramAuthService.sendCode({
      phone: '+919999999999',
    });

    assert.ok(result.sessionToken, 'Session token must be returned');
    assert.ok(result.sessionToken.startsWith('tgsess_dev_'), 'Demo session prefix expected');
    assert.strictEqual(result.phoneCodeHash, 'dev_hash');

    const verifyResult = await TelegramAuthService.verifyCode({
      sessionToken: result.sessionToken,
      code: '12345',
    });

    assert.strictEqual(verifyResult.success, true);
    assert.ok(verifyResult.sessionString?.startsWith('dev_session_'));
  });

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
});
