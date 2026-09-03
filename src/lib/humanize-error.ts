/**
 * Human-friendly error translation for BucketSpace.
 * Converts raw Telegram MTProto RPC codes, network exceptions, and cryptographic
 * errors into clear, actionable consumer messages.
 */

const RPC_ERROR_MAP: Record<string, string> = {
  PHONE_CODE_INVALID: 'The verification code you entered is incorrect. Please check your Telegram app.',
  PHONE_CODE_EXPIRED: 'The verification code has expired. Please request a new code.',
  PHONE_NUMBER_INVALID: 'Please enter a valid international phone number with country code (e.g. +1 555 123 4567).',
  PHONE_PASSWORD_FLOOD: 'Too many attempts. Please wait a few minutes before trying again.',
  FLOOD_WAIT: 'Telegram rate limit reached. Please wait a moment before trying again.',
  PASSWORD_HASH_INVALID: 'Incorrect 2FA password. Please check your Telegram cloud password.',
  SESSION_PASSWORD_NEEDED: 'Two-step verification is enabled on this account. Please enter your Telegram password.',
  AUTH_KEY_UNREGISTERED: 'Your Telegram session has expired. Please sign in again.',
  SESSION_REVOKED: 'Your Telegram session was revoked from another device. Please sign in again.',
  USER_DEACTIVATED: 'This Telegram account has been deactivated.',
  USER_DEACTIVATED_BAN: 'This Telegram account has been suspended by Telegram.',
  API_ID_INVALID: 'The Telegram API credentials are invalid. Please check your settings.',
  FILE_PARTS_INVALID: 'File transfer was interrupted. Please try uploading again.',
  FILE_PART_SIZE_INVALID: 'File chunk size is not supported. Please try again.',
  CHAT_WRITE_FORBIDDEN: 'Unable to write to the storage vault channel. Check permissions.',
};

export function humanizeError(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  const rawMessage: string =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : String((error as any)?.message || error);

  const clean = rawMessage.trim();

  // 1. Direct RPC code matches (e.g. PHONE_CODE_INVALID or RPCError: 400: PHONE_CODE_INVALID)
  for (const [code, friendly] of Object.entries(RPC_ERROR_MAP)) {
    if (clean.includes(code)) {
      return friendly;
    }
  }

  // 2. Network & connection failures
  const lower = clean.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    lower.includes('network request failed')
  ) {
    return 'Unable to connect to the storage server. Please check your internet connection.';
  }

  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborted')) {
    return 'The request took too long to complete. Please try again.';
  }

  // 3. HTTP status codes
  if (lower.includes('413') || lower.includes('payload too large')) {
    return 'This file or chunk is too large for the current connection.';
  }

  if (lower.includes('401') || lower.includes('unauthorized')) {
    return 'Your session has expired. Please reconnect your Telegram account.';
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'Access was denied. Please verify your account permissions.';
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return 'The requested file or link could not be found or has expired.';
  }

  // 4. Decryption / Cryptography errors
  if (lower.includes('client decryption failed') || lower.includes('tag mismatch') || lower.includes('authenticationerror')) {
    return 'Unable to decrypt this file. The encryption key may be different or corrupted.';
  }

  // 5. Clean up typical technical prefixes if no specific pattern matched
  const sanitized = clean
    .replace(/^Error:\s*/i, '')
    .replace(/^RPCError:\s*\d*:\s*/i, '')
    .replace(/^Chunk upload failed:\s*/i, '')
    .replace(/^Upload failed:\s*/i, '');

  if (sanitized.length > 0 && sanitized.length <= 150) {
    return sanitized;
  }

  return 'An unexpected error occurred while processing your request. Please try again.';
}
