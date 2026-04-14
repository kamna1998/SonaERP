import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * SHA-256 hashing for document integrity — immutable fingerprint
 * used to seal DTAO documents and bid envelopes.
 * Accepts a Buffer, base64 string, or utf-8 string.
 */
export function sha256(input: Buffer | string, encoding: 'utf8' | 'base64' = 'utf8'): string {
  const hash = createHash('sha256');
  if (Buffer.isBuffer(input)) {
    hash.update(input);
  } else if (encoding === 'base64') {
    hash.update(Buffer.from(input, 'base64'));
  } else {
    hash.update(input, 'utf8');
  }
  return hash.digest('hex');
}

/**
 * Computes a combined SHA-256 hash of an ordered list of version hashes.
 * Used to produce an immutable "DTAO technical specification hash" summarizing
 * all sealed technical documents within a DTAO.
 */
export function combinedSha256(hashes: string[]): string {
  const sorted = [...hashes].sort();
  return createHash('sha256').update(sorted.join('|'), 'utf8').digest('hex');
}
