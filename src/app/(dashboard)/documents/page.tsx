"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: "bg-green-100 text-green-700",
  INTERNAL: "bg-blue-100 text-blue-700",
  CONFIDENTIAL: "bg-orange-100 text-orange-700",
  RESTRICTED: "bg-red-100 text-red-700",
};

const CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

/* ── Types ────────────────────────────────────────────────────────────── */

interface CaseUser {
  id: string;
  name: string;
  email: string;
}

interface DocumentItem {
  id: string;
  caseId: string;
  filename: string;
  contentType: string;
  size: number;
  classification: string;
  uploadedAt: string;
  uploadedBy: CaseUser;
  case?: {
    id: string;
    caseNumber: string;
  };
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const json = await res.json();
          setDocuments(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  async function handleDelete(doc: DocumentItem) {
    if (!confirm(`Are you sure you want to delete "${doc.filename}"?`)) return;

    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        const json = await res.json();
        alert(json.error || "Failed to delete document");
      }
    } catch {
      alert("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    if (classificationFilter && doc.classification !== classificationFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        doc.filename.toLowerCase().includes(q) ||
        doc.case?.caseNumber.toLowerCase().includes(q) ||
        doc.uploadedBy.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const totalSize = documents.reduce((s, d) => s + d.size, 0);
  const classificationCounts: Record<string, number> = {};
  for (const doc of documents) {
    classificationCounts[doc.classification] = (classificationCounts[doc.classification] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          View all documents across cases. Upload documents from individual case
          pages.
        </p>
      </div>

      {/* Stats */}
      {!loading && documents.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            <p className="text-xs text-gray-500">Total Documents</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{formatBytes(totalSize)}</p>
            <p className="text-xs text-gray-500">Total Size</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-orange-600">
              {classificationCounts["CONFIDENTIAL"] ?? 0}
            </p>
            <p className="text-xs text-gray-500">Confidential</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">
              {classificationCounts["RESTRICTED"] ?? 0}
            </p>
            <p className="text-xs text-gray-500">Restricted</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="doc-search" className="label">
              Search
            </label>
            <input
              id="doc-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              placeholder="Search by filename, case number, or uploader..."
            />
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="doc-classification-filter" className="label">
              Classification
            </label>
            <select
              id="doc-classification-filter"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="input-field w-full sm:w-44"
            >
              <option value="">All Classifications</option>
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {(classificationFilter || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setClassificationFilter("");
                setSearchQuery("");
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-100"
              />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {documents.length === 0
                ? "No documents found. Documents are uploaded from individual case pages."
                : "No documents match the current filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Filename</th>
                    <th className="px-6 py-3">Case</th>
                    <th className="px-6 py-3">Classification</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3">Uploaded By</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-5 w-5 flex-shrink-0 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {doc.filename}
                            </span>
                            <p className="text-xs text-gray-400">
                              {doc.contentType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {doc.case ? (
                          <Link
                            href={`/cases/${doc.caseId}`}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            {doc.case.caseNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            CLASSIFICATION_COLORS[doc.classification] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {doc.classification}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatBytes(doc.size)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {doc.uploadedBy.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            download={doc.filename}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingId === doc.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-gray-200 md:hidden">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="p-4 space-y-3">
                  {/* Line 1: Filename with icon */}
                  <div className="flex items-start gap-2">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-gray-400 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename}
                      </p>
                      {/* Line 2: Content type */}
                      <p className="text-xs text-gray-400">
                        {doc.contentType}
                      </p>
                    </div>
                  </div>

                  {/* Line 3: Classification badge + Case number */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        CLASSIFICATION_COLORS[doc.classification] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {doc.classification}
                    </span>
                    {doc.case && (
                      <Link
                        href={`/cases/${doc.caseId}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {doc.case.caseNumber}
                      </Link>
                    )}
                  </div>

                  {/* Line 4: Size + Uploaded by + Date */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <span>{formatBytes(doc.size)}</span>
                    <span>•</span>
                    <span className="text-gray-700">{doc.uploadedBy.name}</span>
                    <span>•</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-1">
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      download={doc.filename}
                      className="min-h-[44px] flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="min-h-[44px] flex items-center text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingId === doc.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
