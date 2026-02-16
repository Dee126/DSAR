/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * Validates critical environment variables so the process fails fast
 * on misconfiguration instead of returning 500s at request time.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only validate on the Node.js server runtime (not edge, not build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEncryptionKey } = await import(
      "@/lib/security/encryption"
    );

    // Fail fast: if the key is missing or wrong length, the process crashes
    // with a clear error message instead of silently serving 500s.
    validateEncryptionKey();
  }
}
