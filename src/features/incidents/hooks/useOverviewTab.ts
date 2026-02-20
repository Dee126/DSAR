"use client";

import { useState, FormEvent } from "react";
import type { Incident } from "../types";
import { updateIncident, postIncidentAction } from "../services";

/**
 * Hook for the Overview tab: editing + contacts.
 */
export function useOverviewTab(
  incidentId: string,
  incident: Incident | null,
  onRefresh: () => Promise<unknown>
) {
  /* ── Editing state ── */
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeverity, setEditSeverity] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Contact form state ── */
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  function initEditFields(inc: Incident) {
    setEditTitle(inc.title);
    setEditDescription(inc.description ?? "");
    setEditSeverity(inc.severity);
    setEditStatus(inc.status);
  }

  // Sync fields when incident loads
  if (incident && !editing && editTitle === "" && incident.title !== "") {
    initEditFields(incident);
  }

  async function handleSaveOverview(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateIncident(incidentId, {
        title: editTitle,
        description: editDescription || null,
        severity: editSeverity,
        status: editStatus,
      });
      await onRefresh();
      setEditing(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditing(false);
    if (incident) initEditFields(incident);
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    setAddingContact(true);
    try {
      await postIncidentAction(incidentId, {
        action: "add_contact",
        name: contactName,
        role: contactRole,
        email: contactEmail || null,
        phone: contactPhone || null,
      });
      await onRefresh();
      setShowAddContact(false);
      setContactName("");
      setContactRole("");
      setContactEmail("");
      setContactPhone("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  }

  return {
    editing, setEditing,
    editTitle, setEditTitle,
    editDescription, setEditDescription,
    editSeverity, setEditSeverity,
    editStatus, setEditStatus,
    saving,
    handleSaveOverview,
    handleCancelEdit,
    showAddContact, setShowAddContact,
    contactName, setContactName,
    contactRole, setContactRole,
    contactEmail, setContactEmail,
    contactPhone, setContactPhone,
    addingContact,
    handleAddContact,
  };
}
