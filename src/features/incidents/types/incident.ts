/**
 * Types for the incident detail feature.
 */

export interface IncidentContact {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
}

export interface IncidentSystem {
  id: string;
  systemId: string;
  system: {
    id: string;
    name: string;
    description: string | null;
    owner: string | null;
  };
}

export interface IncidentAssessment {
  id: string;
  version: number;
  natureOfBreach: string | null;
  categoriesAndApproxSubjects: string | null;
  categoriesAndApproxRecords: string | null;
  likelyConsequences: string | null;
  measuresTakenOrProposed: string | null;
  dpoContactDetails: string | null;
  additionalNotes: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface RegulatorRecord {
  id: string;
  authorityName: string;
  referenceNumber: string | null;
  status: string;
  submittedAt: string | null;
  notes: string | null;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  description: string;
  occurredAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface Communication {
  id: string;
  direction: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  sentAt: string;
}

export interface LinkedDSAR {
  id: string;
  caseId: string;
  linkReason: string | null;
  case: {
    id: string;
    caseNumber: string;
    type: string;
    status: string;
    priority: string;
    dueDate: string | null;
    dataSubject: { fullName: string } | null;
  };
}

export interface SurgeGroup {
  id: string;
  name: string;
  caseIds: string[];
  createdAt: string;
}

export interface ExportRun {
  id: string;
  status: string;
  options: {
    includeTimeline?: boolean;
    includeDsarList?: boolean;
    includeEvidence?: boolean;
    includeResponses?: boolean;
  };
  createdAt: string;
  completedAt: string | null;
  fileName: string | null;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  detectedAt: string | null;
  containedAt: string | null;
  resolvedAt: string | null;
  regulatorNotified: boolean;
  regulatorNotifiedAt: string | null;
  dataSubjectsEstimate: number | null;
  categoriesOfData: string[] | null;
  crossBorder: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: IncidentContact[];
  incidentSystems: IncidentSystem[];
  assessments: IncidentAssessment[];
  regulatorRecords: RegulatorRecord[];
  timeline: TimelineEvent[];
  communications: Communication[];
  linkedDsars: LinkedDSAR[];
  surgeGroups: SurgeGroup[];
  exportRuns: ExportRun[];
}

export interface SystemOption {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
}

export interface DSARCaseOption {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dataSubject: { fullName: string } | null;
}

export type TabKey =
  | "overview"
  | "systems"
  | "impact"
  | "timeline"
  | "communications"
  | "linked-dsars"
  | "export";
