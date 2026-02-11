"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface DataSubjectResult {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const DSAR_TYPES = [
  { value: "ACCESS", label: "Access" },
  { value: "ERASURE", label: "Erasure" },
  { value: "RECTIFICATION", label: "Rectification" },
  { value: "RESTRICTION", label: "Restriction" },
  { value: "PORTABILITY", label: "Portability" },
  { value: "OBJECTION", label: "Objection" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

/* ── Component ────────────────────────────────────────────────────────── */

export default function NewCasePage() {
  const router = useRouter();

  // Case fields
  const [type, setType] = useState("ACCESS");
  const [priority, setPriority] = useState("MEDIUM");
  const [channel, setChannel] = useState("");
  const [requesterType, setRequesterType] = useState("");
  const [description, setDescription] = useState("");

  // Data subject
  const [dsMode, setDsMode] = useState<"new" | "existing">("new");
  const [dsSearch, setDsSearch] = useState("");
  const [dsResults, setDsResults] = useState<DataSubjectResult[]>([]);
  const [selectedDs, setSelectedDs] = useState<DataSubjectResult | null>(null);
  const [dsSearching, setDsSearching] = useState(false);

  // New data subject fields
  const [dsFullName, setDsFullName] = useState("");
  const [dsEmail, setDsEmail] = useState("");
  const [dsPhone, setDsPhone] = useState("");
  const [dsAddress, setDsAddress] = useState("");

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Search data subjects
  useEffect(() => {
    if (dsMode !== "existing" || dsSearch.length < 2) {
      setDsResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setDsSearching(true);
      try {
        const res = await fetch(
          `/api/data-subjects?search=${encodeURIComponent(dsSearch)}`
        );
        if (res.ok) {
          const json = await res.json();
          setDsResults(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        /* silently fail */
      } finally {
        setDsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dsSearch, dsMode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const dataSubject =
      dsMode === "existing" && selectedDs
        ? {
            id: selectedDs.id,
            fullName: selectedDs.fullName,
            email: selectedDs.email ?? undefined,
            phone: selectedDs.phone ?? undefined,
            address: selectedDs.address ?? undefined,
          }
        : {
            fullName: dsFullName,
            email: dsEmail || undefined,
            phone: dsPhone || undefined,
            address: dsAddress || undefined,
          };

    if (!dataSubject.fullName) {
      setError("Data subject name is required.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          priority,
          channel: channel || undefined,
          requesterType: requesterType || undefined,
          description: description || undefined,
          dataSubject,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? `Failed to create case (${res.status})`);
        return;
      }

      const newCase = await res.json();
      router.push(`/cases/${newCase.id}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
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
          <h1 className="text-2xl font-bold text-gray-900">Create New Case</h1>
          <p className="mt-1 text-sm text-gray-500">
            Submit a new data subject access request
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Case Details */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Case Details</h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="type" className="label">
                Request Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-field"
                required
              >
                {DSAR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="label">
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input-field"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="channel" className="label">
                Channel
              </label>
              <input
                id="channel"
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="e.g., Email, Web Portal, Phone"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="requesterType" className="label">
                Requester Type
              </label>
              <input
                id="requesterType"
                type="text"
                value={requesterType}
                onChange={(e) => setRequesterType(e.target.value)}
                placeholder="e.g., Data Subject, Authorized Agent"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the request details..."
              className="input-field resize-y"
            />
          </div>
        </div>

        {/* Data Subject */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Data Subject
            </h2>
            <div className="flex rounded-lg border border-gray-300 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setDsMode("new");
                  setSelectedDs(null);
                }}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  dsMode === "new"
                    ? "bg-brand-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setDsMode("existing")}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  dsMode === "existing"
                    ? "bg-brand-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Existing
              </button>
            </div>
          </div>

          {dsMode === "existing" ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="ds-search" className="label">
                  Search Data Subjects
                </label>
                <div className="relative">
                  <input
                    id="ds-search"
                    type="text"
                    value={dsSearch}
                    onChange={(e) => {
                      setDsSearch(e.target.value);
                      setSelectedDs(null);
                    }}
                    placeholder="Search by name or email..."
                    className="input-field"
                  />
                  {dsSearching && (
                    <div className="absolute right-3 top-2.5">
                      <svg
                        className="h-4 w-4 animate-spin text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {dsResults.length > 0 && !selectedDs && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
                  {dsResults.map((ds) => (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => setSelectedDs(ds)}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                        {ds.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {ds.fullName}
                        </p>
                        {ds.email && (
                          <p className="text-xs text-gray-500">{ds.email}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedDs && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {selectedDs.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedDs.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[selectedDs.email, selectedDs.phone]
                        .filter(Boolean)
                        .join(" | ") || "No contact info"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDs(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="h-5 w-5"
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
              )}

              {dsSearch.length >= 2 &&
                dsResults.length === 0 &&
                !dsSearching &&
                !selectedDs && (
                  <p className="text-sm text-gray-500">
                    No data subjects found. Try a different search term or create
                    a new one.
                  </p>
                )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ds-name" className="label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="ds-name"
                  type="text"
                  value={dsFullName}
                  onChange={(e) => setDsFullName(e.target.value)}
                  placeholder="John Doe"
                  className="input-field"
                  required={dsMode === "new"}
                />
              </div>

              <div>
                <label htmlFor="ds-email" className="label">
                  Email
                </label>
                <input
                  id="ds-email"
                  type="email"
                  value={dsEmail}
                  onChange={(e) => setDsEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="ds-phone" className="label">
                  Phone
                </label>
                <input
                  id="ds-phone"
                  type="tel"
                  value={dsPhone}
                  onChange={(e) => setDsPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="input-field"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ds-address" className="label">
                  Address
                </label>
                <input
                  id="ds-address"
                  type="text"
                  value={dsAddress}
                  onChange={(e) => setDsAddress(e.target.value)}
                  placeholder="123 Main St, City, State, Country"
                  className="input-field"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/cases" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Case"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
