/**
 * Error Reporting Interface
 *
 * Default: logs to console.
 * Can be wired to Sentry, Datadog, etc. via setReporter().
 *
 * Usage:
 *   import { ErrorReporter } from "@/lib/error-reporter";
 *   ErrorReporter.capture(error, { route: "/api/cases", userId: "u1" });
 */

export interface ErrorContext {
  route?: string;
  userId?: string;
  tenantId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface Reporter {
  capture(error: Error | unknown, context?: ErrorContext): void;
  setUser?(user: { id: string; email?: string; tenantId?: string }): void;
}

/* ── Default Console Reporter ─────────────────────────────────────────── */

const consoleReporter: Reporter = {
  capture(error: Error | unknown, context?: ErrorContext) {
    const err = error instanceof Error ? error : new Error(String(error));
    const meta = context
      ? ` | ${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(" ")}`
      : "";

    console.error(`[ERROR]${meta}`, err.message);

    if (process.env.NODE_ENV === "development") {
      console.error(err.stack);
    }
  },
};

/* ── Singleton ────────────────────────────────────────────────────────── */

let activeReporter: Reporter = consoleReporter;

export const ErrorReporter = {
  /**
   * Capture an error with optional context.
   */
  capture(error: Error | unknown, context?: ErrorContext): void {
    try {
      activeReporter.capture(error, context);
    } catch {
      // Never let error reporting itself throw
      console.error("[ErrorReporter] Failed to report error:", error);
    }
  },

  /**
   * Set user context for error reports (e.g., after login).
   */
  setUser(user: { id: string; email?: string; tenantId?: string }): void {
    activeReporter.setUser?.(user);
  },

  /**
   * Replace the default reporter with a custom implementation.
   * Example: Sentry integration.
   *
   * Usage:
   *   import * as Sentry from "@sentry/nextjs";
   *   ErrorReporter.setReporter({
   *     capture(error, context) {
   *       Sentry.captureException(error, { extra: context });
   *     },
   *     setUser(user) {
   *       Sentry.setUser(user);
   *     },
   *   });
   */
  setReporter(reporter: Reporter): void {
    activeReporter = reporter;
  },

  /**
   * Reset to default console reporter (for testing).
   */
  _reset(): void {
    activeReporter = consoleReporter;
  },
};
