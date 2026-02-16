"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Widget name shown in the fallback UI */
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for dashboard widgets.
 *
 * Catches render errors in child components and shows a graceful
 * fallback instead of crashing the entire dashboard.
 */
export class DashboardWidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[DashboardWidget] ${this.props.widgetName || "Unknown"} crashed:`,
      error,
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <svg
                className="h-5 w-5 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {this.props.widgetName || "Widget"}
              </h3>
              <p className="mt-0.5 text-xs text-yellow-600">
                This section encountered an error and could not load.
              </p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardWidgetErrorBoundary;
