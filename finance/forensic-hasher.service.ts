// WO: WO-022
import { createHash } from 'crypto';

/**
 * @class ForensicHasher
 * Provides deterministic SHA-512 hashing for state integrity verification.
 */
export class ForensicHasher {
  public static generateStateHash(data: unknown[]): string {
    const payload = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha512').update(payload).digest('hex');
  }
}
