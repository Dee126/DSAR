"use client";

import React, { useState, useCallback } from "react";

type ExportState = "idle" | "preparing" | "ready" | "failed";

interface ExportButtonProps {
  /** API endpoint to start export */
  endpoint: string;
  /** Request body for the export */
  body?: unknown;
  /** Button label */
  label?: string;
  /** Filename for download */
  filename?: string;
  /** Additional CSS classes */
  className?: string;
  /** Called when export completes successfully */
  onSuccess?: () => void;
  /** Called when export fails */
  onError?: (error: string) => void;
}

/**
 * Export button with progress and retry.
 *
 * Flow:
 *   idle → (click) → preparing → ready (auto-download) → idle
 *                              → failed → (retry) → preparing → ...
 *
 * Usage:
 *   <ExportButton endpoint="/api/cases/export" body={{ format: "csv" }} filename="cases.csv" />
 */
export function ExportButton({
  endpoint,
  body,
  label = "Export",
  filename = "export.csv",
  className = "",
  onSuccess,
  onError,
}: ExportButtonProps) {
  const [state, setState] = useState<ExportState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startExport = useCallback(async () => {
    setState("preparing");
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body != null ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? json?.error ?? `Export failed (${res.status})`);
      }

      // Check if response is a direct file download
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        // JSON response — may contain a download URL
        const json = await res.json();
        if (json.downloadUrl) {
          setDownloadUrl(json.downloadUrl);
          setState("ready");
          onSuccess?.();
          return;
        }
        // If JSON has data but no URL, create blob from it
        const blob = new Blob([JSON.stringify(json.data ?? json, null, 2)], {
          type: "application/json",
        });
        triggerDownload(blob, filename.replace(/\.csv$/, ".json"));
      } else {
        // Binary response — direct download
        const blob = await res.blob();
        triggerDownload(blob, filename);
      }

      setState("ready");
      onSuccess?.();
      // Reset to idle after brief delay
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed. Please try again.";
      setErrorMessage(msg);
      setState("failed");
      onError?.(msg);
    }
  }, [endpoint, body, filename, onSuccess, onError]);

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDownloadUrl() {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
      setState("idle");
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {state === "idle" && (
        <button
          type="button"
          onClick={startExport}
          className="btn-secondary text-sm"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {label}
        </button>
      )}

      {state === "preparing" && (
        <button type="button" disabled className="btn-secondary text-sm opacity-75">
          <svg className="mr-1.5 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Preparing...
        </button>
      )}

      {state === "ready" && downloadUrl && (
        <button
          type="button"
          onClick={handleDownloadUrl}
          className="btn-primary text-sm"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Download
        </button>
      )}

      {state === "ready" && !downloadUrl && (
        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Downloaded
        </span>
      )}

      {state === "failed" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-600">{errorMessage ?? "Export failed"}</span>
          <button
            type="button"
            onClick={startExport}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportButton;
