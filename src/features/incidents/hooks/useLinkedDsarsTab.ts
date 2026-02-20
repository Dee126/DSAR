"use client";

import { useState, FormEvent } from "react";
import type { DSARCaseOption } from "../types";
import {
  searchDsarCases,
  linkDsarToIncident,
  unlinkDsarFromIncident,
  createSurgeGroup,
} from "../services";

/**
 * Hook for the Linked DSARs tab: search, link/unlink DSARs, surge groups.
 */
export function useLinkedDsarsTab(
  incidentId: string,
  onRefresh: () => Promise<unknown>
) {
  /* ── Link DSAR state ── */
  const [showLinkDsar, setShowLinkDsar] = useState(false);
  const [dsarSearch, setDsarSearch] = useState("");
  const [dsarOptions, setDsarOptions] = useState<DSARCaseOption[]>([]);
  const [dsarSearching, setDsarSearching] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [linkReason, setLinkReason] = useState("");
  const [linkingDsar, setLinkingDsar] = useState(false);
  const [unlinkingCaseId, setUnlinkingCaseId] = useState<string | null>(null);

  /* ── Surge group state ── */
  const [showCreateSurge, setShowCreateSurge] = useState(false);
  const [surgeName, setSurgeName] = useState("");
  const [surgeCaseIds, setSurgeCaseIds] = useState("");
  const [creatingSurge, setCreatingSurge] = useState(false);

  function toggleShowLinkDsar() {
    const next = !showLinkDsar;
    setShowLinkDsar(next);
    if (next) {
      setDsarOptions([]);
      setDsarSearch("");
      setSelectedCaseId("");
      setLinkReason("");
    }
  }

  async function handleSearchDsars() {
    setDsarSearching(true);
    try {
      const results = await searchDsarCases(dsarSearch);
      setDsarOptions(results);
    } finally {
      setDsarSearching(false);
    }
  }

  async function handleLinkDsar(e: FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setLinkingDsar(true);
    try {
      await linkDsarToIncident(selectedCaseId, incidentId, linkReason || null);
      await onRefresh();
      setShowLinkDsar(false);
      setSelectedCaseId("");
      setLinkReason("");
      setDsarSearch("");
      setDsarOptions([]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to link DSAR");
    } finally {
      setLinkingDsar(false);
    }
  }

  async function handleUnlinkDsar(caseId: string) {
    if (!confirm("Unlink this DSAR case from the incident?")) return;
    setUnlinkingCaseId(caseId);
    try {
      await unlinkDsarFromIncident(caseId, incidentId);
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unlink DSAR");
    } finally {
      setUnlinkingCaseId(null);
    }
  }

  async function handleCreateSurge(e: FormEvent) {
    e.preventDefault();
    setCreatingSurge(true);
    try {
      const ids = surgeCaseIds.split(",").map((s) => s.trim()).filter(Boolean);
      await createSurgeGroup(incidentId, surgeName, ids);
      await onRefresh();
      setShowCreateSurge(false);
      setSurgeName("");
      setSurgeCaseIds("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create surge group");
    } finally {
      setCreatingSurge(false);
    }
  }

  return {
    showLinkDsar, toggleShowLinkDsar,
    dsarSearch, setDsarSearch,
    dsarOptions,
    dsarSearching,
    selectedCaseId, setSelectedCaseId,
    linkReason, setLinkReason,
    linkingDsar,
    unlinkingCaseId,
    handleSearchDsars,
    handleLinkDsar,
    handleUnlinkDsar,
    showCreateSurge, setShowCreateSurge,
    surgeName, setSurgeName,
    surgeCaseIds, setSurgeCaseIds,
    creatingSurge,
    handleCreateSurge,
  };
}
