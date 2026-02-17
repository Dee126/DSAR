"use client";

interface LoadingSkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
  /** Variant for different contexts */
  variant?: "table" | "card" | "stat" | "detail" | "inline";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Consistent skeleton loading placeholders.
 * Uses animate-pulse matching existing dashboard patterns.
 */
export function LoadingSkeleton({
  rows = 5,
  variant = "table",
  className = "",
}: LoadingSkeletonProps) {
  if (variant === "stat") {
    return (
      <div className={`card animate-pulse ${className}`} role="status" aria-label="Loading">
        <div className="h-4 w-20 rounded bg-gray-200" />
        <div className="mt-3 h-8 w-12 rounded bg-gray-200" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`card animate-pulse space-y-4 ${className}`} role="status" aria-label="Loading">
        <div className="h-5 w-1/3 rounded bg-gray-200" />
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${85 - i * 10}%` }} />
          ))}
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`space-y-6 ${className}`} role="status" aria-label="Loading">
        <div className="card animate-pulse space-y-3">
          <div className="h-6 w-1/4 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`inline-block h-4 w-16 animate-pulse rounded bg-gray-200 align-middle ${className}`} role="status" aria-label="Loading">
        <span className="sr-only">Loading...</span>
      </span>
    );
  }

  // Default: table rows
  return (
    <div className={`space-y-3 p-6 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default LoadingSkeleton;
