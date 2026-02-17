/**
 * Typed fetch wrapper with consistent error handling.
 *
 * Every API response follows the shape:
 *   Success: { data: T, pagination?: {...} }
 *   Error:   { error: { code: string, message: string, correlationId?: string } }
 *
 * Usage:
 *   const { data, error } = await api.get<Case[]>("/api/cases?page=1");
 *   if (error) { showToast(error.message); return; }
 *   setCases(data);
 */

export interface ApiError {
  code: string;
  message: string;
  correlationId?: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}

function correlationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const corrId = correlationId();
  const headers: Record<string, string> = {
    "X-Correlation-Id": corrId,
    ...(options.headers as Record<string, string> ?? {}),
  };

  // Auto-set Content-Type for JSON bodies
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  try {
    const res = await fetch(url, { ...options, headers });

    // Handle empty responses (204, etc.)
    if (res.status === 204) {
      return { data: null as T, error: null, status: res.status };
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      // Try to extract structured error from response
      const errorBody = json?.error ?? json;
      return {
        data: null,
        error: {
          code: errorBody?.code ?? `HTTP_${res.status}`,
          message:
            errorBody?.message ??
            errorBody?.error ??
            httpStatusMessage(res.status),
          correlationId: corrId,
        },
        status: res.status,
      };
    }

    // Support both { data: ... } wrapper and raw response
    const data = json?.data !== undefined ? json.data : json;
    return { data: data as T, error: null, status: res.status };
  } catch (err) {
    // Network error / fetch failure
    return {
      data: null,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect. Please check your connection and try again.",
        correlationId: corrId,
      },
      status: 0,
    };
  }
}

function httpStatusMessage(status: number): string {
  const messages: Record<number, string> = {
    400: "Invalid request. Please check your input.",
    401: "Your session has expired. Please sign in again.",
    403: "You don't have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "This action conflicts with the current state.",
    422: "The provided data is invalid.",
    429: "Too many requests. Please wait a moment.",
    500: "An internal error occurred. Please try again.",
    502: "The service is temporarily unavailable.",
    503: "The service is under maintenance. Please try again later.",
  };
  return messages[status] ?? `Request failed (${status}).`;
}

export const api = {
  get<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
    return request<T>(url, { ...options, method: "GET" });
  },

  post<T>(url: string, body?: unknown, options?: RequestInit): Promise<ApiResult<T>> {
    return request<T>(url, {
      ...options,
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown, options?: RequestInit): Promise<ApiResult<T>> {
    return request<T>(url, {
      ...options,
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(url: string, body?: unknown, options?: RequestInit): Promise<ApiResult<T>> {
    return request<T>(url, {
      ...options,
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
    return request<T>(url, { ...options, method: "DELETE" });
  },
};
