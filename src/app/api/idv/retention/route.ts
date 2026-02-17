import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

/**
 * POST /api/idv/retention — Run retention cleanup for IDV artifacts
 *
 * Deletes artifacts that:
 *   1. Have a retainUntil date in the past
 *   2. Belong to an IDV request that has been decided (APPROVED or REJECTED)
 *   3. Haven't been deleted yet
 *
 * This is a manual trigger endpoint (can also be called by a cron job).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_SETTINGS_EDIT"); // Only admins/DPOs can trigger retention
    const clientInfo = getClientInfo(request);

    const now = new Date();

    // Find artifacts eligible for deletion
    const expiredArtifacts = await prisma.idvArtifact.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        retainUntil: { lte: now },
        request: {
          status: { in: ["APPROVED", "REJECTED"] },
        },
      },
    });

    if (expiredArtifacts.length === 0) {
      return NextResponse.json({ deleted: 0, message: "No artifacts eligible for deletion" });
    }

    const storage = getStorage();
    let deletedCount = 0;
    const errors: string[] = [];

    for (const artifact of expiredArtifacts) {
      try {
        // Delete from storage
        await storage.delete(artifact.storageKey);

        // Mark as deleted in DB (soft delete)
        await prisma.idvArtifact.update({
          where: { id: artifact.id },
          data: { deletedAt: now },
        });

        deletedCount++;
      } catch (err) {
        errors.push(`Failed to delete artifact ${artifact.id}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "idv.retention_cleanup",
      entityType: "IdvArtifact",
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        totalEligible: expiredArtifacts.length,
        deleted: deletedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return NextResponse.json({
      deleted: deletedCount,
      eligible: expiredArtifacts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
