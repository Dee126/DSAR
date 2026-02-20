"use client";

import type { Incident } from "../types";
import { useImpactTab } from "../hooks/useImpactTab";
import { REGULATOR_STATUS_COLORS } from "../constants";
import { formatDate, formatDateTime } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function ImpactTab({ incident, incidentId, onRefresh }: Props) {
  const imp = useImpactTab(incidentId, onRefresh);

  return (
    <div className="space-y-6">
      <AssessmentSection incident={incident} imp={imp} />
      <RegulatorSection incident={incident} imp={imp} />
    </div>
  );
}

// eslint-disable-next-line
function AssessmentSection({ incident, imp }: { incident: Incident; imp: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Impact Assessment (Art. 33 / 34)</h2>
        <button onClick={() => imp.setShowAddAssessment(!imp.showAddAssessment)} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
          {imp.showAddAssessment ? "Cancel" : "New Assessment Version"}
        </button>
      </div>

      {imp.showAddAssessment && (
        <form onSubmit={imp.handleAddAssessment} className="mb-6 bg-gray-50 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nature of Breach</label>
            <textarea value={imp.assessNature} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessNature(e.target.value)} rows={3} placeholder="Describe the nature of the personal data breach..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categories & Approx. Number of Subjects</label>
              <textarea value={imp.assessSubjects} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessSubjects(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categories & Approx. Number of Records</label>
              <textarea value={imp.assessRecords} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessRecords(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Likely Consequences</label>
            <textarea value={imp.assessConsequences} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessConsequences(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Measures Taken or Proposed</label>
            <textarea value={imp.assessMeasures} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessMeasures(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DPO Contact Details</label>
            <input type="text" value={imp.assessDpoContact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => imp.setAssessDpoContact(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea value={imp.assessNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => imp.setAssessNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={imp.addingAssessment} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {imp.addingAssessment ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </form>
      )}

      {incident.assessments.length === 0 ? (
        <p className="text-sm text-gray-500">No assessments recorded yet. Click &quot;New Assessment Version&quot; to add one.</p>
      ) : (
        <div className="space-y-4">
          {incident.assessments.map((a, idx) => (
            <div key={a.id} className={`border rounded-lg p-4 ${idx === 0 ? "border-brand-300 bg-brand-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Version {a.version}</h3>
                  {idx === 0 && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">Latest</span>}
                </div>
                <span className="text-xs text-gray-500">
                  {formatDateTime(a.createdAt)}{a.createdBy ? ` by ${a.createdBy.name}` : ""}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm">
                {([
                  ["natureOfBreach", "Nature of Breach"],
                  ["categoriesAndApproxSubjects", "Categories & Approx. Subjects"],
                  ["categoriesAndApproxRecords", "Categories & Approx. Records"],
                  ["likelyConsequences", "Likely Consequences"],
                  ["measuresTakenOrProposed", "Measures Taken or Proposed"],
                  ["dpoContactDetails", "DPO Contact Details"],
                  ["additionalNotes", "Additional Notes"],
                ] as const).map(([key, label]) =>
                  a[key] ? (
                    <div key={key}>
                      <dt className="font-medium text-gray-700">{label}</dt>
                      <dd className="text-gray-600 mt-0.5 whitespace-pre-wrap">{a[key]}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegulatorSection({ incident, imp }: { incident: Incident; imp: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Regulator Records</h2>
        <button onClick={() => imp.setShowAddRegulator(!imp.showAddRegulator)} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
          {imp.showAddRegulator ? "Cancel" : "Add Record"}
        </button>
      </div>

      {imp.showAddRegulator && (
        <form onSubmit={imp.handleAddRegulator} className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authority Name *</label>
              <input type="text" value={imp.regAuthorityName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => imp.setRegAuthorityName(e.target.value)} required placeholder="e.g. ICO, CNIL, BfDI" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
              <input type="text" value={imp.regReferenceNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => imp.setRegReferenceNumber(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={imp.regStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => imp.setRegStatus(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="INQUIRY">Inquiry</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={imp.regNotes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => imp.setRegNotes(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={imp.addingRegulator} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {imp.addingRegulator ? "Adding..." : "Add Record"}
            </button>
          </div>
        </form>
      )}

      {incident.regulatorRecords.length === 0 ? (
        <p className="text-sm text-gray-500">No regulator records yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Authority", "Reference", "Status", "Submitted", "Notes"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incident.regulatorRecords.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{r.authorityName}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.referenceNumber ?? "—"}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REGULATOR_STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{formatDate(r.submittedAt)}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
