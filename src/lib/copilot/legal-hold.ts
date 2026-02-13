/**
 * Legal Hold Service — Privacy Copilot
 *
 * Implements Litigation Hold / Legal Hold functionality for DSAR cases.
 *
 * When Legal Hold is active on a case:
 *   - Export/download of artifacts is blocked (or requires special freigabe)
 *   - Deletion of artifacts is blocked
 *   - Retention auto-deletion is suspended
 *   - UI must display a warning banner
 *   - AuditEvents are created for enable/disable actions
 *
 * Only DPO/TENANT_ADMIN/SUPER_ADMIN can enable/disable Legal Hold.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LegalHoldState {
  enabled: boolean;
  reason?: string;
  enabledAt?: Date;
  enabledByUserId?: string;
}

export interface LegalHoldCheckResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Legal Hold enforcement
// ---------------------------------------------------------------------------

/**
 * Check whether export is blocked by Legal Hold.
 */
export function checkLegalHoldForExport(
  holdState: LegalHoldState,
): LegalHoldCheckResult {
  if (holdState.enabled) {
    return {
      allowed: false,
      reason: "Export is blocked because a Legal Hold is active on this case. " +
              "Contact the DPO or legal counsel to release the hold or obtain special authorization.",
      code: "LEGAL_HOLD_EXPORT_BLOCKED",
    };
  }
  return { allowed: true };
}

/**
 * Check whether artifact deletion is blocked by Legal Hold.
 */
export function checkLegalHoldForDeletion(
  holdState: LegalHoldState,
): LegalHoldCheckResult {
  if (holdState.enabled) {
    return {
      allowed: false,
      reason: "Artifact deletion is blocked because a Legal Hold is active on this case. " +
              "All data must be preserved until the hold is released.",
      code: "LEGAL_HOLD_DELETION_BLOCKED",
    };
  }
  return { allowed: true };
}

/**
 * Check whether retention auto-deletion should be suspended.
 */
export function isRetentionSuspended(
  holdState: LegalHoldState,
): boolean {
  return holdState.enabled;
}

// ---------------------------------------------------------------------------
// Role checks
// ---------------------------------------------------------------------------

const LEGAL_HOLD_ROLES = new Set(["DPO", "TENANT_ADMIN", "SUPER_ADMIN"]);

/**
 * Check whether a role can enable/disable Legal Hold.
 */
export function canManageLegalHold(role: string): boolean {
  return LEGAL_HOLD_ROLES.has(role);
}

/**
 * Validate a Legal Hold enable request.
 */
export function validateLegalHoldEnable(
  role: string,
  reason: string | null | undefined,
): LegalHoldCheckResult {
  if (!canManageLegalHold(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to manage Legal Hold.`,
      code: "LEGAL_HOLD_ROLE_FORBIDDEN",
    };
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    return {
      allowed: false,
      reason: "A reason of at least 5 characters is required to enable Legal Hold.",
      code: "LEGAL_HOLD_REASON_REQUIRED",
    };
  }

  return { allowed: true };
}

/**
 * Validate a Legal Hold disable request.
 */
export function validateLegalHoldDisable(
  role: string,
): LegalHoldCheckResult {
  if (!canManageLegalHold(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to manage Legal Hold.`,
      code: "LEGAL_HOLD_ROLE_FORBIDDEN",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Get the Legal Hold warning banner text for UI display.
 */
export function getLegalHoldBannerText(holdState: LegalHoldState): string | null {
  if (!holdState.enabled) return null;

  return "⚠ LEGAL HOLD ACTIVE — Export, deletion, and modification of case artifacts " +
         "is restricted. All data must be preserved. Contact DPO or legal counsel for details.";
}
