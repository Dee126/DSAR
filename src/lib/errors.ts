import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { RequestContext } from "./request-context";
import { structuredLog, QueryTimeoutError } from "./request-context";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Standard error response shape.
 * Every error response includes a correlation_id for tracing.
 */
interface ErrorResponseBody {
  error: string;
  code?: string;
  details?: unknown;
  correlation_id?: string;
}

/**
 * Handle API errors and return a structured NextResponse.
 * If a RequestContext is provided, includes correlation_id and emits structured logs.
 */
export function handleApiError(
  error: unknown,
  ctx?: RequestContext,
): NextResponse {
  const correlationId = ctx?.correlationId;

  if (error instanceof ApiError) {
    if (ctx) {
      structuredLog("warn", ctx, "api_error", {
        status: error.statusCode,
        error_message: error.message,
        error_code: error.code,
      });
    }
    const body: ErrorResponseBody = {
      error: error.message,
      code: error.code,
      details: error.details,
    };
    if (correlationId) body.correlation_id = correlationId;
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    if (ctx) {
      structuredLog("warn", ctx, "validation_error", {
        status: 400,
        issues: error.errors.length,
      });
    }
    const body: ErrorResponseBody = {
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    };
    if (correlationId) body.correlation_id = correlationId;
    return NextResponse.json(body, { status: 400 });
  }

  if (error instanceof QueryTimeoutError) {
    if (ctx) {
      structuredLog("error", ctx, "query_timeout", {
        status: 504,
        timeout_ms: error.timeoutMs,
      });
    }
    const body: ErrorResponseBody = {
      error: "Request timed out",
      code: "QUERY_TIMEOUT",
    };
    if (correlationId) body.correlation_id = correlationId;
    return NextResponse.json(body, { status: 504 });
  }

  // Unhandled error — log details server-side, return safe message to client
  if (ctx) {
    structuredLog("error", ctx, "unhandled_error", {
      status: 500,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
    });
  } else {
    console.error("Unhandled API error:", error);
  }

  const body: ErrorResponseBody = {
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  };
  if (correlationId) body.correlation_id = correlationId;
  return NextResponse.json(body, { status: 500 });
}
