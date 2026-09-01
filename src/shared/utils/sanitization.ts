/**
 * Filename Sanitization Utility
 * Sanitizes user-supplied filenames to prevent path traversal, null-byte injection,
 * control character disruption, and OS-reserved filename collisions.
 */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function sanitizeFilename(inputName: string): string {
  if (!inputName || typeof inputName !== 'string') {
    return 'unnamed_file';
  }

  // 1. Remove null bytes and control characters
  let clean = inputName.replace(/[\x00-\x1f\x7f]/g, '');

  // 2. Remove relative path traversal sequences (../, ..\, ./, .\, etc.)
  clean = clean.replace(/(?:\.\.[/\\]|\.[/\\])+/g, '');

  // 3. Replace remaining path separators (/ and \) with underscores
  clean = clean.replace(/[/\\]+/g, '_');

  // 4. Trim leading dots and whitespace to prevent hidden files
  clean = clean.replace(/^[.\s]+/, '');

  // 5. Trim trailing dots and whitespace (Windows filesystem issue)
  clean = clean.replace(/[.\s]+$/, '');

  // 6. Handle Windows reserved filenames (e.g., CON.txt -> _CON.txt)
  if (WINDOWS_RESERVED.test(clean)) {
    clean = `_${clean}`;
  }

  // 7. Return safe fallback if string became empty
  return clean.length > 0 ? clean : 'unnamed_file';
}
