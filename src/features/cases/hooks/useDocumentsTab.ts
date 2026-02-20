"use client";

import { useState, FormEvent } from "react";
import type { Document } from "../types";
import * as caseRepo from "../repositories";

/**
 * Hook for Documents tab: upload document, view document.
 */
export function useDocumentsTab(caseId: string, onRefresh: () => Promise<void>) {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docClassification, setDocClassification] = useState("INTERNAL");
  const [uploading, setUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  async function handleUploadDocument(e: FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    try {
      await caseRepo.uploadDocument(caseId, docFile, docClassification);
      setDocFile(null);
      setDocClassification("INTERNAL");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setUploading(false); }
  }

  return {
    docFile, setDocFile,
    docClassification, setDocClassification,
    uploading, handleUploadDocument,
    viewingDoc, setViewingDoc,
  };
}
