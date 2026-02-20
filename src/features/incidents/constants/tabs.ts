/**
 * Tab configuration and event type constants for incident detail page.
 */

import type { TabKey } from "../types";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "systems", label: "Systems" },
  { key: "impact", label: "Impact & Assessment" },
  { key: "timeline", label: "Timeline" },
  { key: "communications", label: "Communications" },
  { key: "linked-dsars", label: "Linked DSARs" },
  { key: "export", label: "Authority Export" },
];

export const TIMELINE_EVENT_TYPES = [
  "DETECTED",
  "TRIAGED",
  "CONTAINED",
  "NOTIFIED_AUTHORITY",
  "NOTIFIED_SUBJECTS",
  "REMEDIATION",
  "CLOSED",
  "OTHER",
];

export const TIMELINE_EVENT_LABELS: Record<string, string> = {
  DETECTED: "Detected",
  TRIAGED: "Triaged",
  CONTAINED: "Contained",
  NOTIFIED_AUTHORITY: "Authority Notified",
  NOTIFIED_SUBJECTS: "Subjects Notified",
  REMEDIATION: "Remediation",
  CLOSED: "Closed",
  OTHER: "Other",
};

export const COMMUNICATION_CHANNELS = [
  "EMAIL", "PHONE", "LETTER", "PORTAL", "MEETING", "OTHER",
];

export const COMMUNICATION_DIRECTIONS = ["INBOUND", "OUTBOUND"];
