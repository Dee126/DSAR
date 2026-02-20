"use client";

import { useState, FormEvent } from "react";
import { postIncidentAction } from "../services";

/**
 * Hook for the Impact & Assessment tab: assessments + regulator records.
 */
export function useImpactTab(
  incidentId: string,
  onRefresh: () => Promise<unknown>
) {
  /* ── Assessment form ── */
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [assessNature, setAssessNature] = useState("");
  const [assessSubjects, setAssessSubjects] = useState("");
  const [assessRecords, setAssessRecords] = useState("");
  const [assessConsequences, setAssessConsequences] = useState("");
  const [assessMeasures, setAssessMeasures] = useState("");
  const [assessDpoContact, setAssessDpoContact] = useState("");
  const [assessNotes, setAssessNotes] = useState("");
  const [addingAssessment, setAddingAssessment] = useState(false);

  /* ── Regulator record form ── */
  const [showAddRegulator, setShowAddRegulator] = useState(false);
  const [regAuthorityName, setRegAuthorityName] = useState("");
  const [regReferenceNumber, setRegReferenceNumber] = useState("");
  const [regStatus, setRegStatus] = useState("DRAFT");
  const [regNotes, setRegNotes] = useState("");
  const [addingRegulator, setAddingRegulator] = useState(false);

  async function handleAddAssessment(e: FormEvent) {
    e.preventDefault();
    setAddingAssessment(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_assessment",
        natureOfBreach: assessNature || null,
        categoriesAndApproxSubjects: assessSubjects || null,
        categoriesAndApproxRecords: assessRecords || null,
        likelyConsequences: assessConsequences || null,
        measuresTakenOrProposed: assessMeasures || null,
        dpoContactDetails: assessDpoContact || null,
        additionalNotes: assessNotes || null,
      });
      await onRefresh();
      setShowAddAssessment(false);
      setAssessNature("");
      setAssessSubjects("");
      setAssessRecords("");
      setAssessConsequences("");
      setAssessMeasures("");
      setAssessDpoContact("");
      setAssessNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add assessment");
    } finally {
      setAddingAssessment(false);
    }
  }

  async function handleAddRegulator(e: FormEvent) {
    e.preventDefault();
    setAddingRegulator(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_regulator",
        authorityName: regAuthorityName,
        referenceNumber: regReferenceNumber || null,
        status: regStatus,
        notes: regNotes || null,
      });
      await onRefresh();
      setShowAddRegulator(false);
      setRegAuthorityName("");
      setRegReferenceNumber("");
      setRegStatus("DRAFT");
      setRegNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add regulator record");
    } finally {
      setAddingRegulator(false);
    }
  }

  return {
    showAddAssessment, setShowAddAssessment,
    assessNature, setAssessNature,
    assessSubjects, setAssessSubjects,
    assessRecords, setAssessRecords,
    assessConsequences, setAssessConsequences,
    assessMeasures, setAssessMeasures,
    assessDpoContact, setAssessDpoContact,
    assessNotes, setAssessNotes,
    addingAssessment,
    handleAddAssessment,
    showAddRegulator, setShowAddRegulator,
    regAuthorityName, setRegAuthorityName,
    regReferenceNumber, setRegReferenceNumber,
    regStatus, setRegStatus,
    regNotes, setRegNotes,
    addingRegulator,
    handleAddRegulator,
  };
}
