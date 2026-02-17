/**
 * Governance Settings Service — Privacy Copilot
 *
 * Manages tenant-level governance settings for the Copilot.
 * Only DPO/TENANT_ADMIN/SUPER_ADMIN can modify settings.
 * All changes produce AuditEvents.
 *
 * Settings control:
 *   - Global Copilot enable/disable
 *   - Allowed provider phases
 *   - Content scanning, OCR, LLM permissions
 *   - Rate limits (per-user, per-tenant, concurrency)
 *   - Evidence item limits, content scan byte limits
 *   - Artifact retention, due-soon window
 *   - Two-person export approval
 *   - Justification requirement
 */

import type { GovernanceSettings } from "./governance";
import { DEFAULT_GOVERNANCE_SETTINGS, enforceSettingsPermission } from "./governance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovernanceSettingsUpdate {
  copilotEnabled?: boolean;
  allowedProviderPhases?: number[];
  defaultExecutionMode?: string;
  allowContentScanning?: boolean;
  allowOcr?: boolean;
  allowLlmSummaries?: boolean;
  maxRunsPerDayTenant?: number;
  maxRunsPerDayUser?: number;
  maxEvidenceItemsPerRun?: number;
  maxContentScanBytes?: number;
  maxConcurrentRuns?: number;
  dueSoonWindowDays?: number;
  artifactRetentionDays?: number;
  twoPersonApprovalForExport?: boolean;
  requireJustification?: boolean;
  requireConfirmation?: boolean;
}

export interface GovernanceSettingsChangeLog {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_EXECUTION_MODES = ["METADATA_ONLY", "CONTENT_SCAN", "FULL_CONTENT"];
const VALID_PROVIDER_PHASES = [1, 2, 3, 4];

/**
 * Validate a governance settings update.
 * Returns an error message or null if valid.
 */
export function validateSettingsUpdate(
  update: GovernanceSettingsUpdate,
): string | null {
  if (update.defaultExecutionMode !== undefined) {
    if (!VALID_EXECUTION_MODES.includes(update.defaultExecutionMode)) {
      return `Invalid execution mode: ${update.defaultExecutionMode}. Must be one of: ${VALID_EXECUTION_MODES.join(", ")}`;
    }
  }

  if (update.allowedProviderPhases !== undefined) {
    if (!Array.isArray(update.allowedProviderPhases)) {
      return "allowedProviderPhases must be an array";
    }
    for (const phase of update.allowedProviderPhases) {
      if (!VALID_PROVIDER_PHASES.includes(phase)) {
        return `Invalid provider phase: ${phase}. Must be one of: ${VALID_PROVIDER_PHASES.join(", ")}`;
      }
    }
  }

  if (update.maxRunsPerDayTenant !== undefined) {
    if (update.maxRunsPerDayTenant < 1 || update.maxRunsPerDayTenant > 10000) {
      return "maxRunsPerDayTenant must be between 1 and 10000";
    }
  }

  if (update.maxRunsPerDayUser !== undefined) {
    if (update.maxRunsPerDayUser < 1 || update.maxRunsPerDayUser > 1000) {
      return "maxRunsPerDayUser must be between 1 and 1000";
    }
  }

  if (update.maxConcurrentRuns !== undefined) {
    if (update.maxConcurrentRuns < 1 || update.maxConcurrentRuns > 50) {
      return "maxConcurrentRuns must be between 1 and 50";
    }
  }

  if (update.maxEvidenceItemsPerRun !== undefined) {
    if (update.maxEvidenceItemsPerRun < 1 || update.maxEvidenceItemsPerRun > 100000) {
      return "maxEvidenceItemsPerRun must be between 1 and 100000";
    }
  }

  if (update.maxContentScanBytes !== undefined) {
    if (update.maxContentScanBytes < 1024 || update.maxContentScanBytes > 10_000_000) {
      return "maxContentScanBytes must be between 1024 and 10000000";
    }
  }

  if (update.artifactRetentionDays !== undefined) {
    if (update.artifactRetentionDays < 1 || update.artifactRetentionDays > 3650) {
      return "artifactRetentionDays must be between 1 and 3650";
    }
  }

  if (update.dueSoonWindowDays !== undefined) {
    if (update.dueSoonWindowDays < 1 || update.dueSoonWindowDays > 365) {
      return "dueSoonWindowDays must be between 1 and 365";
    }
  }

  return null;
}

/**
 * Compute a change log between current and new settings values.
 */
export function computeSettingsChanges(
  current: GovernanceSettings,
  update: GovernanceSettingsUpdate,
): GovernanceSettingsChangeLog[] {
  const changes: GovernanceSettingsChangeLog[] = [];
  const keys = Object.keys(update) as (keyof GovernanceSettingsUpdate)[];

  for (const key of keys) {
    if (update[key] === undefined) continue;

    const currentValue = current[key as keyof GovernanceSettings];
    const newValue = update[key];

    // Deep comparison for arrays
    const currentStr = JSON.stringify(currentValue);
    const newStr = JSON.stringify(newValue);

    if (currentStr !== newStr) {
      changes.push({
        field: key,
        oldValue: currentValue,
        newValue: newValue,
      });
    }
  }

  return changes;
}

/**
 * Apply an update to a settings object (pure function).
 */
export function applySettingsUpdate(
  current: GovernanceSettings,
  update: GovernanceSettingsUpdate,
): GovernanceSettings {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(update).filter(([, v]) => v !== undefined),
    ),
  } as GovernanceSettings;
}

/**
 * Check whether a role can modify governance settings.
 */
export function canModifySettings(role: string): boolean {
  return enforceSettingsPermission(role).allowed;
}

/**
 * Get default governance settings.
 */
export function getDefaultSettings(): GovernanceSettings {
  return { ...DEFAULT_GOVERNANCE_SETTINGS };
}
