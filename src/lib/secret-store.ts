/**
 * @deprecated Use `@/lib/security/encryption` directly.
 * This module is kept for backward compatibility only.
 *
 * All new code should import { encrypt, decrypt } from "@/lib/security/encryption".
 */

import { encrypt, decrypt } from "@/lib/security/encryption";

export function encryptSecret(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptSecret(secretRef: string): string {
  return decrypt(secretRef);
}

export async function storeSecret(plaintext: string): Promise<string> {
  return encrypt(plaintext);
}

export async function retrieveSecret(secretRef: string): Promise<string> {
  return decrypt(secretRef);
}

export async function hasValidSecret(secretRef: string | null | undefined): Promise<boolean> {
  if (!secretRef) return false;
  try {
    decrypt(secretRef);
    return true;
  } catch {
    return false;
  }
}
