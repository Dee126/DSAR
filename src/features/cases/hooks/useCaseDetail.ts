"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { DSARCaseDetail, CaseUser, SystemItem, TabKey } from "../types";
import * as caseRepo from "../repositories";
import { canManageCase, canExportCase, canUseCopilot } from "../services";

/**
 * Core hook: loads case data, users, systems, and manages tab selection + roles.
 */
export function useCaseDetail(caseId: string) {
  const router = useRouter();
  const { data: session } = useSession();

  const [caseData, setCaseData] = useState<DSARCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<CaseUser[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const userRole = session?.user?.role ?? "";
  const canManage = canManageCase(userRole);
  const canExport = canExportCase(userRole);
  const canCopilot = canUseCopilot(userRole);

  const fetchCase = useCallback(async () => {
    try {
      const data = await caseRepo.fetchCase(caseId);
      if (!data) { router.push("/cases"); return; }
      setCaseData(data);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [caseId, router]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  useEffect(() => {
    async function loadReferenceData() {
      const [u, s] = await Promise.all([caseRepo.fetchUsers(), caseRepo.fetchSystems()]);
      setUsers(u);
      setSystems(s);
    }
    loadReferenceData();
  }, []);

  return {
    caseData,
    loading,
    users,
    systems,
    activeTab, setActiveTab,
    userRole,
    canManage,
    canExport,
    canCopilot,
    refreshCase: fetchCase,
    session,
  };
}
