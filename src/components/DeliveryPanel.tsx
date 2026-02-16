"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────────────── */

interface DeliveryUser {
  id: string;
  name: string;
  email: string;
}

interface DeliveryLinkData {
  id: string;
  status: string;
  expiresAt: string;
  maxDownloads: number;
  usedDownloads: number;
  otpRequired: boolean;
  subjectContact: string | null;
  createdAt: string;
  createdBy: DeliveryUser;
  revokedBy: DeliveryUser | null;
  package: { id: string; checksumSha256: string | null } | null;
  events: DeliveryEventData[];
}

interface DeliveryPackageData {
  id: string;
  generatedAt: string;
  checksumSha256: string | null;
  includedResponseDocIds: string[];
  includedDocumentIds: string[];
  generatedBy: DeliveryUser;
  links: Array<{
    id: string;
    status: string;
    expiresAt: string;
    usedDownloads: number;
    maxDownloads: number;
    subjectContact: string | null;
    createdAt: string;
  }>;
}

interface DeliveryEventData {
  id: string;
  eventType: string;
  timestamp: string;
  metadataJson: Record<string, unknown> | null;
}

interface ResponseDoc {
  id: string;
  version: number;
  status: string;
  language: string;
}

interface CaseDocument {
  id: string;
  filename: string;
  size: number;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-100 text-gray-700",
  REVOKED: "bg-red-100 text-red-800",
};

const EVENT_LABELS: Record<string, string> = {
  LINK_CREATED: "Link Created",
  OTP_SENT: "OTP Sent",
  OTP_VERIFIED: "OTP Verified",
  OTP_FAILED: "OTP Failed",
  PORTAL_VIEWED: "Portal Viewed",
  FILE_DOWNLOADED: "File Downloaded",
  PACKAGE_DOWNLOADED: "Package Downloaded",
  LINK_REVOKED: "Link Revoked",
  LINK_EXPIRED: "Link Expired",
};

/* ── Component ──────────────────────────────────────────────────── */

export default function DeliveryPanel({
  caseId,
  responseDocs,
  caseDocuments,
  userRole,
}: {
  caseId: string;
  responseDocs: ResponseDoc[];
  caseDocuments: CaseDocument[];
  userRole: string;
}) {
  const [packages, setPackages] = useState<DeliveryPackageData[]>([]);
  const [links, setLinks] = useState<DeliveryLinkData[]>([]);
  const [events, setEvents] = useState<DeliveryEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedResponseDocs, setFetchedResponseDocs] = useState<ResponseDoc[]>(responseDocs);

  // Create package state
  const [showCreatePkg, setShowCreatePkg] = useState(false);
  const [selectedResponseDocs, setSelectedResponseDocs] = useState<string[]>([]);
  const [selectedEvidenceDocs, setSelectedEvidenceDocs] = useState<string[]>([]);

  // Create link state
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [linkPackageId, setLinkPackageId] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkExpireDays, setLinkExpireDays] = useState(7);
  const [linkOtp, setLinkOtp] = useState(true);
  const [linkMaxDownloads, setLinkMaxDownloads] = useState(3);

  // Result state
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdPortalUrl, setCreatedPortalUrl] = useState<string | null>(null);

  // Revoke state
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Events view
  const [showEvents, setShowEvents] = useState(false);

  const canCreate =
    userRole === "SUPER_ADMIN" ||
    userRole === "TENANT_ADMIN" ||
    userRole === "DPO";

  const fetchData = useCallback(async () => {
    try {
      const [deliveryRes, responseRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/delivery`),
        fetch(`/api/cases/${caseId}/response`),
      ]);
      if (deliveryRes.ok) {
        const data = await deliveryRes.json();
        setPackages(data.packages || []);
        setLinks(data.links || []);
        setEvents(data.events || []);
      }
      if (responseRes.ok) {
        const data = await responseRes.json();
        const docs = (Array.isArray(data) ? data : data.documents || []).map((d: any) => ({
          id: d.id,
          version: d.version ?? 1,
          status: d.status ?? "DRAFT",
          language: d.language ?? "en",
        }));
        if (docs.length > 0) setFetchedResponseDocs(docs);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreatePackage() {
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_package",
          responseDocIds: selectedResponseDocs,
          documentIds: selectedEvidenceDocs,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create package");
      }
      setShowCreatePkg(false);
      setSelectedResponseDocs([]);
      setSelectedEvidenceDocs([]);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateLink() {
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_link",
          packageId: linkPackageId,
          recipientEmail: linkEmail,
          expiresDays: linkExpireDays,
          otpRequired: linkOtp,
          maxDownloads: linkMaxDownloads,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create link");
      }
      const result = await res.json();
      setCreatedToken(result.token);
      setCreatedPortalUrl(result.portalUrl);
      setShowCreateLink(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_link",
          linkId: revokeId,
          reason: revokeReason,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to revoke link");
      }
      setRevokeId(null);
      setRevokeReason("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleResendOtp(linkId: string) {
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_otp", linkId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resend OTP");
      }
      const result = await res.json();
      if (result.otp) {
        alert(`[DEV] OTP sent to outbox: ${result.otp}`);
      }
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Loading delivery data...</p>
      </div>
    );
  }

  const approvedDocs = fetchedResponseDocs.filter(
    (d) => d.status === "APPROVED" || d.status === "SENT"
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Secure Delivery Portal
        </h3>
        {canCreate && approvedDocs.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreatePkg(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Package
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Created Token Banner */}
      {createdToken && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <h4 className="text-sm font-semibold text-green-800">
            Secure Link Created
          </h4>
          <p className="mt-1 text-xs text-green-700">
            Copy this link now — it will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-1.5 text-xs text-gray-900 break-all border">
              {typeof window !== "undefined"
                ? `${window.location.origin}${createdPortalUrl}`
                : createdPortalUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}${createdPortalUrl}`
                );
              }}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => {
              setCreatedToken(null);
              setCreatedPortalUrl(null);
            }}
            className="mt-2 text-xs text-green-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Package Modal */}
      {showCreatePkg && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-800">
            Create Delivery Package
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Response Documents (approved)
              </label>
              {approvedDocs.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={selectedResponseDocs.includes(doc.id)}
                    onChange={() =>
                      setSelectedResponseDocs((prev) =>
                        prev.includes(doc.id)
                          ? prev.filter((x) => x !== doc.id)
                          : [...prev, doc.id]
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    v{doc.version} ({doc.language}) — {doc.status}
                  </span>
                </label>
              ))}
            </div>
            {caseDocuments.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Evidence Documents (optional)
                </label>
                {caseDocuments.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={selectedEvidenceDocs.includes(doc.id)}
                      onChange={() =>
                        setSelectedEvidenceDocs((prev) =>
                          prev.includes(doc.id)
                            ? prev.filter((x) => x !== doc.id)
                            : [...prev, doc.id]
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      {doc.filename} ({(doc.size / 1024).toFixed(0)} KB)
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreatePackage}
                disabled={selectedResponseDocs.length === 0}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreatePkg(false)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packages */}
      {packages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Packages</h4>
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Package {pkg.id.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {new Date(pkg.generatedAt).toLocaleString()}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    by {pkg.generatedBy.name}
                  </span>
                </div>
                {canCreate && (
                  <button
                    onClick={() => {
                      setLinkPackageId(pkg.id);
                      setShowCreateLink(true);
                    }}
                    className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    Generate Link
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {(pkg.includedResponseDocIds as string[]).length} response doc(s),{" "}
                {(pkg.includedDocumentIds as string[]).length} evidence doc(s)
                {pkg.checksumSha256 && (
                  <span className="ml-2">
                    SHA256: {pkg.checksumSha256.slice(0, 16)}...
                  </span>
                )}
              </div>
              {/* Linked delivery links */}
              {pkg.links.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pkg.links.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 text-xs text-gray-600"
                    >
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[l.status] || "bg-gray-100"}`}
                      >
                        {l.status}
                      </span>
                      <span>{l.subjectContact || "—"}</span>
                      <span>
                        {l.usedDownloads}/{l.maxDownloads} downloads
                      </span>
                      <span>
                        expires {new Date(l.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateLink && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <h4 className="text-sm font-semibold text-green-800">
            Generate Secure Link
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Recipient Email
              </label>
              <input
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                placeholder="subject@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Expires in (days)
                </label>
                <input
                  type="number"
                  value={linkExpireDays}
                  onChange={(e) =>
                    setLinkExpireDays(parseInt(e.target.value) || 7)
                  }
                  min={1}
                  max={90}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Max Downloads
                </label>
                <input
                  type="number"
                  value={linkMaxDownloads}
                  onChange={(e) =>
                    setLinkMaxDownloads(parseInt(e.target.value) || 3)
                  }
                  min={1}
                  max={100}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={linkOtp}
                onChange={(e) => setLinkOtp(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Require OTP verification</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleCreateLink}
                disabled={!linkEmail}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Generate Link
              </button>
              <button
                onClick={() => setShowCreateLink(false)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Links */}
      {links.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Delivery Links</h4>
          {links.map((link) => (
            <div
              key={link.id}
              className="rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[link.status] || "bg-gray-100"}`}
                  >
                    {link.status}
                  </span>
                  <span className="text-sm text-gray-700">
                    {link.subjectContact || "—"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {link.usedDownloads}/{link.maxDownloads} downloads
                  </span>
                  {link.otpRequired && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                      OTP
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {link.status === "ACTIVE" && link.otpRequired && canCreate && (
                    <button
                      onClick={() => handleResendOtp(link.id)}
                      className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 hover:bg-purple-200"
                    >
                      Resend OTP
                    </button>
                  )}
                  {link.status === "ACTIVE" && canCreate && (
                    <button
                      onClick={() => setRevokeId(link.id)}
                      className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Created {new Date(link.createdAt).toLocaleString()} by{" "}
                {link.createdBy.name} | Expires{" "}
                {new Date(link.expiresAt).toLocaleString()}
                {link.revokedBy && (
                  <span className="ml-2 text-red-600">
                    Revoked by {link.revokedBy.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoke Modal */}
      {revokeId && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h4 className="text-sm font-semibold text-red-800">Revoke Link</h4>
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-700">
              Reason
            </label>
            <input
              type="text"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              placeholder="Reason for revoking..."
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRevoke}
              disabled={!revokeReason}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Revoke
            </button>
            <button
              onClick={() => {
                setRevokeId(null);
                setRevokeReason("");
              }}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Events */}
      <div>
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showEvents ? "Hide" : "View"} Delivery Audit ({events.length} events)
        </button>
        {showEvents && events.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Event
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-gray-900">
                      {EVENT_LABELS[evt.eventType] || evt.eventType}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">
                      {evt.metadataJson
                        ? JSON.stringify(evt.metadataJson).slice(0, 80)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Empty state */}
      {packages.length === 0 && links.length === 0 && !showCreatePkg && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            No delivery packages yet.
            {approvedDocs.length > 0
              ? " Create a package from approved response documents."
              : " Approve a response document first."}
          </p>
        </div>
      )}
    </div>
  );
}
