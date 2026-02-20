"use client";

import { useState, FormEvent } from "react";
import { postIncidentAction } from "../services";

/**
 * Hook for the Communications tab: add communication records.
 */
export function useCommunicationsTab(
  incidentId: string,
  onRefresh: () => Promise<unknown>
) {
  const [showAddComm, setShowAddComm] = useState(false);
  const [commDirection, setCommDirection] = useState("OUTBOUND");
  const [commChannel, setCommChannel] = useState("EMAIL");
  const [commRecipient, setCommRecipient] = useState("");
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [addingComm, setAddingComm] = useState(false);

  async function handleAddComm(e: FormEvent) {
    e.preventDefault();
    setAddingComm(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_communication",
        direction: commDirection,
        channel: commChannel,
        recipient: commRecipient || null,
        subject: commSubject || null,
        body: commBody || null,
      });
      await onRefresh();
      setShowAddComm(false);
      setCommDirection("OUTBOUND");
      setCommChannel("EMAIL");
      setCommRecipient("");
      setCommSubject("");
      setCommBody("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add communication");
    } finally {
      setAddingComm(false);
    }
  }

  return {
    showAddComm, setShowAddComm,
    commDirection, setCommDirection,
    commChannel, setCommChannel,
    commRecipient, setCommRecipient,
    commSubject, setCommSubject,
    commBody, setCommBody,
    addingComm,
    handleAddComm,
  };
}
