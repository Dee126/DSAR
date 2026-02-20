"use client";

import { useState, FormEvent } from "react";
import * as caseRepo from "../repositories";

/**
 * Hook for Legal Review tab: create reviews, update status.
 */
export function useLegalReviewTab(caseId: string, onRefresh: () => Promise<void>) {
  const [lrIssues, setLrIssues] = useState("");
  const [lrNotes, setLrNotes] = useState("");
  const [addingLr, setAddingLr] = useState(false);

  async function handleAddLegalReview(e: FormEvent) {
    e.preventDefault();
    setAddingLr(true);
    try {
      await caseRepo.createLegalReview(caseId, {
        issues: lrIssues || undefined,
        notes: lrNotes || undefined,
      });
      setLrIssues("");
      setLrNotes("");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setAddingLr(false); }
  }

  async function handleUpdateLrStatus(reviewId: string, status: string) {
    await caseRepo.updateLegalReviewStatus(caseId, reviewId, status);
    await onRefresh();
  }

  return {
    lrIssues, setLrIssues,
    lrNotes, setLrNotes,
    addingLr, handleAddLegalReview, handleUpdateLrStatus,
  };
}
