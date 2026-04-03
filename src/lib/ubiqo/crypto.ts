/**
 * Firma encryption/decryption — AES-256-GCM
 *
 * The `firma` field contains CloudFront signed URL credentials (~24h TTL).
 * We encrypt them at rest so a DB breach doesn't expose downloadable URLs.
 *
 * Key: BBM_FIRMA_ENCRYPTION_KEY env var (64-char hex = 32 bytes recommended).
 * If not set, falls back to plaintext with a warning (acceptable for dev/local).
 *
 * Format: `enc:<iv_base64>:<authtag_base64>:<ciphertext_base64>`
 * Plaintext values (legacy/no-key) are stored as-is (start with '?').
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const ENC_PREFIX = 'enc:';

function getEncryptionKey(): Buffer | null {
  const envKey = process.env.BBM_FIRMA_ENCRYPTION_KEY;
  if (!envKey) return null;

  // 64-char hex → 32 bytes directly; anything else → SHA-256 to get 32 bytes
  if (/^[0-9a-f]{64}$/i.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  return createHash('sha256').update(envKey).digest();
}

/**
 * Encrypt a firma string for storage in the DB.
 * Returns the encrypted value if BBM_FIRMA_ENCRYPTION_KEY is set,
 * otherwise returns plaintext with a warning.
 */
export function encryptFirma(firma: string): string {
  const key = getEncryptionKey();
  if (!key) {
    console.warn('[BBM] BBM_FIRMA_ENCRYPTION_KEY not set — storing firma in plaintext');
    return firma;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(firma, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    iv.toString('base64') + ':' +
    authTag.toString('base64') + ':' +
    encrypted.toString('base64')
  );
}

/**
 * Decrypt a firma value from the DB.
 * Handles both encrypted (`enc:...`) and legacy plaintext values.
 */
export function decryptFirma(stored: string): string {
  // Legacy plaintext or unencrypted (starts with '?' or no enc: prefix)
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('BBM_FIRMA_ENCRYPTION_KEY required to decrypt firma');
  }

  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted firma format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
