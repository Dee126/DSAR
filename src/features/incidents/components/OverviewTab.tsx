"use client";

import type { Incident } from "../types";
import { useOverviewTab } from "../hooks/useOverviewTab";
import { SEVERITY_COLORS, INCIDENT_STATUS_COLORS } from "../constants";
import { formatDate } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function OverviewTab({ incident, incidentId, onRefresh }: Props) {
  const ov = useOverviewTab(incidentId, incident, onRefresh);

  return (
    <div className="space-y-6">
      {/* Editable detail card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Incident Details</h2>
          {!ov.editing ? (
            <button onClick={() => ov.setEditing(true)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Edit</button>
          ) : (
            <button onClick={ov.handleCancelEdit} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          )}
        </div>

        {ov.editing ? (
          <form onSubmit={ov.handleSaveOverview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={ov.editTitle} onChange={(e) => ov.setEditTitle(e.target.value)} required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={ov.editDescription} onChange={(e) => ov.setEditDescription(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select value={ov.editSeverity} onChange={(e) => ov.setEditSeverity(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={ov.editStatus} onChange={(e) => ov.setEditStatus(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                  <option value="OPEN">Open</option>
                  <option value="CONTAINED">Contained</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={ov.saving} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {ov.saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <OverviewReadonly incident={incident} />
        )}
      </div>

      {/* Key Dates */}
      <KeyDatesCard incident={incident} />

      {/* Regulator Notification */}
      <RegulatorNotificationCard incident={incident} />

      {/* Categories of Data */}
      {incident.categoriesOfData && incident.categoriesOfData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories of Data Affected</h2>
          <div className="flex flex-wrap gap-2">
            {incident.categoriesOfData.map((cat, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{cat}</span>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Source</h2>
        <p className="text-sm text-gray-700">{incident.source ?? "Not specified"}</p>
      </div>

      {/* Contacts */}
      <ContactsCard incident={incident} ov={ov} />
    </div>
  );
}

function OverviewReadonly({ incident }: { incident: Incident }) {
  return (
    <div className="space-y-4">
      {incident.description && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.description}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Severity</p>
          <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[incident.severity] ?? "bg-gray-100 text-gray-700"}`}>{incident.severity}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
          <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${INCIDENT_STATUS_COLORS[incident.status] ?? "bg-gray-100 text-gray-700"}`}>{incident.status}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Cross-Border</p>
          <p className="text-sm text-gray-900 mt-1">{incident.crossBorder ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Data Subjects (est.)</p>
          <p className="text-sm text-gray-900 mt-1">{incident.dataSubjectsEstimate != null ? incident.dataSubjectsEstimate.toLocaleString() : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function KeyDatesCard({ incident }: { incident: Incident }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Dates</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["createdAt", "detectedAt", "containedAt", "resolvedAt"] as const).map((field) => (
          <div key={field}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {field.replace("At", "").replace("created", "Created")}
            </p>
            <p className="text-sm text-gray-900 mt-1">{formatDate(incident[field])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegulatorNotificationCard({ incident }: { incident: Incident }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Regulator Notification</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Notified</p>
          <p className="text-sm text-gray-900 mt-1">
            {incident.regulatorNotified
              ? <span className="text-green-700 font-medium">Yes</span>
              : <span className="text-red-700 font-medium">No</span>}
          </p>
        </div>
        {incident.regulatorNotified && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Notification Date</p>
            <p className="text-sm text-gray-900 mt-1">{formatDate(incident.regulatorNotifiedAt)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line
function ContactsCard({ incident, ov }: { incident: Incident; ov: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
        <button onClick={() => ov.setShowAddContact(!ov.showAddContact)} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
          {ov.showAddContact ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {ov.showAddContact && (
        <form onSubmit={ov.handleAddContact} className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={ov.contactName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ov.setContactName(e.target.value)} required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <input type="text" value={ov.contactRole} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ov.setContactRole(e.target.value)} required placeholder="e.g. DPO, IT Lead, Legal" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={ov.contactEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ov.setContactEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={ov.contactPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ov.setContactPhone(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={ov.addingContact} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {ov.addingContact ? "Adding..." : "Add Contact"}
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
                {["Name", "Role", "Email", "Phone"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incident.contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{c.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.role}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.email ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
