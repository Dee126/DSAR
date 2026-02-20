"use client";

import { useState, FormEvent } from "react";
import * as caseRepo from "../repositories";

/**
 * Hook for Data Collection tab: add data sources, update status.
 */
export function useDataCollectionTab(caseId: string, onRefresh: () => Promise<void>) {
  const [dcSystem, setDcSystem] = useState("");
  const [dcQuery, setDcQuery] = useState("");
  const [addingDc, setAddingDc] = useState(false);

  async function handleAddDataCollection(e: FormEvent) {
    e.preventDefault();
    if (!dcSystem) return;
    setAddingDc(true);
    try {
      await caseRepo.createDataCollection(caseId, {
        systemId: dcSystem,
        querySpec: dcQuery || undefined,
      });
      setDcSystem("");
      setDcQuery("");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setAddingDc(false); }
  }

  async function handleUpdateDcStatus(itemId: string, status: string) {
    await caseRepo.updateDataCollectionStatus(caseId, itemId, status);
    await onRefresh();
  }

  return {
    dcSystem, setDcSystem,
    dcQuery, setDcQuery,
    addingDc, handleAddDataCollection, handleUpdateDcStatus,
  };
}
