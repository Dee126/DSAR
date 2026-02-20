"use client";

import { useEffect, useState, useCallback } from "react";
import type { CopilotRunSummary, CopilotRunDetail } from "../types";
import * as copilotRepo from "../repositories";

/**
 * Hook for Copilot tab: manage runs, detail views, legal approval.
 */
export function useCopilotTab(caseId: string) {
  const [copilotRuns, setCopilotRuns] = useState<CopilotRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<CopilotRunDetail | null>(null);
  const [copilotJustification, setCopilotJustification] = useState("");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [availableIntegrations, setAvailableIntegrations] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  const [startingRun, setStartingRun] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");

  const fetchRuns = useCallback(async () => {
    const runs = await copilotRepo.fetchCopilotRuns(caseId);
    setCopilotRuns(runs);
  }, [caseId]);

  const fetchRunDetail = useCallback(async (runId: string) => {
    setLoadingRun(true);
    try {
      const detail = await copilotRepo.fetchCopilotRunDetail(caseId, runId);
      if (detail) setSelectedRun(detail);
    } finally { setLoadingRun(false); }
  }, [caseId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  useEffect(() => {
    async function loadIntegrations() {
      const integrations = await copilotRepo.fetchIntegrations();
      setAvailableIntegrations(integrations);
      setSelectedIntegrations(integrations.map((i) => i.id));
    }
    loadIntegrations();
  }, []);

  // Auto-poll running runs
  useEffect(() => {
    if (!selectedRun || !["DRAFT", "QUEUED", "RUNNING"].includes(selectedRun.status)) return;
    const interval = setInterval(() => fetchRunDetail(selectedRun.id), 3000);
    return () => clearInterval(interval);
  }, [selectedRun?.id, selectedRun?.status, fetchRunDetail]);

  async function handleStartRun() {
    if (copilotJustification.trim().length < 5) return;
    setStartingRun(true);
    try {
      await copilotRepo.startCopilotRun(caseId, {
        justification: copilotJustification,
        providerSelection: selectedIntegrations,
      });
      setCopilotJustification("");
      await fetchRuns();
    } finally { setStartingRun(false); }
  }

  async function handleRunDialogSubmit(params: {
    justification: string; providerSelection: string[];
    contentScanRequested: boolean; ocrRequested: boolean; llmRequested: boolean;
  }) {
    await copilotRepo.startCopilotRun(caseId, params);
    setShowRunDialog(false);
    await fetchRuns();
  }

  async function handleGenerateSummary(runId: string, summaryType: string) {
    await copilotRepo.generateSummary(caseId, runId, summaryType);
    await fetchRunDetail(runId);
  }

  async function handleLegalApproval(runId: string, status: "APPROVED" | "REJECTED") {
    await copilotRepo.updateLegalApproval(caseId, runId, status);
    await fetchRunDetail(runId);
  }

  async function handleExportEvidence(runId: string) {
    try {
      await copilotRepo.exportCopilotEvidence(caseId, runId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Export failed");
    }
  }

  return {
    copilotRuns, selectedRun, setSelectedRun,
    copilotJustification, setCopilotJustification,
    selectedIntegrations, setSelectedIntegrations,
    availableIntegrations,
    startingRun, loadingRun,
    showRunDialog, setShowRunDialog,
    copilotQuestion, setCopilotQuestion,
    handleStartRun, handleRunDialogSubmit,
    fetchRunDetail, handleGenerateSummary,
    handleLegalApproval, handleExportEvidence,
    fetchRuns,
  };
}
