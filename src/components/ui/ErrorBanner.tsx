"use client";

import React from "react";

interface ErrorBannerProps {
  /** Error title */
  title?: string;
  /** Error message (user-safe) */
  message: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Severity level */
  severity?: "error" | "warning" | "info";
  /** Additional CSS classes */
  className?: string;
}

const SEVERITY_STYLES = {
  error: {
    bg: "bg-red-50 border-red-200",
    icon: "text-red-400",
    title: "text-red-800",
    text: "text-red-700",
    btn: "text-red-600 hover:text-red-800",
  },
  warning: {
    bg: "bg-yellow-50 border-yellow-200",
    icon: "text-yellow-400",
    title: "text-yellow-800",
    text: "text-yellow-700",
    btn: "text-yellow-600 hover:text-yellow-800",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: "text-blue-400",
    title: "text-blue-800",
    text: "text-blue-700",
    btn: "text-blue-600 hover:text-blue-800",
  },
};

/**
 * Inline error/warning banner for API failures and validation errors.
 * Shows what happened + what to do (retry/dismiss).
 */
export function ErrorBanner({
  title,
  message,
  onRetry,
  onDismiss,
  severity = "error",
  className = "",
}: ErrorBannerProps) {
  const s = SEVERITY_STYLES[severity];

  return (
    <div
      className={`rounded-lg border p-4 ${s.bg} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 pt-0.5">
          {severity === "error" ? (
            <svg className={`h-5 w-5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : severity === "warning" ? (
            <svg className={`h-5 w-5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className={`h-5 w-5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-sm font-semibold ${s.title}`}>{title}</h3>
          )}
          <p className={`text-sm ${title ? "mt-0.5" : ""} ${s.text}`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={`text-xs font-medium ${s.btn}`}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={`text-xs ${s.btn}`}
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorBanner;
