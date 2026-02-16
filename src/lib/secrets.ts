import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Falls back to a dev-only default with a loud warning.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.PRIVACYPILOT_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "base64");
    if (buf.length >= 32) return buf.subarray(0, 32);
    // Pad if too short
    const padded = Buffer.alloc(32);
    buf.copy(padded);
    return padded;
  }

  // Dev fallback — WARN loudly
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL: PRIVACYPILOT_SECRET or INTEGRATION_ENCRYPTION_KEY must be set in production!"
    );
  }
  console.warn(
    "⚠️  WARNING: Using insecure default encryption key for development. " +
    "Set PRIVACYPILOT_SECRET or INTEGRATION_ENCRYPTION_KEY for production!"
  );
  return Buffer.from("privacypilot-dev-key-do-not-use!"); // exactly 32 bytes
}

/**
 * Encrypt a plaintext string. Returns base64-encoded string: iv + ciphertext + authTag.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv(12) + ciphertext(n) + authTag(16)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64-encoded ciphertext string. Returns the original plaintext.
 */
export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
