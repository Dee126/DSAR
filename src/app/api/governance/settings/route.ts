export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  DEFAULT_GOVERNANCE_SETTINGS,
  enforceSettingsPermission,
} from "@/lib/copilot/governance";
import type { GovernanceSettings } from "@/lib/copilot/governance";
import {
  validateSettingsUpdate,
  computeSettingsChanges,
  applySettingsUpdate,
  canModifySettings,
} from "@/lib/copilot/governance-settings";
import type { GovernanceSettingsUpdate } from "@/lib/copilot/governance-settings";

/**
 * In-memory settings store (per tenant).
 * In production this would be stored in the database via CopilotGovernanceSettings model.
 */
const tenantSettingsStore = new Map<string, GovernanceSettings>();

function getSettings(tenantId: string): GovernanceSettings {
  return tenantSettingsStore.get(tenantId) ?? { ...DEFAULT_GOVERNANCE_SETTINGS };
}

/**
 * GET /api/governance/settings
 * Returns the current governance settings for the tenant.
 * DPO/Admin can see all fields, Case Managers see read-only subset.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot_governance", "read");

    const settings = getSettings(user.tenantId);
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/governance/settings
 * Update governance settings. Only DPO/TENANT_ADMIN/SUPER_ADMIN.
 * All changes are audit-logged.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Enforce settings permission (DPO/Admin only)
    const permCheck = enforceSettingsPermission(user.role);
    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: permCheck.reason, code: permCheck.code },
        { status: 403 },
      );
    }

    const body = await request.json();
    const update = body as GovernanceSettingsUpdate;

    // Validate
    const validationError = validateSettingsUpdate(update);
    if (validationError) {
      return NextResponse.json(
        { error: validationError, code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const current = getSettings(user.tenantId);
    const changes = computeSettingsChanges(current, update);

    if (changes.length === 0) {
      return NextResponse.json(current);
    }

    // Apply update
    const updated = applySettingsUpdate(current, update);
    tenantSettingsStore.set(user.tenantId, updated);

    // Audit log each change
    const clientInfo = getClientInfo(request);
    await logAudit({
      action: "GOVERNANCE_SETTINGS_UPDATED",
      actorUserId: user.id,
      tenantId: user.tenantId,
      entityType: "GovernanceSettings",
      details: {
        changes,
        changedBy: user.name,
        role: user.role,
      },
      ...clientInfo,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
