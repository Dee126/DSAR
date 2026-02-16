/**
 * Security Policy Engine — Deny-by-Default
 *
 * Central policy evaluation point. Every access decision goes through here.
 * Default: DENY. Only explicit policy grants access.
 *
 * Sprint 9.2: Security Hardening
 */

import { has, type Permission } from "../rbac";
import { ApiError } from "../errors";
import { prisma } from "../prisma";

// ─── Policy Context ──────────────────────────────────────────────────────────

export interface PolicyActor {
  id: string;
  tenantId: string;
  role: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  code: string;
}

const DENY = (reason: string, code: string): PolicyDecision => ({
  allowed: false,
  reason,
  code,
});

const ALLOW: PolicyDecision = {
  allowed: true,
  reason: "granted",
  code: "OK",
};

// ─── Core Policy Checks ──────────────────────────────────────────────────────

/**
 * Check if actor has a specific RBAC permission.
 * Default: DENY.
 */
export function canPerform(actor: PolicyActor, permission: Permission): PolicyDecision {
  if (!actor.role) return DENY("No role assigned", "NO_ROLE");
  if (!has(actor.role, permission)) {
    return DENY(`Missing permission: ${permission}`, "RBAC_DENY");
  }
  return ALLOW;
}

/**
 * Check if actor can read a case.
 * Admins/DPO: all cases in tenant.
 * CaseManager/Analyst: assigned cases or cases they created.
 * Auditor/ReadOnly: all cases (read-only).
 */
export async function canReadCase(
  actor: PolicyActor,
  caseId: string,
): Promise<PolicyDecision> {
  const perm = canPerform(actor, "CASES_READ");
  if (!perm.allowed) return perm;

  // Global access roles: can read any case in tenant
  const globalRoles = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "AUDITOR", "READ_ONLY"];
  if (globalRoles.includes(actor.role)) {
    return ALLOW;
  }

  // For non-global roles, verify case access via assignment or creation
  const dsarCase = await prisma.dSARCase.findFirst({
    where: {
      id: caseId,
      tenantId: actor.tenantId,
      OR: [
        { assignedToUserId: actor.id },
        { createdByUserId: actor.id },
        {
          caseTeamMembers: {
            some: { userId: actor.id },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!dsarCase) {
    return DENY("No access to this case", "CASE_ACCESS_DENY");
  }
  return ALLOW;
}

/**
 * Check if actor can write (update) a case.
 */
export async function canWriteCase(
  actor: PolicyActor,
  caseId: string,
): Promise<PolicyDecision> {
  const perm = canPerform(actor, "CASES_UPDATE");
  if (!perm.allowed) return perm;

  // Read-only roles cannot write
  if (["AUDITOR", "READ_ONLY"].includes(actor.role)) {
    return DENY("Read-only access", "READ_ONLY_DENY");
  }

  // Check case access
  return canReadCase(actor, caseId);
}

/**
 * Check if actor can download/view an artifact.
 * Resolves artifact → case → tenant chain to prevent IDOR.
 */
export async function canDownloadArtifact(
  actor: PolicyActor,
  artifactId: string,
  artifactType: "DOCUMENT" | "IDV_ARTIFACT" | "RESPONSE_DOC" | "VENDOR_ARTIFACT" | "EXPORT_ARTIFACT" | "EVIDENCE",
): Promise<PolicyDecision> {
  const perm = canPerform(actor, "DOCUMENT_DOWNLOAD");
  if (!perm.allowed) return perm;

  // Resolve artifact to case + tenant
  const resolution = await resolveArtifactOwnership(artifactId, artifactType);
  if (!resolution) {
    return DENY("Artifact not found", "ARTIFACT_NOT_FOUND");
  }

  // Tenant isolation: artifact must belong to actor's tenant
  if (resolution.tenantId !== actor.tenantId) {
    return DENY("Artifact not found", "ARTIFACT_NOT_FOUND"); // 404-style, no leakage
  }

  // Check deletion status
  if (resolution.deleted) {
    return DENY("Artifact has been deleted", "ARTIFACT_DELETED");
  }

  // Check case access if artifact is case-scoped
  if (resolution.caseId) {
    const caseAccess = await canReadCase(actor, resolution.caseId);
    if (!caseAccess.allowed) return caseAccess;
  }

  return ALLOW;
}

/**
 * Check if actor can manage governance settings.
 */
export function canManageGovernance(actor: PolicyActor): PolicyDecision {
  return canPerform(actor, "GOVERNANCE_EDIT_SETTINGS");
}

/**
 * Check if actor can create exports.
 */
export function canCreateExports(actor: PolicyActor): PolicyDecision {
  return canPerform(actor, "EXPORT_REQUEST");
}

// ─── Artifact Ownership Resolution ──────────────────────────────────────────

interface ArtifactOwnership {
  tenantId: string;
  caseId: string | null;
  deleted: boolean;
}

async function resolveArtifactOwnership(
  artifactId: string,
  artifactType: string,
): Promise<ArtifactOwnership | null> {
  switch (artifactType) {
    case "DOCUMENT": {
      const doc = await prisma.document.findUnique({
        where: { id: artifactId },
        select: { tenantId: true, caseId: true, deletedAt: true },
      });
      if (!doc) return null;
      return { tenantId: doc.tenantId, caseId: doc.caseId, deleted: !!doc.deletedAt };
    }
    case "IDV_ARTIFACT": {
      const artifact = await prisma.idvArtifact.findUnique({
        where: { id: artifactId },
        select: {
          tenantId: true,
          deletedAt: true,
          request: { select: { caseId: true } },
        },
      });
      if (!artifact) return null;
      return {
        tenantId: artifact.tenantId,
        caseId: artifact.request.caseId,
        deleted: !!artifact.deletedAt,
      };
    }
    case "RESPONSE_DOC": {
      const doc = await prisma.responseDocument.findUnique({
        where: { id: artifactId },
        select: { tenantId: true, caseId: true },
      });
      if (!doc) return null;
      return { tenantId: doc.tenantId, caseId: doc.caseId, deleted: false };
    }
    default:
      return null;
  }
}

// ─── Policy Enforcement Helper ──────────────────────────────────────────────

/**
 * Enforce a policy decision. Throws ApiError if denied.
 * Returns 404 (not 403) to prevent information leakage.
 */
export function enforcePolicy(decision: PolicyDecision): void {
  if (!decision.allowed) {
    // Use 404 for resource-scoped denials to prevent enumeration
    const resourceCodes = ["ARTIFACT_NOT_FOUND", "CASE_ACCESS_DENY", "ARTIFACT_DELETED"];
    const status = resourceCodes.includes(decision.code) ? 404 : 403;
    throw new ApiError(status, decision.reason, undefined, decision.code);
  }
}
