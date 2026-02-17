"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ── Display helpers ──────────────────────────────────────────────────── */

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${formatDate(d)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const INCIDENT_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  CONTAINED: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};

const EXPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  GENERATING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

const REGULATOR_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  INQUIRY: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-green-100 text-green-700",
};

const TIMELINE_EVENT_TYPES = [
  "DETECTED",
  "TRIAGED",
  "CONTAINED",
  "NOTIFIED_AUTHORITY",
  "NOTIFIED_SUBJECTS",
  "REMEDIATION",
  "CLOSED",
  "OTHER",
];

const TIMELINE_EVENT_COLORS: Record<string, string> = {
  DETECTED: "bg-red-500",
  TRIAGED: "bg-orange-500",
  CONTAINED: "bg-yellow-500",
  NOTIFIED_AUTHORITY: "bg-blue-500",
  NOTIFIED_SUBJECTS: "bg-indigo-500",
  REMEDIATION: "bg-purple-500",
  CLOSED: "bg-green-500",
  OTHER: "bg-gray-500",
};

const TIMELINE_EVENT_LABELS: Record<string, string> = {
  DETECTED: "Detected",
  TRIAGED: "Triaged",
  CONTAINED: "Contained",
  NOTIFIED_AUTHORITY: "Authority Notified",
  NOTIFIED_SUBJECTS: "Subjects Notified",
  REMEDIATION: "Remediation",
  CLOSED: "Closed",
  OTHER: "Other",
};

const COMMUNICATION_CHANNELS = ["EMAIL", "PHONE", "LETTER", "PORTAL", "MEETING", "OTHER"];
const COMMUNICATION_DIRECTIONS = ["INBOUND", "OUTBOUND"];

const DSAR_STATUS_COLORS: Record<string, string> = {
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

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

/* ── Types ────────────────────────────────────────────────────────────── */

interface IncidentContact {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
}

interface IncidentSystem {
  id: string;
  systemId: string;
  system: {
    id: string;
    name: string;
    description: string | null;
    owner: string | null;
  };
}

interface IncidentAssessment {
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

interface RegulatorRecord {
  id: string;
  authorityName: string;
  referenceNumber: string | null;
  status: string;
  submittedAt: string | null;
  notes: string | null;
}

interface TimelineEvent {
  id: string;
  eventType: string;
  description: string;
  occurredAt: string;
  createdBy: { id: string; name: string } | null;
}

interface Communication {
  id: string;
  direction: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  sentAt: string;
}

interface LinkedDSAR {
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

interface SurgeGroup {
  id: string;
  name: string;
  caseIds: string[];
  createdAt: string;
}

interface ExportRun {
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

interface Incident {
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

interface SystemOption {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
}

interface DSARCaseOption {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dataSubject: { fullName: string } | null;
}

type TabKey =
  | "overview"
  | "systems"
  | "impact"
  | "timeline"
  | "communications"
  | "linked-dsars"
  | "export";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "systems", label: "Systems" },
  { key: "impact", label: "Impact & Assessment" },
  { key: "timeline", label: "Timeline" },
  { key: "communications", label: "Communications" },
  { key: "linked-dsars", label: "Linked DSARs" },
  { key: "export", label: "Authority Export" },
];

/* ── Component ────────────────────────────────────────────────────────── */

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  /* ── Overview state ── */
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeverity, setEditSeverity] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Contact form state ── */
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  /* ── Systems state ── */
  const [systemsList, setSystemsList] = useState<SystemOption[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [addingSystem, setAddingSystem] = useState(false);
  const [removingSystemId, setRemovingSystemId] = useState<string | null>(null);

  /* ── Assessment form state ── */
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [assessNature, setAssessNature] = useState("");
  const [assessSubjects, setAssessSubjects] = useState("");
  const [assessRecords, setAssessRecords] = useState("");
  const [assessConsequences, setAssessConsequences] = useState("");
  const [assessMeasures, setAssessMeasures] = useState("");
  const [assessDpoContact, setAssessDpoContact] = useState("");
  const [assessNotes, setAssessNotes] = useState("");
  const [addingAssessment, setAddingAssessment] = useState(false);

  /* ── Regulator record form state ── */
  const [showAddRegulator, setShowAddRegulator] = useState(false);
  const [regAuthorityName, setRegAuthorityName] = useState("");
  const [regReferenceNumber, setRegReferenceNumber] = useState("");
  const [regStatus, setRegStatus] = useState("DRAFT");
  const [regNotes, setRegNotes] = useState("");
  const [addingRegulator, setAddingRegulator] = useState(false);

  /* ── Timeline form state ── */
  const [showAddTimeline, setShowAddTimeline] = useState(false);
  const [tlEventType, setTlEventType] = useState("OTHER");
  const [tlDescription, setTlDescription] = useState("");
  const [tlOccurredAt, setTlOccurredAt] = useState("");
  const [addingTimeline, setAddingTimeline] = useState(false);

  /* ── Communication form state ── */
  const [showAddComm, setShowAddComm] = useState(false);
  const [commDirection, setCommDirection] = useState("OUTBOUND");
  const [commChannel, setCommChannel] = useState("EMAIL");
  const [commRecipient, setCommRecipient] = useState("");
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [addingComm, setAddingComm] = useState(false);

  /* ── Linked DSARs state ── */
  const [showLinkDsar, setShowLinkDsar] = useState(false);
  const [dsarSearch, setDsarSearch] = useState("");
  const [dsarOptions, setDsarOptions] = useState<DSARCaseOption[]>([]);
  const [dsarSearching, setDsarSearching] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [linkReason, setLinkReason] = useState("");
  const [linkingDsar, setLinkingDsar] = useState(false);
  const [unlinkingCaseId, setUnlinkingCaseId] = useState<string | null>(null);

  /* ── Surge group state ── */
  const [showCreateSurge, setShowCreateSurge] = useState(false);
  const [surgeName, setSurgeName] = useState("");
  const [surgeCaseIds, setSurgeCaseIds] = useState("");
  const [creatingSurge, setCreatingSurge] = useState(false);

  /* ── Export state ── */
  const [exportIncludeTimeline, setExportIncludeTimeline] = useState(true);
  const [exportIncludeDsarList, setExportIncludeDsarList] = useState(true);
  const [exportIncludeEvidence, setExportIncludeEvidence] = useState(true);
  const [exportIncludeResponses, setExportIncludeResponses] = useState(false);
  const [generatingExport, setGeneratingExport] = useState(false);

  /* ── Fetch incident ── */
  const fetchIncident = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load incident (${res.status})`);
      }
      const data: Incident = await res.json();
      setIncident(data);
      setEditTitle(data.title);
      setEditDescription(data.description ?? "");
      setEditSeverity(data.severity);
      setEditStatus(data.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  /* ── Fetch systems for dropdown ── */
  const fetchSystems = useCallback(async () => {
    setSystemsLoading(true);
    try {
      const res = await fetch("/api/systems");
      if (res.ok) {
        const data = await res.json();
        setSystemsList(Array.isArray(data) ? data : data.systems ?? []);
      }
    } catch {
      // silent
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "systems") {
      fetchSystems();
    }
  }, [activeTab, fetchSystems]);

  /* ── PATCH incident (overview edits) ── */
  async function handleSaveOverview(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          severity: editSeverity,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update incident");
      }
      await fetchIncident();
      setEditing(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  /* ── Add contact ── */
  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    setAddingContact(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_contact",
          name: contactName,
          role: contactRole,
          email: contactEmail || null,
          phone: contactPhone || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add contact");
      }
      await fetchIncident();
      setShowAddContact(false);
      setContactName("");
      setContactRole("");
      setContactEmail("");
      setContactPhone("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  }

  /* ── Add system ── */
  async function handleAddSystem() {
    if (!selectedSystemId) return;
    setAddingSystem(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_system",
          systemId: selectedSystemId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add system");
      }
      await fetchIncident();
      setSelectedSystemId("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add system");
    } finally {
      setAddingSystem(false);
    }
  }

  /* ── Remove system ── */
  async function handleRemoveSystem(systemId: string) {
    setRemovingSystemId(systemId);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_system",
          systemId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove system");
      }
      await fetchIncident();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove system");
    } finally {
      setRemovingSystemId(null);
    }
  }

  /* ── Add assessment ── */
  async function handleAddAssessment(e: FormEvent) {
    e.preventDefault();
    setAddingAssessment(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_assessment",
          natureOfBreach: assessNature || null,
          categoriesAndApproxSubjects: assessSubjects || null,
          categoriesAndApproxRecords: assessRecords || null,
          likelyConsequences: assessConsequences || null,
          measuresTakenOrProposed: assessMeasures || null,
          dpoContactDetails: assessDpoContact || null,
          additionalNotes: assessNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add assessment");
      }
      await fetchIncident();
      setShowAddAssessment(false);
      setAssessNature("");
      setAssessSubjects("");
      setAssessRecords("");
      setAssessConsequences("");
      setAssessMeasures("");
      setAssessDpoContact("");
      setAssessNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add assessment");
    } finally {
      setAddingAssessment(false);
    }
  }

  /* ── Add regulator record ── */
  async function handleAddRegulator(e: FormEvent) {
    e.preventDefault();
    setAddingRegulator(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_regulator",
          authorityName: regAuthorityName,
          referenceNumber: regReferenceNumber || null,
          status: regStatus,
          notes: regNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add regulator record");
      }
      await fetchIncident();
      setShowAddRegulator(false);
      setRegAuthorityName("");
      setRegReferenceNumber("");
      setRegStatus("DRAFT");
      setRegNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add regulator record");
    } finally {
      setAddingRegulator(false);
    }
  }

  /* ── Add timeline event ── */
  async function handleAddTimeline(e: FormEvent) {
    e.preventDefault();
    setAddingTimeline(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_timeline",
          eventType: tlEventType,
          description: tlDescription,
          occurredAt: tlOccurredAt || new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add timeline event");
      }
      await fetchIncident();
      setShowAddTimeline(false);
      setTlEventType("OTHER");
      setTlDescription("");
      setTlOccurredAt("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add timeline event");
    } finally {
      setAddingTimeline(false);
    }
  }

  /* ── Add communication ── */
  async function handleAddComm(e: FormEvent) {
    e.preventDefault();
    setAddingComm(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_communication",
          direction: commDirection,
          channel: commChannel,
          recipient: commRecipient || null,
          subject: commSubject || null,
          body: commBody || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add communication");
      }
      await fetchIncident();
      setShowAddComm(false);
      setCommDirection("OUTBOUND");
      setCommChannel("EMAIL");
      setCommRecipient("");
      setCommSubject("");
      setCommBody("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add communication");
    } finally {
      setAddingComm(false);
    }
  }

  /* ── Search DSAR cases ── */
  async function handleSearchDsars() {
    setDsarSearching(true);
    try {
      const q = dsarSearch ? `?search=${encodeURIComponent(dsarSearch)}` : "";
      const res = await fetch(`/api/cases${q}`);
      if (res.ok) {
        const data = await res.json();
        setDsarOptions(Array.isArray(data) ? data : data.cases ?? []);
      }
    } catch {
      // silent
    } finally {
      setDsarSearching(false);
    }
  }

  /* ── Link DSAR ── */
  async function handleLinkDsar(e: FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setLinkingDsar(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          linkReason: linkReason || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to link DSAR");
      }
      await fetchIncident();
      setShowLinkDsar(false);
      setSelectedCaseId("");
      setLinkReason("");
      setDsarSearch("");
      setDsarOptions([]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to link DSAR");
    } finally {
      setLinkingDsar(false);
    }
  }

  /* ── Unlink DSAR ── */
  async function handleUnlinkDsar(caseId: string) {
    if (!confirm("Unlink this DSAR case from the incident?")) return;
    setUnlinkingCaseId(caseId);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/incidents?incidentId=${incidentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to unlink DSAR");
      }
      await fetchIncident();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unlink DSAR");
    } finally {
      setUnlinkingCaseId(null);
    }
  }

  /* ── Create surge group ── */
  async function handleCreateSurge(e: FormEvent) {
    e.preventDefault();
    setCreatingSurge(true);
    try {
      const caseIds = surgeCaseIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/incidents/${incidentId}/surge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: surgeName,
          caseIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create surge group");
      }
      await fetchIncident();
      setShowCreateSurge(false);
      setSurgeName("");
      setSurgeCaseIds("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create surge group");
    } finally {
      setCreatingSurge(false);
    }
  }

  /* ── Generate export ── */
  async function handleGenerateExport() {
    setGeneratingExport(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeTimeline: exportIncludeTimeline,
          includeDsarList: exportIncludeDsarList,
          includeEvidence: exportIncludeEvidence,
          includeResponses: exportIncludeResponses,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate export");
      }
      await fetchIncident();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate export");
    } finally {
      setGeneratingExport(false);
    }
  }

  /* ── Download export ── */
  function handleDownloadExport(exportRunId: string) {
    window.open(
      `/api/incidents/${incidentId}/export?exportRunId=${exportRunId}&download=pdf`,
      "_blank"
    );
  }

  /* ── Loading / Error states ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error || "Incident not found"}
        </div>
        <Link
          href="/governance"
          className="mt-4 inline-block text-brand-600 hover:underline"
        >
          Back to Governance
        </Link>
      </div>
    );
  }

  /* ── Available systems not yet linked ── */
  const linkedSystemIds = new Set(
    incident.incidentSystems.map((is) => is.systemId)
  );
  const availableSystems = systemsList.filter(
    (s) => !linkedSystemIds.has(s.id)
  );

  /* ── Render ── */
  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/governance"
            className="text-sm text-gray-500 hover:text-brand-600 mb-2 inline-block"
          >
            &larr; Back to Governance
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {incident.title}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                SEVERITY_COLORS[incident.severity] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {incident.severity}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                INCIDENT_STATUS_COLORS[incident.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {incident.status}
            </span>
            {incident.crossBorder && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                Cross-Border
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Overview
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ── Editable detail card ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Incident Details
              </h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditTitle(incident.title);
                    setEditDescription(incident.description ?? "");
                    setEditSeverity(incident.severity);
                    setEditStatus(incident.status);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSaveOverview} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Severity
                    </label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="OPEN">Open</option>
                      <option value="CONTAINED">Contained</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {incident.description && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {incident.description}
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Severity
                    </p>
                    <span
                      className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        SEVERITY_COLORS[incident.severity] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Status
                    </p>
                    <span
                      className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        INCIDENT_STATUS_COLORS[incident.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Cross-Border
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {incident.crossBorder ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Data Subjects (est.)
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {incident.dataSubjectsEstimate != null
                        ? incident.dataSubjectsEstimate.toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Key Dates ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Key Dates
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Created
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(incident.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Detected
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(incident.detectedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Contained
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(incident.containedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Resolved
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(incident.resolvedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Regulator Notification ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Regulator Notification
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Notified
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {incident.regulatorNotified ? (
                    <span className="text-green-700 font-medium">Yes</span>
                  ) : (
                    <span className="text-red-700 font-medium">No</span>
                  )}
                </p>
              </div>
              {incident.regulatorNotified && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Notification Date
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(incident.regulatorNotifiedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Categories of Data ── */}
          {incident.categoriesOfData && incident.categoriesOfData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Categories of Data Affected
              </h2>
              <div className="flex flex-wrap gap-2">
                {incident.categoriesOfData.map((cat, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Source ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Source
            </h2>
            <p className="text-sm text-gray-700">
              {incident.source ?? "Not specified"}
            </p>
          </div>

          {/* ── Contacts ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showAddContact ? "Cancel" : "Add Contact"}
              </button>
            </div>

            {showAddContact && (
              <form
                onSubmit={handleAddContact}
                className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <input
                      type="text"
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      required
                      placeholder="e.g. DPO, IT Lead, Legal"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingContact}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingContact ? "Adding..." : "Add Contact"}
                  </button>
                </div>
              </form>
            )}

            {incident.contacts.length === 0 ? (
              <p className="text-sm text-gray-500">No contacts added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.contacts.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {c.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {c.role}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {c.email ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {c.phone ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Systems
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "systems" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Linked Systems
              </h2>
            </div>

            {/* Add system control */}
            <div className="mb-6 flex items-end gap-3 bg-gray-50 rounded-lg p-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add System
                </label>
                {systemsLoading ? (
                  <p className="text-sm text-gray-500">Loading systems...</p>
                ) : (
                  <select
                    value={selectedSystemId}
                    onChange={(e) => setSelectedSystemId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Select a system...</option>
                    {availableSystems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.owner ? ` (${s.owner})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={handleAddSystem}
                disabled={!selectedSystemId || addingSystem}
                className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {addingSystem ? "Adding..." : "Add"}
              </button>
            </div>

            {/* Systems list */}
            {incident.incidentSystems.length === 0 ? (
              <p className="text-sm text-gray-500">
                No systems linked to this incident yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        System
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Owner
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.incidentSystems.map((is) => (
                      <tr key={is.id}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {is.system.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {is.system.description ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {is.system.owner ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <button
                            onClick={() => handleRemoveSystem(is.systemId)}
                            disabled={removingSystemId === is.systemId}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                          >
                            {removingSystemId === is.systemId
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Impact & Assessment
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "impact" && (
        <div className="space-y-6">
          {/* ── Latest Assessment ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Impact Assessment (Art. 33 / 34)
              </h2>
              <button
                onClick={() => setShowAddAssessment(!showAddAssessment)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showAddAssessment ? "Cancel" : "New Assessment Version"}
              </button>
            </div>

            {showAddAssessment && (
              <form
                onSubmit={handleAddAssessment}
                className="mb-6 bg-gray-50 rounded-lg p-4 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nature of Breach
                  </label>
                  <textarea
                    value={assessNature}
                    onChange={(e) => setAssessNature(e.target.value)}
                    rows={3}
                    placeholder="Describe the nature of the personal data breach..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categories & Approx. Number of Subjects
                    </label>
                    <textarea
                      value={assessSubjects}
                      onChange={(e) => setAssessSubjects(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categories & Approx. Number of Records
                    </label>
                    <textarea
                      value={assessRecords}
                      onChange={(e) => setAssessRecords(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Likely Consequences
                  </label>
                  <textarea
                    value={assessConsequences}
                    onChange={(e) => setAssessConsequences(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Measures Taken or Proposed
                  </label>
                  <textarea
                    value={assessMeasures}
                    onChange={(e) => setAssessMeasures(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DPO Contact Details
                  </label>
                  <input
                    type="text"
                    value={assessDpoContact}
                    onChange={(e) => setAssessDpoContact(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={assessNotes}
                    onChange={(e) => setAssessNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingAssessment}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingAssessment ? "Saving..." : "Save Assessment"}
                  </button>
                </div>
              </form>
            )}

            {/* Display assessments */}
            {incident.assessments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No assessments recorded yet. Click &quot;New Assessment Version&quot; to add one.
              </p>
            ) : (
              <div className="space-y-4">
                {incident.assessments.map((a, idx) => (
                  <div
                    key={a.id}
                    className={`border rounded-lg p-4 ${
                      idx === 0
                        ? "border-brand-300 bg-brand-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Version {a.version}
                        </h3>
                        {idx === 0 && (
                          <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(a.createdAt)}
                        {a.createdBy ? ` by ${a.createdBy.name}` : ""}
                      </span>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 text-sm">
                      {a.natureOfBreach && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Nature of Breach
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.natureOfBreach}
                          </dd>
                        </div>
                      )}
                      {a.categoriesAndApproxSubjects && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Categories & Approx. Subjects
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.categoriesAndApproxSubjects}
                          </dd>
                        </div>
                      )}
                      {a.categoriesAndApproxRecords && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Categories & Approx. Records
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.categoriesAndApproxRecords}
                          </dd>
                        </div>
                      )}
                      {a.likelyConsequences && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Likely Consequences
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.likelyConsequences}
                          </dd>
                        </div>
                      )}
                      {a.measuresTakenOrProposed && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Measures Taken or Proposed
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.measuresTakenOrProposed}
                          </dd>
                        </div>
                      )}
                      {a.dpoContactDetails && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            DPO Contact Details
                          </dt>
                          <dd className="text-gray-600 mt-0.5">
                            {a.dpoContactDetails}
                          </dd>
                        </div>
                      )}
                      {a.additionalNotes && (
                        <div>
                          <dt className="font-medium text-gray-700">
                            Additional Notes
                          </dt>
                          <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">
                            {a.additionalNotes}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Regulator Records ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Regulator Records
              </h2>
              <button
                onClick={() => setShowAddRegulator(!showAddRegulator)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showAddRegulator ? "Cancel" : "Add Record"}
              </button>
            </div>

            {showAddRegulator && (
              <form
                onSubmit={handleAddRegulator}
                className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Authority Name *
                    </label>
                    <input
                      type="text"
                      value={regAuthorityName}
                      onChange={(e) => setRegAuthorityName(e.target.value)}
                      required
                      placeholder="e.g. ICO, CNIL, BfDI"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      value={regReferenceNumber}
                      onChange={(e) => setRegReferenceNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={regStatus}
                      onChange={(e) => setRegStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SUBMITTED">Submitted</option>
                      <option value="INQUIRY">Inquiry</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={regNotes}
                      onChange={(e) => setRegNotes(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingRegulator}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingRegulator ? "Adding..." : "Add Record"}
                  </button>
                </div>
              </form>
            )}

            {incident.regulatorRecords.length === 0 ? (
              <p className="text-sm text-gray-500">
                No regulator records yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Authority
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Reference
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Submitted
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.regulatorRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {r.authorityName}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {r.referenceNumber ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              REGULATOR_STATUS_COLORS[r.status] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatDate(r.submittedAt)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {r.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Timeline
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Incident Timeline
              </h2>
              <button
                onClick={() => setShowAddTimeline(!showAddTimeline)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showAddTimeline ? "Cancel" : "Add Event"}
              </button>
            </div>

            {showAddTimeline && (
              <form
                onSubmit={handleAddTimeline}
                className="mb-6 bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type *
                    </label>
                    <select
                      value={tlEventType}
                      onChange={(e) => setTlEventType(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      {TIMELINE_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TIMELINE_EVENT_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Occurred At
                    </label>
                    <input
                      type="datetime-local"
                      value={tlOccurredAt}
                      onChange={(e) => setTlOccurredAt(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    value={tlDescription}
                    onChange={(e) => setTlDescription(e.target.value)}
                    required
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingTimeline}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingTimeline ? "Adding..." : "Add Event"}
                  </button>
                </div>
              </form>
            )}

            {/* Visual timeline */}
            {incident.timeline.length === 0 ? (
              <p className="text-sm text-gray-500">
                No timeline events recorded yet.
              </p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {incident.timeline
                    .sort(
                      (a, b) =>
                        new Date(a.occurredAt).getTime() -
                        new Date(b.occurredAt).getTime()
                    )
                    .map((ev) => (
                      <div key={ev.id} className="relative flex items-start ml-4 pl-6">
                        {/* Dot */}
                        <div
                          className={`absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            TIMELINE_EVENT_COLORS[ev.eventType] ?? "bg-gray-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                                TIMELINE_EVENT_COLORS[ev.eventType] ?? "bg-gray-500"
                              }`}
                            >
                              {TIMELINE_EVENT_LABELS[ev.eventType] ?? ev.eventType}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(ev.occurredAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {ev.description}
                          </p>
                          {ev.createdBy && (
                            <p className="text-xs text-gray-400 mt-1">
                              by {ev.createdBy.name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Communications
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "communications" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Communications
              </h2>
              <button
                onClick={() => setShowAddComm(!showAddComm)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showAddComm ? "Cancel" : "Add Communication"}
              </button>
            </div>

            {showAddComm && (
              <form
                onSubmit={handleAddComm}
                className="mb-6 bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Direction
                    </label>
                    <select
                      value={commDirection}
                      onChange={(e) => setCommDirection(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      {COMMUNICATION_DIRECTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Channel
                    </label>
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      {COMMUNICATION_CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient
                    </label>
                    <input
                      type="text"
                      value={commRecipient}
                      onChange={(e) => setCommRecipient(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={commSubject}
                      onChange={(e) => setCommSubject(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body
                  </label>
                  <textarea
                    value={commBody}
                    onChange={(e) => setCommBody(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingComm}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingComm ? "Sending..." : "Add Communication"}
                  </button>
                </div>
              </form>
            )}

            {incident.communications.length === 0 ? (
              <p className="text-sm text-gray-500">
                No communications recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Direction
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Channel
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Recipient
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Subject
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.communications.map((comm) => (
                      <tr key={comm.id}>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              comm.direction === "INBOUND"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {comm.direction}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {comm.channel}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {comm.recipient ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {comm.subject ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatDate(comm.sentAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Linked DSARs
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "linked-dsars" && (
        <div className="space-y-6">
          {/* ── Linked Cases ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Linked DSAR Cases
              </h2>
              <button
                onClick={() => {
                  setShowLinkDsar(!showLinkDsar);
                  if (!showLinkDsar) {
                    setDsarOptions([]);
                    setDsarSearch("");
                    setSelectedCaseId("");
                    setLinkReason("");
                  }
                }}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showLinkDsar ? "Cancel" : "Link DSAR"}
              </button>
            </div>

            {/* Link DSAR dialog */}
            {showLinkDsar && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Cases
                    </label>
                    <input
                      type="text"
                      value={dsarSearch}
                      onChange={(e) => setDsarSearch(e.target.value)}
                      placeholder="Search by case number, subject name..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <button
                    onClick={handleSearchDsars}
                    disabled={dsarSearching}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {dsarSearching ? "Searching..." : "Search"}
                  </button>
                </div>

                {dsarOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Case
                    </label>
                    <select
                      value={selectedCaseId}
                      onChange={(e) => setSelectedCaseId(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="">Choose a case...</option>
                      {dsarOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.caseNumber} - {c.dataSubject?.fullName ?? "Unknown"}{" "}
                          ({c.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedCaseId && (
                  <form onSubmit={handleLinkDsar} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link Reason
                      </label>
                      <input
                        type="text"
                        value={linkReason}
                        onChange={(e) => setLinkReason(e.target.value)}
                        placeholder="Reason for linking this DSAR to the incident..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={linkingDsar}
                        className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        {linkingDsar ? "Linking..." : "Link Case"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Linked cases table */}
            {incident.linkedDsars.length === 0 ? (
              <p className="text-sm text-gray-500">
                No DSAR cases linked to this incident yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Case Number
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Priority
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Data Subject
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Link Reason
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.linkedDsars.map((ld) => (
                      <tr key={ld.id}>
                        <td className="px-4 py-2 text-sm">
                          <Link
                            href={`/cases/${ld.case.id}`}
                            className="text-brand-600 hover:text-brand-700 font-medium"
                          >
                            {ld.case.caseNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {ld.case.type}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              DSAR_STATUS_COLORS[ld.case.status] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ld.case.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              PRIORITY_COLORS[ld.case.priority] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ld.case.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatDate(ld.case.dueDate)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {ld.case.dataSubject?.fullName ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {ld.linkReason ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <button
                            onClick={() => handleUnlinkDsar(ld.caseId)}
                            disabled={unlinkingCaseId === ld.caseId}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                          >
                            {unlinkingCaseId === ld.caseId
                              ? "Unlinking..."
                              : "Unlink"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Surge Groups ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Surge Groups
              </h2>
              <button
                onClick={() => setShowCreateSurge(!showCreateSurge)}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
              >
                {showCreateSurge ? "Cancel" : "Create Surge Group"}
              </button>
            </div>

            {showCreateSurge && (
              <form
                onSubmit={handleCreateSurge}
                className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={surgeName}
                    onChange={(e) => setSurgeName(e.target.value)}
                    required
                    placeholder="e.g. Batch 1 - Affected users"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Case IDs (comma-separated) *
                  </label>
                  <input
                    type="text"
                    value={surgeCaseIds}
                    onChange={(e) => setSurgeCaseIds(e.target.value)}
                    required
                    placeholder="case-id-1, case-id-2, ..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingSurge}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {creatingSurge ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </form>
            )}

            {incident.surgeGroups.length === 0 ? (
              <p className="text-sm text-gray-500">
                No surge groups created yet.
              </p>
            ) : (
              <div className="space-y-3">
                {incident.surgeGroups.map((sg) => (
                  <div
                    key={sg.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {sg.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        Created {formatDate(sg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {sg.caseIds.length} case{sg.caseIds.length !== 1 ? "s" : ""}
                    </p>
                    {sg.caseIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sg.caseIds.map((cid) => (
                          <span
                            key={cid}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono"
                          >
                            {cid.substring(0, 8)}...
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Authority Export
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "export" && (
        <div className="space-y-6">
          {/* ── Generate new export ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generate Authority Pack
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Generate a comprehensive export pack for supervisory authority
              notification under Art. 33 GDPR.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={exportIncludeTimeline}
                  onChange={(e) => setExportIncludeTimeline(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Include Timeline
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={exportIncludeDsarList}
                  onChange={(e) => setExportIncludeDsarList(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Include DSAR List
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={exportIncludeEvidence}
                  onChange={(e) => setExportIncludeEvidence(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Include Evidence
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={exportIncludeResponses}
                  onChange={(e) => setExportIncludeResponses(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Include Responses
              </label>
            </div>

            <button
              onClick={handleGenerateExport}
              disabled={generatingExport}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {generatingExport ? "Generating..." : "Generate Authority Pack"}
            </button>
          </div>

          {/* ── Previous exports ── */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Export History
            </h2>

            {incident.exportRuns.length === 0 ? (
              <p className="text-sm text-gray-500">
                No exports generated yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Options
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Completed
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incident.exportRuns.map((ex) => (
                      <tr key={ex.id}>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatDateTime(ex.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              EXPORT_STATUS_COLORS[ex.status] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ex.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          <div className="flex flex-wrap gap-1">
                            {ex.options.includeTimeline && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                Timeline
                              </span>
                            )}
                            {ex.options.includeDsarList && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                DSARs
                              </span>
                            )}
                            {ex.options.includeEvidence && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                Evidence
                              </span>
                            )}
                            {ex.options.includeResponses && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                Responses
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {formatDateTime(ex.completedAt)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {ex.status === "COMPLETED" && (
                            <button
                              onClick={() => handleDownloadExport(ex.id)}
                              className="text-brand-600 hover:text-brand-700 text-sm font-medium"
                            >
                              Download PDF
                            </button>
                          )}
                          {ex.status === "GENERATING" && (
                            <span className="text-xs text-blue-600">
                              Processing...
                            </span>
                          )}
                          {ex.status === "FAILED" && (
                            <span className="text-xs text-red-600">
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
