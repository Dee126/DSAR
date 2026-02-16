"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Submission {
  id: string;
  reference: string;
  channel: string;
  status: string;
  preferredLanguage: string;
  requestTypes: string[] | null;
  subjectType: string | null;
  jurisdiction: string;
  classificationConfidence: number | null;
  subjectEmail: string | null;
  subjectPhone: string | null;
  subjectName: string | null;
  subjectAddress: string | null;
  customerId: string | null;
  employeeId: string | null;
  requestDetails: string | null;
  consentGiven: boolean;
  ipAddress: string | null;
  receivedAt: string;
  createdAt: string;
  processedAt: string | null;
  case: { id: string; caseNumber: string; status: string } | null;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  emailIngestEvent: {
    fromAddress: string;
    subject: string | null;
    receivedAt: string;
    mappingStatus: string;
    parsedIdentifiers: Record<string, unknown> | null;
  } | null;
}

interface DedupeCandidate {
  id: string;
  score: number;
  reasons: string[];
  status: string;
  candidateCase: {
    id: string;
    caseNumber: string;
    status: string;
    type: string;
    createdAt: string;
    dataSubject: { fullName: string; email: string | null };
  };
}

interface ClarificationReq {
  id: string;
  questions: string[];
  templateBody: string | null;
  status: string;
  sentAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [dedupeCandidates, setDedupeCandidates] = useState<DedupeCandidate[]>([]);
  const [clarifications, setClarifications] = useState<ClarificationReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [clarificationQuestions, setClarificationQuestions] = useState("");
  const [showClarificationForm, setShowClarificationForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/intake/submissions/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setSubmission(data);

      // Load dedupe if case exists
      if (data.case?.id) {
        const dedupeRes = await fetch(`/api/intake/dedupe/${data.case.id}`);
        if (dedupeRes.ok) {
          const dedupeData = await dedupeRes.json();
          setDedupeCandidates(dedupeData.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load submission:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCase() {
    try {
      const res = await fetch(`/api/intake/submissions/${id}/create-case`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed");
        return;
      }
      const result = await res.json();
      alert(`Case ${result.caseNumber} created`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkSpam() {
    if (!confirm("Mark as spam?")) return;
    await fetch(`/api/intake/submissions/${id}/spam`, { method: "POST" });
    fetchData();
  }

  async function handleClarification() {
    const questions = clarificationQuestions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length === 0) return;

    const res = await fetch(`/api/intake/submissions/${id}/clarification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });
    if (res.ok) {
      setClarificationQuestions("");
      setShowClarificationForm(false);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed");
    }
  }

  async function handleDedupeAction(candidateId: string, action: "link" | "merge" | "dismiss") {
    if (action !== "dismiss" && !confirm(`Are you sure you want to ${action} these cases?`)) return;
    if (!submission?.case?.id) return;

    const res = await fetch(`/api/intake/dedupe/${submission.case.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, action }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed");
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!submission) {
    return <div className="p-8 text-center text-gray-500">Submission not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/intake" className="text-sm text-gray-500 hover:text-gray-700">&larr; Intake Inbox</Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Submission {submission.reference}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              submission.status === "NEW" ? "bg-blue-100 text-blue-800" :
              submission.status === "PROCESSED" ? "bg-green-100 text-green-800" :
              submission.status === "SPAM" ? "bg-gray-100 text-gray-800" :
              "bg-red-100 text-red-800"
            }`}>
              {submission.status}
            </span>
            <span className="text-sm text-gray-500">via {submission.channel}</span>
            <span className="text-sm text-gray-500">{new Date(submission.receivedAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {submission.status === "NEW" && !submission.case && (
            <>
              <button
                onClick={handleCreateCase}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Create Case
              </button>
              <button
                onClick={() => setShowClarificationForm(!showClarificationForm)}
                className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                disabled={!submission.case}
                title={!submission.case ? "Create case first" : ""}
              >
                Request Clarification
              </button>
              <button
                onClick={handleMarkSpam}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Mark Spam
              </button>
            </>
          )}
          {submission.case && (
            <button
              onClick={() => setShowClarificationForm(!showClarificationForm)}
              className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
            >
              Request Clarification
            </button>
          )}
        </div>
      </div>

      {/* Linked Case Banner */}
      {submission.case && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">
                Linked to Case: {submission.case.caseNumber}
              </p>
              <p className="text-xs text-green-600">Status: {submission.case.status}</p>
            </div>
            <Link
              href={`/cases/${submission.case.id}`}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              Open Case
            </Link>
          </div>
        </div>
      )}

      {/* Dedupe Banner */}
      {dedupeCandidates.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-medium text-yellow-800">
            Potential Duplicates Detected ({dedupeCandidates.filter((c) => c.status === "PENDING").length} pending)
          </h3>
          <div className="mt-3 space-y-2">
            {dedupeCandidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded bg-white p-3">
                <div>
                  <Link href={`/cases/${c.candidateCase.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    {c.candidateCase.caseNumber}
                  </Link>
                  <span className="ml-2 text-xs text-gray-500">
                    {c.candidateCase.dataSubject.fullName} ({c.candidateCase.dataSubject.email || "no email"})
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    Score: {Math.round(c.score * 100)}%
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(c.reasons as string[]).map((r, i) => (
                      <span key={i} className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">{r}</span>
                    ))}
                  </div>
                </div>
                {c.status === "PENDING" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDedupeAction(c.id, "link")}
                      className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                    >
                      Link
                    </button>
                    <button
                      onClick={() => handleDedupeAction(c.id, "merge")}
                      className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200"
                    >
                      Merge
                    </button>
                    <button
                      onClick={() => handleDedupeAction(c.id, "dismiss")}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {c.status !== "PENDING" && (
                  <span className={`text-xs font-medium ${c.status === "LINKED" ? "text-blue-600" : c.status === "MERGED" ? "text-orange-600" : "text-gray-400"}`}>
                    {c.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clarification Form */}
      {showClarificationForm && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-medium text-yellow-800">Request Clarification</h3>
          <p className="mt-1 text-xs text-yellow-600">Enter one question per line</p>
          <textarea
            value={clarificationQuestions}
            onChange={(e) => setClarificationQuestions(e.target.value)}
            rows={4}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="What is your customer ID?&#10;Which data specifically would you like access to?"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleClarification}
              className="rounded bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
            >
              Send Clarification Request
            </button>
            <button
              onClick={() => setShowClarificationForm(false)}
              className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Submission Details */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Submission Details</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Reference</dt>
              <dd className="font-mono text-sm">{submission.reference}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Channel</dt>
              <dd className="text-sm">{submission.channel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Request Types</dt>
              <dd className="flex flex-wrap gap-1">
                {(submission.requestTypes || []).map((t) => (
                  <span key={t} className="rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{t}</span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Subject Type</dt>
              <dd className="text-sm">{submission.subjectType || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Jurisdiction</dt>
              <dd className="text-sm">{submission.jurisdiction}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Classification Confidence</dt>
              <dd className="text-sm">{submission.classificationConfidence != null ? `${Math.round(submission.classificationConfidence * 100)}%` : "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Language</dt>
              <dd className="text-sm">{submission.preferredLanguage === "de" ? "Deutsch" : "English"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Consent Given</dt>
              <dd className="text-sm">{submission.consentGiven ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>

        {/* Subject Info */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Subject Information</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Name</dt>
              <dd className="text-sm">{submission.subjectName || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Email</dt>
              <dd className="text-sm">{submission.subjectEmail || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Phone</dt>
              <dd className="text-sm">{submission.subjectPhone || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Address</dt>
              <dd className="text-sm">{submission.subjectAddress || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Customer ID</dt>
              <dd className="text-sm">{submission.customerId || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Employee ID</dt>
              <dd className="text-sm">{submission.employeeId || "---"}</dd>
            </div>
            {submission.ipAddress && (
              <div>
                <dt className="text-xs font-medium text-gray-500">IP Address</dt>
                <dd className="text-sm text-gray-400">{submission.ipAddress}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Request Details */}
      {submission.requestDetails && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Request Details</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{submission.requestDetails}</p>
        </div>
      )}

      {/* Email Ingest Info */}
      {submission.emailIngestEvent && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Email Ingest Details</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">From</dt>
              <dd className="text-sm">{submission.emailIngestEvent.fromAddress}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Subject</dt>
              <dd className="text-sm">{submission.emailIngestEvent.subject || "---"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Mapping Status</dt>
              <dd className="text-sm">{submission.emailIngestEvent.mappingStatus}</dd>
            </div>
            {submission.emailIngestEvent.parsedIdentifiers && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Parsed Identifiers</dt>
                <dd className="mt-1 rounded bg-gray-50 p-2 font-mono text-xs">
                  {JSON.stringify(submission.emailIngestEvent.parsedIdentifiers, null, 2)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Attachments */}
      {submission.attachments.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Attachments ({submission.attachments.length})</h2>
          <ul className="mt-3 space-y-2">
            {submission.attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  <span>{att.filename}</span>
                </div>
                <span className="text-xs text-gray-500">{(att.size / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
