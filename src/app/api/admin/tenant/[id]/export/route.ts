import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { featureFlags } from "@/lib/feature-flags";

/**
 * GET /api/admin/tenant/[id]/export — Export tenant configuration
 *
 * Returns a JSON snapshot of tenant configuration:
 * - Feature flags
 * - SLA configuration
 * - Retention policies
 * - Webhook endpoints (secrets redacted)
 * - Connector configs (secrets redacted)
 *
 * Requires TENANT_ADMIN permission.
 * Only allows export of own tenant.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "TENANT_MANAGE");

    // Only allow exporting own tenant
    if (params.id !== user.tenantId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Can only export own tenant configuration" } },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;

    // Gather all configuration in parallel
    const [
      tenant,
      flags,
      slaConfig,
      retentionPolicies,
      webhookEndpoints,
      connectors,
      idvSettings,
      deliverySettings,
      intakeSettings,
    ] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          slaDefaultDays: true,
          dueSoonDays: true,
          retentionDays: true,
        },
      }),
      featureFlags.getAllForTenant(tenantId),
      prisma.tenantSlaConfig.findUnique({ where: { tenantId } }).catch(() => null),
      prisma.retentionPolicy.findMany({ where: { tenantId } }).catch(() => []),
      prisma.webhookEndpoint.findMany({
        where: { tenantId },
        select: {
          id: true,
          url: true,
          events: true,
          enabled: true,
          createdAt: true,
          // Exclude: secretHash
        },
      }).catch(() => []),
      prisma.connector.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          provider: true,
          type: true,
          enabled: true,
          config: true,
          // Exclude: secrets
        },
      }).catch(() => []),
      prisma.idvSettings.findUnique({ where: { tenantId } }).catch(() => null),
      prisma.deliverySettings.findUnique({ where: { tenantId } }).catch(() => null),
      prisma.tenantIntakeSettings.findUnique({ where: { tenantId } }).catch(() => null),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      version: "1.0",
      tenant: tenant ?? { id: tenantId },
      featureFlags: flags,
      slaConfig,
      retentionPolicies,
      webhookEndpoints: webhookEndpoints.map((w) => ({
        ...w,
        _note: "Secrets redacted for security",
      })),
      connectors: connectors.map((c) => ({
        ...c,
        _note: "Secrets redacted for security",
      })),
      idvSettings,
      deliverySettings,
      intakeSettings,
    };

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="tenant-config-${tenantId.slice(0, 8)}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
