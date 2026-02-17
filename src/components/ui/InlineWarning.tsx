"use client";

import React from "react";

interface InlineWarningProps {
  /** Warning message */
  message: string;
  /** Severity */
  severity?: "warning" | "info" | "error";
  /** Additional CSS classes */
  className?: string;
}

const SEVERITY_MAP = {
  warning: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", icon: "text-yellow-400" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "text-blue-400" },
  error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "text-red-400" },
};

/**
 * Inline warning message for form fields and workflow gating hints.
 * Compact single-line banner for contextual warnings.
 */
export function InlineWarning({
  message,
  severity = "warning",
  className = "",
}: InlineWarningProps) {
  const s = SEVERITY_MAP[severity];

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${s.bg} ${s.border} ${s.text} ${className}`}
      role="alert"
    >
      <svg className={`h-4 w-4 flex-shrink-0 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export default InlineWarning;
