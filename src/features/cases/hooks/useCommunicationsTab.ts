"use client";

import { useState, FormEvent } from "react";
import * as caseRepo from "../repositories";

/**
 * Hook for Communications tab: log communications.
 */
export function useCommunicationsTab(caseId: string, onRefresh: () => Promise<void>) {
  const [commDirection, setCommDirection] = useState("OUTBOUND");
  const [commChannel, setCommChannel] = useState("EMAIL");
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [addingComm, setAddingComm] = useState(false);

  async function handleAddCommunication(e: FormEvent) {
    e.preventDefault();
    if (!commBody.trim()) return;
    setAddingComm(true);
    try {
      await caseRepo.createCommunication(caseId, {
        direction: commDirection,
        channel: commChannel,
        subject: commSubject || undefined,
        body: commBody,
      });
      setCommSubject("");
      setCommBody("");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setAddingComm(false); }
  }

  return {
    commDirection, setCommDirection,
    commChannel, setCommChannel,
    commSubject, setCommSubject,
    commBody, setCommBody,
    addingComm, handleAddCommunication,
  };
}
