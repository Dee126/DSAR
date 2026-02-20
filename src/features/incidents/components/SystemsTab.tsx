"use client";

import type { Incident, SystemOption } from "../types";

interface Props {
  incident: Incident;
  systemsList: SystemOption[];
  systemsLoading: boolean;
  selectedSystemId: string;
  setSelectedSystemId: (id: string) => void;
  addingSystem: boolean;
  removingSystemId: string | null;
  onAddSystem: () => void;
  onRemoveSystem: (systemId: string) => void;
}

export function SystemsTab({
  incident, systemsList, systemsLoading,
  selectedSystemId, setSelectedSystemId,
  addingSystem, removingSystemId,
  onAddSystem, onRemoveSystem,
}: Props) {
  const linkedSystemIds = new Set(incident.incidentSystems.map((is) => is.systemId));
  const availableSystems = systemsList.filter((s) => !linkedSystemIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Linked Systems</h2>
        </div>

        {/* Add system control */}
        <div className="mb-6 flex items-end gap-3 bg-gray-50 rounded-lg p-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add System</label>
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
                    {s.name}{s.owner ? ` (${s.owner})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={onAddSystem}
            disabled={!selectedSystemId || addingSystem}
            className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {addingSystem ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Systems list */}
        {incident.incidentSystems.length === 0 ? (
          <p className="text-sm text-gray-500">No systems linked to this incident yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["System", "Description", "Owner", "Actions"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incident.incidentSystems.map((is) => (
                  <tr key={is.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{is.system.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{is.system.description ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{is.system.owner ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <button
                        onClick={() => onRemoveSystem(is.systemId)}
                        disabled={removingSystemId === is.systemId}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {removingSystemId === is.systemId ? "Removing..." : "Remove"}
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
  );
}
