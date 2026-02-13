import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * SecretStore abstraction for managing integration credentials.
 *
 * - Dev: Encrypts with a server-side key (NEXTAUTH_SECRET) and returns
 *   an encrypted string that can be stored in DB as `secretRef`.
 * - Prod: Would integrate with AWS KMS / Azure Key Vault / GCP Secret Manager.
 *   The interface stays the same; only the implementation changes.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = "privacypilot-secret-salt";

function deriveKey(): Buffer {
  const passphrase = process.env.NEXTAUTH_SECRET || "dev-fallback-key-change-me";
  return scryptSync(passphrase, SALT, 32);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptSecret(secretRef: string): string {
  const key = deriveKey();
  const [ivHex, tagHex, ciphertext] = secretRef.split(":");

  if (!ivHex || !tagHex || !ciphertext) {
    throw new Error("Invalid secretRef format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Store a secret and return a reference string.
 * In dev, this encrypts locally. In prod, this would call a KMS.
 */
export async function storeSecret(plaintext: string): Promise<string> {
  return encryptSecret(plaintext);
}

/**
 * Retrieve a secret from its reference.
 * In dev, this decrypts locally. In prod, this would call a KMS.
 */
export async function retrieveSecret(secretRef: string): Promise<string> {
  return decryptSecret(secretRef);
}

/**
 * Check if a secretRef is present and valid (can be decrypted).
 */
export async function hasValidSecret(secretRef: string | null | undefined): Promise<boolean> {
  if (!secretRef) return false;
  try {
    decryptSecret(secretRef);
    return true;
  } catch {
    return false;
  }
}
