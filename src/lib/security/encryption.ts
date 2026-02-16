import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for integration secrets.
 *
 * - Key: 32 bytes from INTEGRATION_ENCRYPTION_KEY (base64-encoded env var).
 * - IV:  12 bytes, randomly generated per encrypt call (NIST SP 800-38D).
 * - Auth tag: 16 bytes, provides ciphertext integrity.
 * - Payload format: base64( iv[12] || authTag[16] || ciphertext[N] )
 *
 * The key is validated eagerly at module load on the server.
 * If the key is missing or the wrong length, the process fails fast.
 */

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// ── Key management ──────────────────────────────────────────────────────

let _cachedKey: Buffer | null = null;

/**
 * Validate and return the 32-byte encryption key.
 * Throws immediately if the env var is missing or the wrong length.
 */
export function validateEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const b64 = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "Invalid INTEGRATION_ENCRYPTION_KEY: must be 32 bytes base64. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid INTEGRATION_ENCRYPTION_KEY: must be 32 bytes base64 (got ${key.length} bytes)`
    );
  }

  _cachedKey = key;
  return key;
}

/**
 * Reset the cached key. Used in tests when swapping env vars.
 * @internal
 */
export function _resetKeyCache(): void {
  _cachedKey = null;
}

// ── Encrypt / Decrypt ───────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns base64( iv[12] + authTag[16] + ciphertext )
 */
export function encrypt(text: string): string {
  const key = validateEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Payload: iv || authTag || ciphertext
  const payload = Buffer.concat([iv, tag, encrypted]);
  return payload.toString("base64");
}

/**
 * Decrypt a base64 blob previously produced by encrypt().
 *
 * Expects format: base64( iv[12] + authTag[16] + ciphertext )
 */
export function decrypt(encrypted: string): string {
  const key = validateEncryptionKey();
  const payload = Buffer.from(encrypted, "base64");

  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload: too short");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
