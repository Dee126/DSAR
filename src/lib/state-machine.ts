import { CaseStatus } from "@prisma/client";

const TRANSITION_MAP: Record<CaseStatus, CaseStatus[]> = {
  NEW: [CaseStatus.IDENTITY_VERIFICATION, CaseStatus.INTAKE_TRIAGE, CaseStatus.REJECTED],
  IDENTITY_VERIFICATION: [CaseStatus.INTAKE_TRIAGE, CaseStatus.REJECTED],
  INTAKE_TRIAGE: [CaseStatus.DATA_COLLECTION, CaseStatus.REJECTED],
  DATA_COLLECTION: [CaseStatus.REVIEW_LEGAL],
  REVIEW_LEGAL: [CaseStatus.RESPONSE_PREPARATION, CaseStatus.DATA_COLLECTION],
  RESPONSE_PREPARATION: [CaseStatus.RESPONSE_SENT],
  RESPONSE_SENT: [CaseStatus.CLOSED],
  CLOSED: [],
  REJECTED: [CaseStatus.CLOSED],
};

export function getAllowedTransitions(current: CaseStatus): CaseStatus[] {
  return TRANSITION_MAP[current] ?? [];
}

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  const allowed = TRANSITION_MAP[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "New",
  IDENTITY_VERIFICATION: "Identity Verification",
  INTAKE_TRIAGE: "Intake & Triage",
  DATA_COLLECTION: "Data Collection",
  REVIEW_LEGAL: "Legal Review",
  RESPONSE_PREPARATION: "Response Preparation",
  RESPONSE_SENT: "Response Sent",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800",
  INTAKE_TRIAGE: "bg-orange-100 text-orange-800",
  DATA_COLLECTION: "bg-purple-100 text-purple-800",
  REVIEW_LEGAL: "bg-indigo-100 text-indigo-800",
  RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800",
  RESPONSE_SENT: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
};
