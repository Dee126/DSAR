/**
 * Request Context & Structured Logging
 *
 * Provides correlation IDs, tenant-scoped context, structured JSON logging,
 * safe serialization, and timeboxed query execution.
 */

import { randomUUID } from "crypto";

// ─── Request Context ──────────────────────────────────────────────────────────

export interface RequestContext {
  correlationId: string;
  tenantId: string | null;
  actorId: string | null;
  route: string;
  startedAt: number;
}

/**
 * Build a request context from an incoming request and optional auth info.
 * Extracts or generates a correlation ID from the `x-correlation-id` header.
 */
export function withRequestContext(
  req: Request,
  auth?: { tenantId?: string; id?: string } | null,
): RequestContext {
  const correlationId =
    req.headers.get("x-correlation-id") || randomUUID();
  const url = new URL(req.url);
  return {
    correlationId,
    tenantId: auth?.tenantId ?? null,
    actorId: auth?.id ?? null,
    route: `${req.method} ${url.pathname}`,
    startedAt: Date.now(),
  };
}

// ─── Structured Logger ────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlation_id: string;
  tenant_id: string | null;
  route: string;
  action: string;
  duration_ms?: number;
  status?: number;
  error?: string;
  [key: string]: unknown;
}

const PII_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.]+/g,  // emails
];

/** Mask PII in a string value. */
function maskPii(value: string): string {
  let masked = value;
  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      const [local, domain] = match.split("@");
      if (!domain) return "***";
      return `${local[0]}***@${domain}`;
    });
  }
  return masked;
}

/** Emit a structured JSON log line. Never includes raw PII. */
export function structuredLog(
  level: LogLevel,
  ctx: RequestContext,
  action: string,
  extra?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlation_id: ctx.correlationId,
    tenant_id: ctx.tenantId,
    route: ctx.route,
    action,
    duration_ms: Date.now() - ctx.startedAt,
  };

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      entry[k] = typeof v === "string" ? maskPii(v) : v;
    }
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ─── Safe JSON Serialization ──────────────────────────────────────────────────

/**
 * Safely serialize data for JSON responses.
 * Handles BigInt → number/string, Date → ISO string.
 */
export function safeJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "bigint") {
        return value <= Number.MAX_SAFE_INTEGER ? Number(value) : String(value);
      }
      return value;
    }),
  );
}

// ─── Timeboxed Query Execution ────────────────────────────────────────────────

export class QueryTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Query timed out after ${timeoutMs}ms`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * Execute an async function with a timeout.
 * If the function takes longer than `ms`, rejects with QueryTimeoutError.
 * The original promise still runs (Prisma doesn't support abort), but the
 * caller can move on and return a partial/fallback response.
 */
export async function timeboxedQuery<T>(
  fn: () => Promise<T>,
  ms: number,
  ctx?: RequestContext,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (ctx) {
          structuredLog("warn", ctx, "query_timeout", { timeout_ms: ms });
        }
        reject(new QueryTimeoutError(ms));
      }
    }, ms);

    fn()
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}
