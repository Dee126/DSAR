import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption helpers for connector credential blobs.
 *
 * Key sourced from env ENCRYPTION_KEY (or INTEGRATION_ENCRYPTION_KEY as fallback).
 * Must be 32 bytes, base64-encoded.
 *
 * Output format: base64 string containing  iv (12) || ciphertext || authTag (16).
 */

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12; // NIST-recommended for GCM
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const b64 =
    process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "ENCRYPTION_KEY env var is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (got ${key.length})`,
    );
  }
  return key;
}

/**
 * Encrypt a plaintext string, returning a base64 blob
 * containing iv (12 bytes) + ciphertext + authTag (16 bytes).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a base64 blob previously produced by encrypt().
 */
export function decrypt(blob: string): string {
  const key = getKey();
  const combined = Buffer.from(blob, "base64");

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted blob: too short");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
