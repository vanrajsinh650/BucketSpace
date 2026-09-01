import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { IPasscodeHasher } from '@/shared';

/**
 * ScryptPasscodeHasher implements OWASP-compliant adaptive password hashing
 * for public share link passcodes:
 *
 * - Parameters: scrypt (N=131072, r=8, p=1, 16-byte random salt, 64-byte key output)
 * - Format: $scrypt$N=131072,r=8,p=1$<saltHex>$<hashHex>
 * - Verification: Uses crypto.timingSafeEqual for constant-time comparison.
 */
export class ScryptPasscodeHasher implements IPasscodeHasher {
  private static readonly N = 131072;
  private static readonly R = 8;
  private static readonly P = 1;
  private static readonly KEY_LEN = 64;

  public async hashPasscode(passcode: string): Promise<string> {
    if (!passcode) {
      throw new Error('Passcode cannot be empty');
    }

    const salt = randomBytes(16);
    const derivedKey = scryptSync(passcode, salt, ScryptPasscodeHasher.KEY_LEN, {
      N: ScryptPasscodeHasher.N,
      r: ScryptPasscodeHasher.R,
      p: ScryptPasscodeHasher.P,
      maxmem: 256 * 1024 * 1024,
    });

    return `$scrypt$N=${ScryptPasscodeHasher.N},r=${ScryptPasscodeHasher.R},p=${ScryptPasscodeHasher.P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  public async verifyPasscode(passcode: string, storedHash: string): Promise<boolean> {
    if (!passcode || !storedHash) return false;

    try {
      const parts = storedHash.split('$');
      // Expected format: ["", "scrypt", "N=131072,r=8,p=1", saltHex, hashHex]
      if (parts.length !== 5 || parts[1] !== 'scrypt') {
        return false;
      }

      const saltHex = parts[3];
      const targetHashHex = parts[4];

      const salt = Buffer.from(saltHex, 'hex');
      const targetHash = Buffer.from(targetHashHex, 'hex');

      const computedKey = scryptSync(passcode, salt, targetHash.length, {
        N: ScryptPasscodeHasher.N,
        r: ScryptPasscodeHasher.R,
        p: ScryptPasscodeHasher.P,
        maxmem: 256 * 1024 * 1024,
      });

      if (computedKey.length !== targetHash.length) return false;

      // Constant-time comparison to prevent timing side-channel attacks
      return timingSafeEqual(computedKey, targetHash);
    } catch {
      return false;
    }
  }
}
