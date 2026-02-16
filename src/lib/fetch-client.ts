/**
 * Client-side fetch wrapper with retry, backoff, and structured error handling.
 *
 * Used by dashboard widgets to fetch data reliably.
 */

export interface FetchOptions {
  /** Number of retry attempts for transient failures (default: 2) */
  retries?: number;
  /** Initial backoff delay in ms (default: 1000). Doubles on each retry. */
  backoffMs?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /** Request init overrides */
  init?: RequestInit;
}

export interface FetchResult<T> {
  data: T | null;
  error: string | null;
  /** HTTP status code, or 0 for network errors */
  status: number;
  /** Error code from server response */
  code: string | null;
  /** Whether this is a permission error (403) */
  permissionDenied: boolean;
  /** Correlation ID from server (if available) */
  correlationId: string | null;
}

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with automatic retry and exponential backoff.
 *
 * - Retries on network errors and 5xx/408/429 responses
 * - Returns structured result with error classification
 * - Never throws — always returns a FetchResult
 */
export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult<T>> {
  const { retries = 2, backoffMs = 1000, signal, init } = options;

  let lastError: string | null = null;
  let lastStatus = 0;
  let lastCode: string | null = null;
  let correlationId: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal,
        headers: {
          Accept: "application/json",
          ...init?.headers,
        },
      });

      correlationId =
        res.headers.get("x-correlation-id") ?? null;
      lastStatus = res.status;

      if (res.ok) {
        const data = await res.json();
        return {
          data: data as T,
          error: null,
          status: res.status,
          code: null,
          permissionDenied: false,
          correlationId,
        };
      }

      // Parse error body
      let errorBody: { error?: string; code?: string; permissionDenied?: boolean } = {};
      try {
        errorBody = await res.json();
      } catch {
        // response body not JSON
      }

      lastError = errorBody.error || `HTTP ${res.status}`;
      lastCode = errorBody.code || null;

      // 401/403 — do not retry
      if (res.status === 401 || res.status === 403) {
        return {
          data: null,
          error: lastError,
          status: res.status,
          code: lastCode,
          permissionDenied: res.status === 403,
          correlationId,
        };
      }

      // Non-retryable client error
      if (res.status >= 400 && res.status < 500 && !RETRYABLE_STATUSES.has(res.status)) {
        return {
          data: null,
          error: lastError,
          status: res.status,
          code: lastCode,
          permissionDenied: false,
          correlationId,
        };
      }

      // Retryable — continue loop
    } catch (err) {
      // Network error or abort
      if (signal?.aborted) {
        return {
          data: null,
          error: "Request aborted",
          status: 0,
          code: "ABORTED",
          permissionDenied: false,
          correlationId: null,
        };
      }
      lastError = err instanceof Error ? err.message : "Network error";
      lastStatus = 0;
      lastCode = "NETWORK_ERROR";
    }

    // Backoff before next retry (unless last attempt)
    if (attempt < retries) {
      const delay = backoffMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return {
    data: null,
    error: lastError || "Request failed",
    status: lastStatus,
    code: lastCode,
    permissionDenied: false,
    correlationId,
  };
}
