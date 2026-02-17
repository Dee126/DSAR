"use client";

type BadgeVariant = "status" | "priority" | "risk" | "type" | "neutral";

interface DataBadgeProps {
  /** The value to display */
  label: string;
  /** The variant determines color mapping */
  variant?: BadgeVariant;
  /** Specific color key for lookup (e.g. "NEW", "HIGH", "RED") */
  colorKey?: string;
  /** Additional CSS classes */
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800",
  INTAKE_TRIAGE: "bg-orange-100 text-orange-800",
  DATA_COLLECTION: "bg-purple-100 text-purple-800",
  REVIEW_LEGAL: "bg-indigo-100 text-indigo-800",
  RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800",
  RESPONSE_SENT: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
  // Task statuses
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
  // Job statuses
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  RUNNING: "bg-blue-100 text-blue-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const RISK_COLORS: Record<string, string> = {
  GREEN: "bg-green-100 text-green-700",
  YELLOW: "bg-yellow-100 text-yellow-700",
  RED: "bg-red-100 text-red-700",
};

const TYPE_COLORS: Record<string, string> = {
  ACCESS: "bg-blue-100 text-blue-700",
  ERASURE: "bg-red-100 text-red-700",
  RECTIFICATION: "bg-orange-100 text-orange-700",
  RESTRICTION: "bg-purple-100 text-purple-700",
  PORTABILITY: "bg-cyan-100 text-cyan-700",
  OBJECTION: "bg-yellow-100 text-yellow-700",
};

const COLOR_MAPS: Record<BadgeVariant, Record<string, string>> = {
  status: STATUS_COLORS,
  priority: PRIORITY_COLORS,
  risk: RISK_COLORS,
  type: TYPE_COLORS,
  neutral: {},
};

/** Friendly display labels for status values */
const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  IDENTITY_VERIFICATION: "Identity Verification",
  INTAKE_TRIAGE: "Intake & Triage",
  DATA_COLLECTION: "Data Collection",
  REVIEW_LEGAL: "Legal Review",
  RESPONSE_PREPARATION: "Response Preparation",
  RESPONSE_SENT: "Response Sent",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  SUCCESS: "Success",
  FAILED: "Failed",
  RUNNING: "Running",
};

/**
 * Unified badge component for status, priority, risk, and type values.
 * Centralizes the color mapping that was duplicated across pages.
 */
export function DataBadge({
  label,
  variant = "neutral",
  colorKey,
  className = "",
}: DataBadgeProps) {
  const key = colorKey ?? label;
  const colorMap = COLOR_MAPS[variant];
  const colorClasses = colorMap[key] ?? "bg-gray-100 text-gray-700";
  const displayLabel = variant === "status" ? (STATUS_LABELS[label] ?? label) : label;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses} ${className}`}
    >
      {displayLabel}
    </span>
  );
}

export default DataBadge;
