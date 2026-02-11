"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ── Display helpers ──────────────────────────────────────────────────── */

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
};

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
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  BLOCKED: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"];

const TRANSITION_MAP: Record<string, string[]> = {
  NEW: ["IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "REJECTED"],
  IDENTITY_VERIFICATION: ["INTAKE_TRIAGE", "REJECTED"],
  INTAKE_TRIAGE: ["DATA_COLLECTION", "REJECTED"],
  DATA_COLLECTION: ["REVIEW_LEGAL"],
  REVIEW_LEGAL: ["RESPONSE_PREPARATION", "DATA_COLLECTION"],
  RESPONSE_PREPARATION: ["RESPONSE_SENT"],
  RESPONSE_SENT: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

const DOC_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

function getSlaIndicator(dueDate: string): "ok" | "due_soon" | "overdue" {
  const diff =
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "due_soon";
  return "ok";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/* ── Types ────────────────────────────────────────────────────────────── */

interface CaseUser {
  id: string;
  name: string;
  email: string;
}

interface DataSubject {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface StateTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  reason: string;
  changedBy: CaseUser;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  assignee: CaseUser | null;
}

interface Document {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  classification: string;
  uploadedAt: string;
  uploadedBy: CaseUser;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: CaseUser;
}

interface DSARCaseDetail {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  priority: string;
  lawfulBasis: string | null;
  receivedAt: string;
  dueDate: string;
  channel: string | null;
  requesterType: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  dataSubject: DataSubject;
  createdBy: CaseUser;
  assignedTo: CaseUser | null;
  assignedToUserId: string | null;
  stateTransitions: StateTransition[];
  tasks: Task[];
  documents: Document[];
  comments: Comment[];
}

const MANAGE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];
const EXPORT_ROLES = ["CASE_MANAGER", "DPO", "TENANT_ADMIN", "SUPER_ADMIN"];

/* ── Component ────────────────────────────────────────────────────────── */

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<DSARCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<CaseUser[]>([]);

  // Transition state
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState("");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editLawfulBasis, setEditLawfulBasis] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  // Add task
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Upload document
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docClassification, setDocClassification] = useState("INTERNAL");
  const [uploading, setUploading] = useState(false);

  // Add comment
  const [commentBody, setCommentBody] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Document viewer
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const userRole = session?.user?.role ?? "";
  const canManage = MANAGE_ROLES.includes(userRole);
  const canExport = EXPORT_ROLES.includes(userRole);

  const fetchCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      if (res.ok) {
        setCaseData(await res.json());
      } else if (res.status === 404) {
        router.push("/cases");
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          setUsers(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        /* silently fail */
      }
    }
    fetchUsers();
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────────── */

  async function handleTransition() {
    if (!transitionReason.trim()) return;
    setTransitioning(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: transitionTarget,
          reason: transitionReason,
        }),
      });
      if (res.ok) {
        setShowTransitionModal(false);
        setTransitionTarget("");
        setTransitionReason("");
        await fetchCase();
      }
    } catch {
      /* silently fail */
    } finally {
      setTransitioning(false);
    }
  }

  function startEditing() {
    if (!caseData) return;
    setEditDescription(caseData.description ?? "");
    setEditLawfulBasis(caseData.lawfulBasis ?? "");
    setEditPriority(caseData.priority);
    setEditAssignee(caseData.assignedToUserId ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription || undefined,
          lawfulBasis: editLawfulBasis || undefined,
          priority: editPriority,
          assignedToUserId: editAssignee || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await fetchCase();
      }
    } catch {
      /* silently fail */
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription || undefined,
          assigneeUserId: taskAssignee || undefined,
          dueDate: taskDueDate
            ? new Date(taskDueDate).toISOString()
            : undefined,
        }),
      });
      if (res.ok) {
        setShowAddTask(false);
        setTaskTitle("");
        setTaskDescription("");
        setTaskAssignee("");
        setTaskDueDate("");
        await fetchCase();
      }
    } catch {
      /* silently fail */
    } finally {
      setAddingTask(false);
    }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchCase();
    } catch {
      /* silently fail */
    }
  }

  async function handleUploadDocument(e: FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("classification", docClassification);

      const res = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setDocFile(null);
        setDocClassification("INTERNAL");
        await fetchCase();
      }
    } catch {
      /* silently fail */
    } finally {
      setUploading(false);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setAddingComment(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      if (res.ok) {
        setCommentBody("");
        await fetchCase();
      }
    } catch {
      /* silently fail */
    } finally {
      setAddingComment(false);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch(`/api/cases/${caseId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${caseData?.caseNumber ?? "case"}-export.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      /* silently fail */
    }
  }

  /* ── Loading / Not Found ──────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
        <div className="card h-48 animate-pulse" />
        <div className="card h-32 animate-pulse" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Case not found.</p>
        <Link href="/cases" className="btn-primary mt-4 inline-flex">
          Back to Cases
        </Link>
      </div>
    );
  }

  const sla = getSlaIndicator(caseData.dueDate);
  const allowedTransitions = TRANSITION_MAP[caseData.status] ?? [];

  // Build timeline: merge transitions + comments, sorted by date
  const timelineItems = [
    ...caseData.stateTransitions.map((t) => ({
      id: t.id,
      date: t.changedAt,
      type: "transition" as const,
      data: t,
    })),
    ...caseData.comments.map((c) => ({
      id: c.id,
      date: c.createdAt,
      type: "comment" as const,
      data: c,
    })),
  ].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/cases"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {caseData.caseNumber}
              </h1>
              <span
                data-testid="case-status"
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[caseData.status] ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {STATUS_LABELS[caseData.status] ?? caseData.status}
              </span>
              <span
                data-testid="case-type"
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  PRIORITY_COLORS[caseData.priority] ??
                  "bg-gray-100 text-gray-700"
                }`}
              >
                {caseData.priority}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span
                className={`flex items-center gap-1.5 ${
                  sla === "overdue"
                    ? "font-medium text-red-600"
                    : sla === "due_soon"
                    ? "font-medium text-yellow-600"
                    : "text-gray-500"
                }`}
              >
                {sla === "overdue" && (
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                )}
                {sla === "due_soon" && (
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                )}
                {sla === "ok" && (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                )}
                Due {new Date(caseData.dueDate).toLocaleDateString()}
                {sla === "overdue" && " (Overdue)"}
                {sla === "due_soon" && " (Due Soon)"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {canExport && (
            <button onClick={handleExport} className="btn-secondary" data-testid="export-evidence">
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Export Evidence
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Overview Card */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
              {canManage && !editing && (
                <button
                  onClick={startEditing}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Edit
                </button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="input-field"
                    >
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Assignee</label>
                    <select
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Lawful Basis</label>
                  <input
                    type="text"
                    value={editLawfulBasis}
                    onChange={(e) => setEditLawfulBasis(e.target.value)}
                    className="input-field"
                    placeholder="e.g., GDPR Article 6(1)(b)"
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="input-field resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-gray-900">{caseData.type}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Channel</dt>
                    <dd className="mt-1 text-gray-900">
                      {caseData.channel || (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">
                      Requester Type
                    </dt>
                    <dd className="mt-1 text-gray-900">
                      {caseData.requesterType || (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Lawful Basis</dt>
                    <dd className="mt-1 text-gray-900">
                      {caseData.lawfulBasis || (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Received</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(caseData.receivedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Assignee</dt>
                    <dd className="mt-1 text-gray-900">
                      {caseData.assignedTo?.name || (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {caseData.description && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <dt className="text-sm font-medium text-gray-500">
                      Description
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {caseData.description}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Transitions */}
          {canManage && allowedTransitions.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900">
                Status Transition
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Current status:{" "}
                <span className="font-medium">
                  {STATUS_LABELS[caseData.status] ?? caseData.status}
                </span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {allowedTransitions.map((target) => (
                  <button
                    key={target}
                    data-status={target}
                    onClick={() => {
                      setTransitionTarget(target);
                      setShowTransitionModal(true);
                    }}
                    className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      target === "REJECTED"
                        ? "border-red-200 text-red-700 hover:bg-red-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <svg
                      className="mr-1.5 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                    {STATUS_LABELS[target] ?? target}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transition Modal */}
          {showTransitionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900">
                  Transition to{" "}
                  {STATUS_LABELS[transitionTarget] ?? transitionTarget}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  From:{" "}
                  {STATUS_LABELS[caseData.status] ?? caseData.status}
                </p>
                <div className="mt-4">
                  <label className="label">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="reason"
                    value={transitionReason}
                    onChange={(e) => setTransitionReason(e.target.value)}
                    rows={3}
                    className="input-field resize-y"
                    placeholder="Provide a reason for this status change..."
                    autoFocus
                  />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowTransitionModal(false);
                      setTransitionTarget("");
                      setTransitionReason("");
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="confirm-transition"
                    onClick={handleTransition}
                    disabled={!transitionReason.trim() || transitioning}
                    className="btn-primary"
                  >
                    {transitioning ? "Transitioning..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            {timelineItems.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No activity yet.</p>
            ) : (
              <div className="mt-4 space-y-0">
                {timelineItems.map((item, idx) => (
                  <div key={item.id} className="relative flex gap-4 pb-6">
                    {/* Vertical line */}
                    {idx < timelineItems.length - 1 && (
                      <div className="absolute left-[15px] top-8 h-full w-px bg-gray-200" />
                    )}
                    {/* Icon */}
                    <div className="relative z-10 flex-shrink-0">
                      {item.type === "transition" ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
                          <svg
                            className="h-4 w-4 text-brand-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                          <svg
                            className="h-4 w-4 text-gray-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      {item.type === "transition" ? (
                        <>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              {(item.data as StateTransition).changedBy.name}
                            </span>{" "}
                            changed status from{" "}
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                STATUS_COLORS[
                                  (item.data as StateTransition).fromStatus
                                ] ?? "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {STATUS_LABELS[
                                (item.data as StateTransition).fromStatus
                              ] ?? (item.data as StateTransition).fromStatus}
                            </span>{" "}
                            to{" "}
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                STATUS_COLORS[
                                  (item.data as StateTransition).toStatus
                                ] ?? "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {STATUS_LABELS[
                                (item.data as StateTransition).toStatus
                              ] ?? (item.data as StateTransition).toStatus}
                            </span>
                          </p>
                          {(item.data as StateTransition).reason && (
                            <p className="mt-1 text-sm text-gray-600 italic">
                              &ldquo;
                              {(item.data as StateTransition).reason}&rdquo;
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              {(item.data as Comment).author.name}
                            </span>{" "}
                            commented
                          </p>
                          <div className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                            {(item.data as Comment).body}
                          </div>
                        </>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(item.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks Section */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
              {canManage && (
                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {showAddTask ? "Cancel" : "+ Add Task"}
                </button>
              )}
            </div>

            {showAddTask && (
              <form
                onSubmit={handleAddTask}
                className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div>
                  <label className="label">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="input-field"
                    placeholder="Task title"
                    required
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={2}
                    className="input-field resize-y"
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Assignee</label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingTask}
                    className="btn-primary text-sm"
                  >
                    {addingTask ? "Adding..." : "Add Task"}
                  </button>
                </div>
              </form>
            )}

            {caseData.tasks.length === 0 && !showAddTask ? (
              <p className="mt-4 text-sm text-gray-500">
                No tasks yet. Add a task to track work for this case.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {caseData.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {task.title}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            TASK_STATUS_COLORS[task.status] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {task.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        {task.assignee && (
                          <span>Assigned to {task.assignee.name}</span>
                        )}
                        {task.dueDate && (
                          <span>
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-gray-600">
                          {task.description}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleUpdateTaskStatus(task.id, e.target.value)
                        }
                        className="ml-4 rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Documents
              </h2>
            </div>

            {canManage && (
              <form
                onSubmit={handleUploadDocument}
                className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
              >
                <div className="flex-1">
                  <label className="label">File</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setDocFile(e.target.files?.[0] ?? null)
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>
                <div>
                  <label className="label">Classification</label>
                  <select
                    value={docClassification}
                    onChange={(e) => setDocClassification(e.target.value)}
                    className="input-field"
                  >
                    {DOC_CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  data-testid="upload-document"
                  disabled={!docFile || uploading}
                  className="btn-primary text-sm"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </form>
            )}

            {caseData.documents.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500" data-testid="documents-list">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto" data-testid="documents-list">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-2 pr-4">Filename</th>
                      <th className="pb-2 pr-4">Classification</th>
                      <th className="pb-2 pr-4">Size</th>
                      <th className="pb-2 pr-4">Uploaded By</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {caseData.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">
                          {doc.filename}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {doc.classification}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {formatBytes(doc.size)}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {doc.uploadedBy.name}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5">
                          <div className="flex gap-2">
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              download={doc.filename}
                              className="text-brand-600 hover:text-brand-700"
                            >
                              Download
                            </a>
                            {(doc.contentType.startsWith("image/") ||
                              doc.contentType === "application/pdf") && (
                              <button
                                onClick={() => setViewingDoc(doc)}
                                className="text-brand-600 hover:text-brand-700"
                              >
                                View
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Document Viewer Modal */}
          {viewingDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {viewingDoc.filename}
                  </h3>
                  <button
                    onClick={() => setViewingDoc(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="overflow-auto p-6" style={{ maxHeight: "calc(90vh - 80px)" }}>
                  {viewingDoc.contentType === "application/pdf" ? (
                    <iframe
                      src={`/api/cases/${caseId}/documents/${viewingDoc.id}`}
                      className="h-[70vh] w-full rounded border border-gray-200"
                      title={viewingDoc.filename}
                    />
                  ) : viewingDoc.contentType.startsWith("image/") ? (
                    <img
                      src={`/api/cases/${caseId}/documents/${viewingDoc.id}`}
                      alt={viewingDoc.filename}
                      className="mx-auto max-h-[70vh] rounded-lg object-contain"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Comments</h2>

            {caseData.comments.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">
                No comments yet. Be the first to add one.
              </p>
            )}

            {caseData.comments.length > 0 && (
              <div className="mt-4 space-y-4">
                {caseData.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-3"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {comment.author.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="mt-4 border-t border-gray-200 pt-4">
              <label className="label">Add Comment</label>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                className="input-field resize-y"
                placeholder="Write a comment..."
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!commentBody.trim() || addingComment}
                  className="btn-primary text-sm"
                >
                  {addingComment ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Data Subject Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">
              Data Subject
            </h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {caseData.dataSubject.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {caseData.dataSubject.fullName}
                  </p>
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                {caseData.dataSubject.email && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Email</dt>
                    <dd className="text-gray-900">
                      {caseData.dataSubject.email}
                    </dd>
                  </div>
                )}
                {caseData.dataSubject.phone && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Phone</dt>
                    <dd className="text-gray-900">
                      {caseData.dataSubject.phone}
                    </dd>
                  </div>
                )}
                {caseData.dataSubject.address && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">
                      Address
                    </dt>
                    <dd className="text-gray-900">
                      {caseData.dataSubject.address}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500">
                  Created By
                </dt>
                <dd className="text-gray-900">{caseData.createdBy.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">
                  Created At
                </dt>
                <dd className="text-gray-900">
                  {new Date(caseData.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">
                  Last Updated
                </dt>
                <dd className="text-gray-900">
                  {new Date(caseData.updatedAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Tasks</dt>
                <dd className="text-gray-900">
                  {caseData.tasks.filter((t) => t.status === "DONE").length}/
                  {caseData.tasks.length} completed
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">
                  Documents
                </dt>
                <dd className="text-gray-900">{caseData.documents.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
