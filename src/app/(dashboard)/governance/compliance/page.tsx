"use client";

import { useState, useEffect, useCallback } from "react";

interface Framework {
  id: string;
  name: string;
  version: string;
  description: string;
  _count: { controls: number };
}

interface Finding {
  id: string;
  status: string;
  notes: string;
  control: { controlId: string; title: string; description: string };
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summaryJson: { total: number; compliant: number; partial: number; missing: number; score: number } | null;
  framework: { name: string; version: string };
  createdBy: { name: string; email: string };
}

export default function CompliancePage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [assessmentRunning, setAssessmentRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFrameworks = useCallback(async () => {
    try {
      const res = await fetch("/api/governance/compliance?view=frameworks");
      if (!res.ok) throw new Error("Failed to load frameworks");
      const data = await res.json();
      setFrameworks(data.frameworks || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/governance/compliance?view=runs");
      if (!res.ok) throw new Error("Failed to load runs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const fetchFindings = useCallback(async (runId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/governance/compliance?view=findings&runId=${runId}`);
      if (!res.ok) throw new Error("Failed to load findings");
      const data = await res.json();
      setFindings(data.findings || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFrameworks();
    fetchRuns();
  }, [fetchFrameworks, fetchRuns]);

  useEffect(() => {
    if (selectedRun) fetchFindings(selectedRun);
  }, [selectedRun, fetchFindings]);

  const runAssessment = async () => {
    if (!selectedFramework) return;
    setAssessmentRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/governance/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_assessment", frameworkId: selectedFramework }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Assessment failed");
      }
      const data = await res.json();
      setSelectedRun(data.runId);
      await fetchRuns();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssessmentRunning(false);
    }
  };

  const exportReport = async (format: "export_json" | "export_html") => {
    if (!selectedRun) return;
    try {
      const res = await fetch("/api/governance/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: format, runId: selectedRun }),
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const ext = format === "export_json" ? "json" : "html";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance_report.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const filteredFindings = statusFilter === "ALL"
    ? findings
    : findings.filter((f) => f.status === statusFilter);

  const statusColor = (s: string) => {
    if (s === "COMPLIANT") return "bg-green-100 text-green-800";
    if (s === "PARTIAL") return "bg-yellow-100 text-yellow-800";
    if (s === "MISSING") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const selectedRunData = runs.find((r) => r.id === selectedRun);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & Evidence</h1>
          <p className="text-sm text-gray-500 mt-1">
            Run compliance assessments and generate evidence packs for audits
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-500 underline">Dismiss</button>
        </div>
      )}

      {/* Framework Selection + Run Assessment */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Run Assessment</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Framework</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value)}
            >
              <option value="">Select a framework...</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} v{f.version} ({f._count.controls} controls)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={runAssessment}
            disabled={!selectedFramework || assessmentRunning}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assessmentRunning ? "Running..." : "Run Assessment"}
          </button>
        </div>
        {frameworks.length > 0 && selectedFramework && (
          <p className="text-sm text-gray-500 mt-2">
            {frameworks.find((f) => f.id === selectedFramework)?.description}
          </p>
        )}
      </div>

      {/* Past Runs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Assessment History</h2>
        {runs.length === 0 ? (
          <p className="text-gray-500 text-sm">No assessments run yet. Select a framework and run an assessment.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRun(run.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedRun === run.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{run.framework.name}</span>
                    <span className="text-gray-500 text-sm ml-2">v{run.framework.version}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.summaryJson && (
                      <span className={`text-sm font-semibold ${
                        run.summaryJson.score >= 80 ? "text-green-600" :
                        run.summaryJson.score >= 50 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {run.summaryJson.score}%
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      run.status === "SUCCESS" ? "bg-green-100 text-green-700" :
                      run.status === "RUNNING" ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {run.status}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(run.startedAt).toLocaleString()} by {run.createdBy.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Findings Detail */}
      {selectedRun && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Controls &amp; Findings</h2>
              {selectedRunData?.summaryJson && (
                <p className="text-sm text-gray-500">
                  Score: {selectedRunData.summaryJson.score}% |
                  {selectedRunData.summaryJson.compliant} compliant,
                  {selectedRunData.summaryJson.partial} partial,
                  {selectedRunData.summaryJson.missing} missing
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="MISSING">Missing</option>
              </select>
              <button
                onClick={() => exportReport("export_html")}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Export HTML
              </button>
              <button
                onClick={() => exportReport("export_json")}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : filteredFindings.length === 0 ? (
            <p className="text-gray-500 text-sm">No findings match the current filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Control</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((f) => (
                    <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-xs">{f.control.controlId}</td>
                      <td className="py-2 px-3">{f.control.title}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor(f.status)}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 text-xs max-w-md truncate">{f.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
