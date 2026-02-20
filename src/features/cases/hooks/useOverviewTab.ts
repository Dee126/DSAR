"use client";

import { useState, FormEvent } from "react";
import type { DSARCaseDetail, CaseUser } from "../types";
import * as caseRepo from "../repositories";

/**
 * Hook for Overview tab: edit case + add comments.
 */
export function useOverviewTab(caseId: string, caseData: DSARCaseDetail | null, onRefresh: () => Promise<void>) {
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editLawfulBasis, setEditLawfulBasis] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  function startEditing() {
    if (!caseData) return;
    setEditDescription(caseData.description ?? "");
    setEditLawfulBasis(caseData.lawfulBasis ?? "");
    setEditPriority(caseData.priority);
    setEditAssignee(caseData.assignedToUserId ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await caseRepo.patchCase(caseId, {
        description: editDescription || undefined,
        lawfulBasis: editLawfulBasis || undefined,
        priority: editPriority,
        assignedToUserId: editAssignee || null,
      });
      setEditing(false);
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setAddingComment(true);
    try {
      await caseRepo.createComment(caseId, commentBody);
      setCommentBody("");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setAddingComment(false); }
  }

  return {
    editing, setEditing, startEditing, handleSaveEdit, saving,
    editDescription, setEditDescription,
    editLawfulBasis, setEditLawfulBasis,
    editPriority, setEditPriority,
    editAssignee, setEditAssignee,
    commentBody, setCommentBody, addingComment, handleAddComment,
  };
}
