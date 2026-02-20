"use client";

import { useEffect, useState, useCallback } from "react";
import type { SystemOption, TabKey } from "../types";
import { fetchSystems as apiFetchSystems, postIncidentAction } from "../services";

/**
 * Hook for the Systems tab: add/remove linked systems.
 */
export function useSystemsTab(
  incidentId: string,
  activeTab: TabKey,
  onRefresh: () => Promise<unknown>
) {
  const [systemsList, setSystemsList] = useState<SystemOption[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [addingSystem, setAddingSystem] = useState(false);
  const [removingSystemId, setRemovingSystemId] = useState<string | null>(null);

  const fetchSystems = useCallback(async () => {
    setSystemsLoading(true);
    try {
      const systems = await apiFetchSystems();
      setSystemsList(systems);
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "systems") {
      fetchSystems();
    }
  }, [activeTab, fetchSystems]);

  async function handleAddSystem() {
    if (!selectedSystemId) return;
    setAddingSystem(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_system",
        systemId: selectedSystemId,
      });
      await onRefresh();
      setSelectedSystemId("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add system");
    } finally {
      setAddingSystem(false);
    }
  }

  async function handleRemoveSystem(systemId: string) {
    setRemovingSystemId(systemId);
    try {
      await postIncidentAction(incidentId, {
        action: "remove_system",
        systemId,
      });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove system");
    } finally {
      setRemovingSystemId(null);
    }
  }

  return {
    systemsList,
    systemsLoading,
    selectedSystemId, setSelectedSystemId,
    addingSystem,
    removingSystemId,
    handleAddSystem,
    handleRemoveSystem,
  };
}
