"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useCaseDetail,
  useOverviewTab,
  useTasksTab,
  useDocumentsTab,
  useCommunicationsTab,
  useDataCollectionTab,
  useLegalReviewTab,
  useCopilotTab,
} from "@/features/cases/hooks";
import {
  CaseHeader,
  OverviewTab,
  TasksTab,
  DocumentsTab,
  CommunicationsTab,
  DataCollectionTab,
  LegalReviewTab,
  CopilotTab,
  CaseSidebar,
  TransitionModal,
  TimelineSection,
} from "@/features/cases/components";
import { getAllowedTransitions } from "@/features/cases/services";
import { exportCase } from "@/features/cases/repositories";
import type { TabKey } from "@/features/cases/types";
import DeadlinePanel from "@/components/DeadlinePanel";
import IdvPanel from "@/components/IdvPanel";
import ResponsePanel from "@/components/ResponsePanel";
import IncidentPanel from "@/components/IncidentPanel";
import VendorPanel from "@/components/VendorPanel";

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;

  const detail = useCaseDetail(caseId);
  const { caseData, loading, users, systems, activeTab, setActiveTab, canManage, canExport, canCopilot, refreshCase, session } = detail;
  const userRole = session?.user?.role ?? "";

  const overview = useOverviewTab(caseId, caseData, refreshCase);
  const tasks = useTasksTab(caseId, refreshCase);
  const documents = useDocumentsTab(caseId, refreshCase);
  const communications = useCommunicationsTab(caseId, refreshCase);
  const dataCollection = useDataCollectionTab(caseId, refreshCase);
  const legalReview = useLegalReviewTab(caseId, refreshCase);
  const copilot = useCopilotTab(caseId);

  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState("");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  async function handleTransition() {
    if (!transitionReason.trim()) return;
    setTransitioning(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/transitions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: transitionTarget, reason: transitionReason }),
      });
      if (res.ok) { setShowTransitionModal(false); setTransitionTarget(""); setTransitionReason(""); await refreshCase(); }
    } catch { /* silently fail */ } finally { setTransitioning(false); }
  }

  async function handleExport() {
    await exportCase(caseId, caseData?.caseNumber ?? "case");
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
      <div className="card h-48 animate-pulse" />
      <div className="card h-32 animate-pulse" />
    </div>
  );

  if (!caseData) return (
    <div className="py-16 text-center">
      <p className="text-gray-500">Case not found.</p>
      <Link href="/cases" className="btn-primary mt-4 inline-flex">Back to Cases</Link>
    </div>
  );

  const allowedTransitions = getAllowedTransitions(caseData.status);
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Tasks", count: caseData.tasks.length },
    { key: "documents", label: "Documents", count: caseData.documents.length },
    { key: "communications", label: "Communications", count: caseData.communicationLogs?.length ?? 0 },
    { key: "data-collection", label: "Data Collection", count: caseData.dataCollectionItems?.length ?? 0 },
    { key: "legal-review", label: "Legal Review", count: caseData.legalReviews?.length ?? 0 },
    { key: "copilot", label: "Copilot", count: copilot.copilotRuns.length },
    { key: "response", label: "Response" },
    { key: "idv", label: "Identity" },
    { key: "incidents", label: "Incidents" },
    { key: "vendors", label: "Vendors" },
    { key: "deadlines", label: "Deadlines" },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <CaseHeader
        caseData={caseData} activeTab={activeTab} tabs={tabs}
        canExport={canExport} onTabChange={setActiveTab} onExport={handleExport}
        allowedTransitions={allowedTransitions} canManage={canManage}
        onTransition={(t) => { setTransitionTarget(t); setShowTransitionModal(true); }}
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-4">
        <div className="space-y-4 md:space-y-6 lg:col-span-3">
          {activeTab === "overview" && <OverviewTab caseData={caseData} canManage={canManage} users={users} ov={overview} />}
          {activeTab === "tasks" && <TasksTab caseData={caseData} canManage={canManage} users={users} tt={tasks} />}
          {activeTab === "documents" && <DocumentsTab caseData={caseData} canManage={canManage} {...documents} onUpload={documents.handleUploadDocument} />}
          {activeTab === "communications" && <CommunicationsTab caseData={caseData} canManage={canManage} cm={communications} />}
          {activeTab === "data-collection" && <DataCollectionTab caseData={caseData} systems={systems} canManage={canManage} dc={dataCollection} />}
          {activeTab === "legal-review" && <LegalReviewTab caseData={caseData} canManage={canManage} lr={legalReview} />}
          {activeTab === "copilot" && <CopilotTab caseData={caseData} canManage={canManage} canCopilot={canCopilot} copilot={copilot} />}
          {activeTab === "response" && <ResponsePanel caseId={caseId} userRole={userRole} />}
          {activeTab === "idv" && <IdvPanel caseId={caseId} userRole={userRole} />}
          {activeTab === "incidents" && <IncidentPanel caseId={caseId} />}
          {activeTab === "vendors" && <VendorPanel caseId={caseId} />}
          {activeTab === "deadlines" && <DeadlinePanel caseId={caseId} userRole={userRole} />}
          {activeTab === "timeline" && <TimelineSection caseData={caseData} />}
        </div>
        <CaseSidebar caseData={caseData} />
      </div>

      {showTransitionModal && (
        <TransitionModal
          currentStatus={caseData.status} targetStatus={transitionTarget}
          reason={transitionReason} onReasonChange={setTransitionReason}
          onConfirm={handleTransition} transitioning={transitioning}
          onCancel={() => { setShowTransitionModal(false); setTransitionTarget(""); setTransitionReason(""); }}
        />
      )}
    </div>
  );
}
