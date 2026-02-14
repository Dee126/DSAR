"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  DEMO_STEPS,
  DEMO_SCENARIOS,
  isDemoScenarioId,
  type DemoScenarioData,
  type DemoDiscoverySystem,
  type DemoEvidenceItem,
  type DemoFinding,
  type DemoAuditEvent,
} from "@/lib/demo/fixtures";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function severityColor(s: string) {
  if (s === "CRITICAL") return "bg-red-100 text-red-800";
  if (s === "WARNING") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export default function DemoWalkthroughPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.scenario as string;

  const [currentStep, setCurrentStep] = useState(0);

  if (!isDemoScenarioId(scenarioId)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Scenario not found</h1>
          <Link href="/demo" className="mt-4 inline-block text-brand-600 hover:underline">
            Back to scenarios
          </Link>
        </div>
      </div>
    );
  }

  const scenario = DEMO_SCENARIOS[scenarioId];
  const step = DEMO_STEPS[currentStep];

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, DEMO_STEPS.length - 1));
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const isFirst = currentStep === 0;
  const isLast = currentStep === DEMO_STEPS.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/demo" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-sm font-bold text-gray-900">{scenario.title}</h1>
              <p className="text-xs text-gray-500">{scenario.caseInfo.caseNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:inline-flex">
              Demo Mode
            </span>
            <Link
              href="/login"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Try it for real
            </Link>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <nav className="flex min-w-max gap-1 py-2">
            {DEMO_STEPS.map((s, i) => {
              const isActive = i === currentStep;
              const isComplete = i < currentStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : isComplete
                        ? "text-brand-600 hover:bg-gray-50"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-brand-600 text-white"
                        : isComplete
                          ? "bg-brand-100 text-brand-700"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isComplete ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden sm:inline">{s.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Step Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Step Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Step {currentStep + 1} of {DEMO_STEPS.length}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{step.label}</h2>
            <p className="mt-1 text-sm text-gray-500">{step.description}</p>
          </div>

          {/* Dynamic Content */}
          {step.id === "intake" && <IntakeStep scenario={scenario} />}
          {step.id === "discovery" && <DiscoveryStep scenario={scenario} />}
          {step.id === "findings" && <FindingsStep scenario={scenario} />}
          {step.id === "legal" && <LegalStep scenario={scenario} />}
          {step.id === "export" && <ExportStep scenario={scenario} />}
          {step.id === "audit" && <AuditStep scenario={scenario} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Previous
          </button>

          <div className="flex items-center gap-1.5">
            {DEMO_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? "w-6 bg-brand-600" : i < currentStep ? "w-1.5 bg-brand-300" : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <Link
              href="/demo"
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Try another scenario
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Continue
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 1: Intake                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function IntakeStep({ scenario }: { scenario: DemoScenarioData }) {
  const c = scenario.caseInfo;
  const ds = c.dataSubject;
  const remaining = daysUntil(c.dueDate);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Case Overview */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Case Overview</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoRow label="Case Number" value={c.caseNumber} />
            <InfoRow label="Type" value={c.typeLabel} />
            <InfoRow label="Priority">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                c.priority === "CRITICAL" ? "bg-red-100 text-red-800" :
                c.priority === "HIGH" ? "bg-amber-100 text-amber-800" :
                "bg-blue-100 text-blue-800"
              }`}>{c.priority}</span>
            </InfoRow>
            <InfoRow label="Channel" value={c.channel} />
            <InfoRow label="Received" value={formatDate(c.receivedAt)} />
            <InfoRow label="Due Date" value={formatDate(c.dueDate)} />
            <InfoRow label="Assigned To" value={c.assignedTo} />
            <InfoRow label="SLA Remaining">
              <span className={`text-sm font-semibold ${remaining <= 7 ? "text-red-600" : remaining <= 14 ? "text-amber-600" : "text-green-600"}`}>
                {remaining} days
              </span>
            </InfoRow>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Request Description</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.description}</p>
        </div>
      </div>

      {/* Data Subject */}
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Data Subject</h3>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {ds.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{ds.fullName}</p>
              <p className="text-xs text-gray-500">{ds.email}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <InfoRow label="Phone" value={ds.phone} />
            {ds.employeeId && <InfoRow label="Employee ID" value={ds.employeeId} />}
            {ds.department && <InfoRow label="Department" value={ds.department} />}
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-green-800">Identity Verified</h3>
          </div>
          <p className="mt-2 text-xs text-green-700">
            Identity confirmed via employee ID match and email domain verification.
          </p>
        </div>

        {/* Demo hint */}
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-medium text-brand-800">
            In the live product, this page includes full identity verification workflow, document upload, and automated intake triage rules.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 2: Discovery (with animated progress)                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function DiscoveryStep({ scenario }: { scenario: DemoScenarioData }) {
  const systems = scenario.discoverySystems;
  const [scanState, setScanState] = useState<Record<string, "pending" | "scanning" | "completed">>({});
  const [scanStarted, setScanStarted] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  const startScan = useCallback(() => {
    setScanStarted(true);
    const init: Record<string, "pending" | "scanning" | "completed"> = {};
    systems.forEach((s) => { init[s.provider] = "pending"; });
    setScanState(init);
    setTotalFound(0);

    let cumulative = 0;
    systems.forEach((sys, idx) => {
      const startDelay = idx * 800;
      setTimeout(() => {
        setScanState((prev) => ({ ...prev, [sys.provider]: "scanning" }));
      }, startDelay);

      setTimeout(() => {
        cumulative += sys.itemsFound;
        const snap = cumulative;
        setScanState((prev) => ({ ...prev, [sys.provider]: "completed" }));
        setTotalFound(snap);
      }, startDelay + sys.duration);
    });
  }, [systems]);

  const allComplete = systems.every((s) => scanState[s.provider] === "completed");

  return (
    <div className="space-y-6">
      {/* Scan Control */}
      {!scanStarted && (
        <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Ready to Scan</h3>
          <p className="mt-1 text-sm text-gray-500">
            Click below to simulate scanning {systems.length} connected M365 workloads for personal data.
          </p>
          <button
            onClick={startScan}
            className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Start Discovery Scan
          </button>
        </div>
      )}

      {/* Scan Progress */}
      {scanStarted && (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div className={`flex items-center justify-between rounded-lg border p-4 ${
            allComplete ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"
          }`}>
            <div className="flex items-center gap-3">
              {allComplete ? (
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              )}
              <span className={`text-sm font-semibold ${allComplete ? "text-green-800" : "text-blue-800"}`}>
                {allComplete ? "Discovery Complete" : "Scanning in progress..."}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {totalFound.toLocaleString()} items found
            </span>
          </div>

          {/* Per-System Progress */}
          <div className="grid gap-4 sm:grid-cols-2">
            {systems.map((sys) => {
              const state = scanState[sys.provider] || "pending";
              return (
                <div key={sys.provider} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SystemIcon provider={sys.provider} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{sys.label}</p>
                        <p className="text-xs text-gray-500">{sys.provider.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                    <StatusBadge status={state} />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        state === "completed"
                          ? "w-full bg-green-500 duration-300"
                          : state === "scanning"
                            ? "w-2/3 animate-pulse bg-blue-500"
                            : "w-0 bg-gray-300"
                      }`}
                    />
                  </div>

                  {state === "completed" && (
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="font-semibold text-gray-900">{sys.itemsFound.toLocaleString()}</span> items found
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidence preview (after complete) */}
      {allComplete && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Evidence Sample (top items by sensitivity)</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">PII Categories</th>
                  <th className="pb-2 font-medium">Sensitivity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scenario.evidence
                  .sort((a, b) => b.sensitivityScore - a.sensitivityScore)
                  .slice(0, 6)
                  .map((ev) => (
                    <EvidenceRow key={ev.id} ev={ev} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demo hint */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-medium text-brand-800">
          In the live product, discovery runs against real M365 Graph API endpoints with OAuth2 consent. Results include full metadata, content scanning (optional), and PII detection via regex + ML classifiers.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 3: Findings                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FindingsStep({ scenario }: { scenario: DemoScenarioData }) {
  const total = scenario.evidence.length;
  const criticalCount = scenario.findings.filter((f) => f.severity === "CRITICAL").length;
  const warningCount = scenario.findings.filter((f) => f.severity === "WARNING").length;
  const infoCount = scenario.findings.filter((f) => f.severity === "INFO").length;
  const hasSpecial = scenario.findings.some((f) => f.containsSpecialCategory);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Evidence" value={total.toString()} sub="items across all systems" />
        <StatCard label="Data Categories" value={scenario.findings.length.toString()} sub="distinct PII types found" />
        <StatCard
          label="Requires Review"
          value={scenario.findings.filter((f) => f.requiresLegalReview).length.toString()}
          sub="categories flagged"
          alert
        />
        <StatCard
          label="Art. 9 Special"
          value={hasSpecial ? "Yes" : "No"}
          sub={hasSpecial ? "Legal gate triggered" : "Not detected"}
          alert={hasSpecial}
        />
      </div>

      {/* Severity Breakdown */}
      <div className="flex flex-wrap gap-3">
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {criticalCount} Critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {warningCount} Warning
          </span>
        )}
        {infoCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {infoCount} Info
          </span>
        )}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {scenario.findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-medium text-brand-800">
          In the live product, findings are generated by automated PII detectors (regex, ML classifier, OCR) and link directly to the source evidence items. Each finding can be individually reviewed, redacted, or exempted.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 4: Legal Gate                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function LegalStep({ scenario }: { scenario: DemoScenarioData }) {
  const lr = scenario.legalReview;
  const isBlocked = lr.legalGateStatus === "BLOCKED";

  return (
    <div className="space-y-6">
      {/* Gate Status Banner */}
      <div className={`flex items-start gap-4 rounded-lg border-2 p-5 ${
        isBlocked
          ? "border-red-300 bg-red-50"
          : "border-green-300 bg-green-50"
      }`}>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          isBlocked ? "bg-red-100" : "bg-green-100"
        }`}>
          {isBlocked ? (
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div>
          <h3 className={`text-lg font-bold ${isBlocked ? "text-red-900" : "text-green-900"}`}>
            Legal Gate: {isBlocked ? "BLOCKED" : "ALLOWED"}
          </h3>
          <p className={`mt-1 text-sm ${isBlocked ? "text-red-700" : "text-green-700"}`}>
            {lr.reviewerNote}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Issues */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Issues Identified ({lr.issues.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {lr.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                {issue}
              </li>
            ))}
          </ul>
        </div>

        {/* Special Categories */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
            Art. 9 Special Categories
          </h3>
          {lr.hasSpecialCategory ? (
            <div className="mt-3 space-y-2">
              {lr.specialCategories.map((cat) => (
                <span key={cat} className="mr-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                  {cat}
                </span>
              ))}
              <p className="text-sm text-red-600">
                Special category data requires explicit legal basis and two-person approval before any data can be exported.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              No Art. 9 special category data detected in this case.
            </p>
          )}
        </div>

        {/* Exemptions */}
        {lr.exemptions.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900">Legal Exemptions Applied</h3>
            <ul className="mt-3 space-y-2">
              {lr.exemptions.map((ex, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-medium text-brand-800">
          {isBlocked
            ? "In the live product, blocked exports require manual approval by DPO + Legal Counsel before any data is released. This ensures GDPR Art. 9 compliance."
            : "In the live product, the legal review includes full workflow with reviewer assignment, structured checklists, and approval chains."}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 5: Export                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ExportStep({ scenario }: { scenario: DemoScenarioData }) {
  const isBlocked = scenario.legalReview.legalGateStatus === "BLOCKED";

  return (
    <div className="space-y-6">
      {isBlocked && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <svg className="h-5 w-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">Export Blocked by Legal Gate</p>
            <p className="text-xs text-red-600">
              Art. 9 special category data detected. All exports are blocked until legal approval is granted.
            </p>
          </div>
        </div>
      )}

      {/* Export Artifacts */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Export Artifacts</h3>
        <div className="mt-4 space-y-3">
          {scenario.exports.map((exp, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg border p-4 ${
                exp.legalGateStatus === "BLOCKED"
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  exp.legalGateStatus === "BLOCKED" ? "bg-red-100" : "bg-brand-50"
                }`}>
                  <svg className={`h-5 w-5 ${exp.legalGateStatus === "BLOCKED" ? "text-red-500" : "text-brand-600"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{exp.filename}</p>
                  <p className="text-xs text-gray-500">
                    {exp.type} &middot; {exp.size}
                    {exp.redactedFields > 0 && ` \u00B7 ${exp.redactedFields} fields redacted`}
                  </p>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                exp.legalGateStatus === "BLOCKED"
                  ? "bg-red-100 text-red-800"
                  : exp.status === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
              }`}>
                {exp.legalGateStatus === "BLOCKED" ? "BLOCKED" : exp.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!isBlocked && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Redacted" value={scenario.exports.reduce((a, e) => a + e.redactedFields, 0).toString()} sub="PII fields masked" />
          <StatCard label="Export Files" value={scenario.exports.length.toString()} sub="documents generated" />
          <StatCard label="Legal Gate" value="Passed" sub="Approved for release" />
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-medium text-brand-800">
          In the live product, exports are generated with full PII redaction, digital signatures, and download tracking. Two-person approval can be configured for sensitive cases.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Step 6: Audit Trail                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function AuditStep({ scenario }: { scenario: DemoScenarioData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Events" value={scenario.auditTimeline.length.toString()} sub="actions logged" />
        <StatCard label="Actors" value={Array.from(new Set(scenario.auditTimeline.map((e) => e.actor))).length.toString()} sub="distinct users/systems" />
        <StatCard label="Time Span" value={`${Math.ceil(
          (new Date(scenario.auditTimeline[scenario.auditTimeline.length - 1].timestamp).getTime() -
            new Date(scenario.auditTimeline[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1}d`} sub="from first to last event" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Complete Audit Timeline</h3>
        <div className="mt-4">
          <ol className="relative border-l-2 border-gray-200 ml-3">
            {scenario.auditTimeline.map((event, i) => (
              <AuditEventItem key={i} event={event} isLast={i === scenario.auditTimeline.length - 1} />
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-medium text-brand-800">
          In the live product, audit logs are immutable, tamper-evident, and include IP addresses, user agents, and request correlation IDs. Logs can be exported for regulatory reporting.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Shared Sub-Components                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {children ?? <p className="mt-0.5 text-sm text-gray-900">{value}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "scanning" | "completed" }) {
  if (status === "completed")
    return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Done</span>;
  if (status === "scanning")
    return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">Scanning...</span>;
  return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">Pending</span>;
}

function SystemIcon({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    EXCHANGE_ONLINE: "bg-blue-100 text-blue-600",
    SHAREPOINT: "bg-teal-100 text-teal-600",
    ONEDRIVE: "bg-indigo-100 text-indigo-600",
    M365: "bg-purple-100 text-purple-600",
  };
  const c = colors[provider] || "bg-gray-100 text-gray-600";

  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c}`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    </div>
  );
}

function EvidenceRow({ ev }: { ev: DemoEvidenceItem }) {
  return (
    <tr className="text-xs">
      <td className="py-2 pr-4">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{ev.workload}</span>
      </td>
      <td className="py-2 pr-4 font-medium text-gray-900">{ev.title}</td>
      <td className="py-2 pr-4 text-gray-500">{ev.itemType}</td>
      <td className="py-2 pr-4">
        <div className="flex flex-wrap gap-1">
          {ev.piiCategories.map((cat) => (
            <span key={cat} className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              cat === "HEALTH" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
            }`}>
              {cat}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${
                ev.sensitivityScore >= 80 ? "bg-red-500" : ev.sensitivityScore >= 50 ? "bg-amber-500" : "bg-green-500"
              }`}
              style={{ width: `${ev.sensitivityScore}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{ev.sensitivityScore}</span>
        </div>
      </td>
    </tr>
  );
}

function FindingCard({ finding }: { finding: DemoFinding }) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${
      finding.containsSpecialCategory ? "border-red-200" : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityColor(finding.severity)}`}>
            {finding.severity}
          </span>
          <h4 className="text-sm font-semibold text-gray-900">{finding.categoryLabel}</h4>
          {finding.containsSpecialCategory && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Art. 9</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{finding.evidenceCount} evidence items</p>
          <p className="text-xs text-gray-500">Confidence: {Math.round(finding.confidence * 100)}%</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{finding.summary}</p>
      {finding.requiresLegalReview && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Requires legal review
        </div>
      )}
    </div>
  );
}

function AuditEventItem({ event, isLast }: { event: DemoAuditEvent; isLast: boolean }) {
  const actionColors: Record<string, string> = {
    CASE_CREATED: "bg-brand-500",
    CASE_ASSIGNED: "bg-blue-500",
    STATUS_CHANGE: "bg-indigo-500",
    IDENTITY_VERIFIED: "bg-green-500",
    COPILOT_RUN_STARTED: "bg-purple-500",
    COPILOT_RUN_COMPLETED: "bg-purple-500",
    FINDINGS_GENERATED: "bg-amber-500",
    LEGAL_REVIEW_STARTED: "bg-orange-500",
    LEGAL_REVIEW_APPROVED: "bg-green-500",
    EXPORT_GENERATED: "bg-teal-500",
    EXPORT_BLOCKED: "bg-red-500",
    ERASURE_EXECUTED: "bg-red-500",
    ART9_ALERT: "bg-red-500",
  };

  const dotColor = actionColors[event.action] || "bg-gray-400";

  return (
    <li className={`ml-6 ${isLast ? "" : "pb-6"}`}>
      <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
            {event.action.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-gray-400">{formatDateTime(event.timestamp)}</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{event.details}</p>
        <p className="mt-0.5 text-xs text-gray-400">by {event.actor}</p>
      </div>
    </li>
  );
}
