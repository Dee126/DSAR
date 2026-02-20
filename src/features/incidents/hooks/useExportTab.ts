"use client";

import { useState } from "react";
import { generateExport, getExportDownloadUrl } from "../services";

/**
 * Hook for the Authority Export tab.
 */
export function useExportTab(
  incidentId: string,
  onRefresh: () => Promise<unknown>
) {
  const [exportIncludeTimeline, setExportIncludeTimeline] = useState(true);
  const [exportIncludeDsarList, setExportIncludeDsarList] = useState(true);
  const [exportIncludeEvidence, setExportIncludeEvidence] = useState(true);
  const [exportIncludeResponses, setExportIncludeResponses] = useState(false);
  const [generatingExport, setGeneratingExport] = useState(false);

  async function handleGenerateExport() {
    setGeneratingExport(true);
    try {
      await generateExport(incidentId, {
        includeTimeline: exportIncludeTimeline,
        includeDsarList: exportIncludeDsarList,
        includeEvidence: exportIncludeEvidence,
        includeResponses: exportIncludeResponses,
      });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate export");
    } finally {
      setGeneratingExport(false);
    }
  }

  function handleDownloadExport(exportRunId: string) {
    window.open(getExportDownloadUrl(incidentId, exportRunId), "_blank");
  }

  return {
    exportIncludeTimeline, setExportIncludeTimeline,
    exportIncludeDsarList, setExportIncludeDsarList,
    exportIncludeEvidence, setExportIncludeEvidence,
    exportIncludeResponses, setExportIncludeResponses,
    generatingExport,
    handleGenerateExport,
    handleDownloadExport,
  };
}
