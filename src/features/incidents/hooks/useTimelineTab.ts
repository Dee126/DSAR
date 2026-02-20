"use client";

import { useState, FormEvent } from "react";
import { postIncidentAction } from "../services";

/**
 * Hook for the Timeline tab: add timeline events.
 */
export function useTimelineTab(
  incidentId: string,
  onRefresh: () => Promise<unknown>
) {
  const [showAddTimeline, setShowAddTimeline] = useState(false);
  const [tlEventType, setTlEventType] = useState("OTHER");
  const [tlDescription, setTlDescription] = useState("");
  const [tlOccurredAt, setTlOccurredAt] = useState("");
  const [addingTimeline, setAddingTimeline] = useState(false);

  async function handleAddTimeline(e: FormEvent) {
    e.preventDefault();
    setAddingTimeline(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_timeline",
        eventType: tlEventType,
        description: tlDescription,
        occurredAt: tlOccurredAt || new Date().toISOString(),
      });
      await onRefresh();
      setShowAddTimeline(false);
      setTlEventType("OTHER");
      setTlDescription("");
      setTlOccurredAt("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add timeline event");
    } finally {
      setAddingTimeline(false);
    }
  }

  return {
    showAddTimeline, setShowAddTimeline,
    tlEventType, setTlEventType,
    tlDescription, setTlDescription,
    tlOccurredAt, setTlOccurredAt,
    addingTimeline,
    handleAddTimeline,
  };
}
