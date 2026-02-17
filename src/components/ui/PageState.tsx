"use client";

import React from "react";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorBanner } from "./ErrorBanner";
import { EmptyState } from "./EmptyState";

interface PageStateProps {
  /** Whether data is loading */
  loading?: boolean;
  /** Error message (null = no error) */
  error?: string | null;
  /** Whether data is empty */
  empty?: boolean;
  /** Retry handler for error state */
  onRetry?: () => void;
  /** Children to render when data is available */
  children: React.ReactNode;
  /** Skeleton variant for loading state */
  loadingVariant?: "table" | "card" | "stat" | "detail";
  /** Number of skeleton rows */
  loadingRows?: number;
  /** Custom empty state title */
  emptyTitle?: string;
  /** Custom empty state description */
  emptyDescription?: string;
  /** Custom empty state icon */
  emptyIcon?: React.ReactNode;
  /** Custom empty state action */
  emptyAction?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified page state handler.
 * Renders loading skeleton, error banner, or empty state based on props.
 * When none of these states apply, renders children.
 *
 * Usage:
 *   <PageState loading={loading} error={error} empty={items.length === 0} onRetry={refetch}>
 *     <DataTable ... />
 *   </PageState>
 */
export function PageState({
  loading = false,
  error = null,
  empty = false,
  onRetry,
  children,
  loadingVariant = "table",
  loadingRows = 5,
  emptyTitle = "No data found",
  emptyDescription,
  emptyIcon,
  emptyAction,
  className = "",
}: PageStateProps) {
  if (loading) {
    return (
      <LoadingSkeleton
        variant={loadingVariant}
        rows={loadingRows}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <ErrorBanner
        title="Something went wrong"
        message={error}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
        className={className}
      />
    );
  }

  return <>{children}</>;
}

export default PageState;
