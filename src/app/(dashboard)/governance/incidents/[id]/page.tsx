"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useIncidentDetail,
  useSystemsTab,
} from "@/features/incidents/hooks";
import {
  IncidentHeader,
  OverviewTab,
  SystemsTab,
  ImpactTab,
  TimelineTab,
  CommunicationsTab,
  LinkedDsarsTab,
  ExportTab,
} from "@/features/incidents/components";

export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params.id as string;

  const {
    incident,
    loading,
    error,
    activeTab,
    setActiveTab,
    refreshIncident,
  } = useIncidentDetail(incidentId);

  const systems = useSystemsTab(incidentId, activeTab, refreshIncident);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error || "Incident not found"}
        </div>
        <Link
          href="/governance"
          className="mt-4 inline-block text-brand-600 hover:underline"
        >
          Back to Governance
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <IncidentHeader
        incident={incident}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <OverviewTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}

      {activeTab === "systems" && (
        <SystemsTab
          incident={incident}
          systemsList={systems.systemsList}
          systemsLoading={systems.systemsLoading}
          selectedSystemId={systems.selectedSystemId}
          setSelectedSystemId={systems.setSelectedSystemId}
          addingSystem={systems.addingSystem}
          removingSystemId={systems.removingSystemId}
          onAddSystem={systems.handleAddSystem}
          onRemoveSystem={systems.handleRemoveSystem}
        />
      )}

      {activeTab === "impact" && (
        <ImpactTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}

      {activeTab === "timeline" && (
        <TimelineTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}

      {activeTab === "communications" && (
        <CommunicationsTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}

      {activeTab === "linked-dsars" && (
        <LinkedDsarsTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}

      {activeTab === "export" && (
        <ExportTab
          incident={incident}
          incidentId={incidentId}
          onRefresh={refreshIncident}
        />
      )}
    </div>
  );
}
