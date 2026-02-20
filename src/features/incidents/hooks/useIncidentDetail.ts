"use client";

import { useEffect, useState, useCallback } from "react";
import type { Incident, TabKey } from "../types";
import { fetchIncident as apiFetchIncident } from "../services";

/**
 * Core hook: loads incident data and manages tab selection.
 */
export function useIncidentDetail(incidentId: string) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchIncident = useCallback(async () => {
    try {
      const data = await apiFetchIncident(incidentId);
      setIncident(data);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load incident");
      return null;
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  return {
    incident,
    loading,
    error,
    activeTab,
    setActiveTab,
    refreshIncident: fetchIncident,
  };
}
