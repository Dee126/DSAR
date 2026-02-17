import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createAuthorityExportSchema } from "@/lib/validation";
import { generateAuthorityExport, getExportRun } from "@/lib/authority-export-service";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/incidents/[id]/export — List or download export runs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const { searchParams } = new URL(request.url);
    const exportRunId = searchParams.get("exportRunId");
    const download = searchParams.get("download");

    if (exportRunId && download) {
      // Download export file
      const run = await getExportRun(user.tenantId, exportRunId);
      if (!run) throw new ApiError(404, "Export run not found");

      const storageKey = download === "pdf" ? run.pdfStorageKey : run.zipStorageKey;
      if (!storageKey) throw new ApiError(404, "File not found for this export");

      const storage = getStorage();
      const buffer = await storage.download(storageKey);

      const contentType = download === "pdf" ? "application/pdf" : "text/plain";
      const ext = download === "pdf" ? "pdf" : "txt";

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="authority-pack-${params.id}.${ext}"`,
        },
      });
    }

    if (exportRunId) {
      const run = await getExportRun(user.tenantId, exportRunId);
      if (!run) throw new ApiError(404, "Export run not found");
      return NextResponse.json(run);
    }

    // List all export runs for this incident
    const { prisma } = await import("@/lib/prisma");
    const runs = await prisma.authorityExportRun.findMany({
      where: { tenantId: user.tenantId, incidentId: params.id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(runs);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/incidents/[id]/export — Generate authority pack
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_AUTHORITY_EXPORT");

    const body = await request.json();
    const data = createAuthorityExportSchema.parse(body);

    const result = await generateAuthorityExport(
      user.tenantId,
      params.id,
      user.id,
      data,
    );

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "incident.authority_export_generated",
      entityType: "AuthorityExportRun",
      entityId: result.exportRunId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { incidentId: params.id, options: data },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
