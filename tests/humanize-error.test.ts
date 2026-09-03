import { describe, it } from 'node:test';
import assert from 'node:assert';
import { humanizeError } from '../src/lib/humanize-error';

describe('humanizeError - Consumer Error Translation', () => {
  it('should translate raw Telegram RPC error codes into friendly user messages', () => {
    assert.strictEqual(
      humanizeError('RPCError: 400: PHONE_CODE_INVALID'),
      'The verification code you entered is incorrect. Please check your Telegram app.'
    );

    assert.strictEqual(
      humanizeError('PHONE_CODE_EXPIRED'),
      'The verification code has expired. Please request a new code.'
    );

    assert.strictEqual(
      humanizeError('SESSION_PASSWORD_NEEDED'),
      'Two-step verification is enabled on this account. Please enter your Telegram password.'
    );

    assert.strictEqual(
      humanizeError('PASSWORD_HASH_INVALID'),
      'Incorrect 2FA password. Please check your Telegram cloud password.'
    );
  });

  it('should translate network and connection exceptions into clear offline messages', () => {
    assert.strictEqual(
      humanizeError(new Error('Failed to fetch')),
      'Unable to connect to the storage server. Please check your internet connection.'
    );

    assert.strictEqual(
      humanizeError('NetworkError when attempting to fetch resource.'),
      'Unable to connect to the storage server. Please check your internet connection.'
    );

    assert.strictEqual(
      humanizeError('connect ECONNREFUSED 127.0.0.1:4000'),
      'Unable to connect to the storage server. Please check your internet connection.'
    );
  });

  it('should translate request timeout and abort exceptions', () => {
    assert.strictEqual(
      humanizeError(new Error('The operation was aborted due to timeout')),
      'The request took too long to complete. Please try again.'
    );

    assert.strictEqual(
      humanizeError('ETIMEDOUT connection timed out'),
      'The request took too long to complete. Please try again.'
    );
  });

  it('should translate HTTP status code errors gracefully', () => {
    assert.strictEqual(
      humanizeError('HTTP 413: Payload Too Large'),
      'This file or chunk is too large for the current connection.'
    );

    assert.strictEqual(
      humanizeError('HTTP 401 Unauthorized'),
      'Your session has expired. Please reconnect your Telegram account.'
    );

    assert.strictEqual(
      humanizeError('404 Not Found: share token missing'),
      'The requested file or link could not be found or has expired.'
    );
  });

  it('should translate cryptographic decryption failures', () => {
    assert.strictEqual(
      humanizeError(new Error('Client decryption failed: Cryptographic authentication tag mismatch')),
      'Unable to decrypt this file. The encryption key may be different or corrupted.'
    );
  });

  it('should sanitize technical prefixes while preserving safe custom error text', () => {
    assert.strictEqual(
      humanizeError(new Error('Upload failed: Storage quota exceeded')),
      'Storage quota exceeded'
    );

    assert.strictEqual(
      humanizeError(null),
      'An unexpected error occurred. Please try again.'
    );

    assert.strictEqual(
      humanizeError(undefined),
      'An unexpected error occurred. Please try again.'
    );
  });
});
