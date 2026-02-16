import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { listDeletionEvents, exportDeletionEventsCSV } from "@/lib/retention-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_DELETION_VIEW");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    // CSV export
    if (format === "csv") {
      enforce(user.role, "ASSURANCE_DELETION_EXPORT");
      const jobId = searchParams.get("jobId") || undefined;
      const csv = await exportDeletionEventsCSV(user.tenantId, jobId);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="deletion-proof-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON list
    const result = await listDeletionEvents(user.tenantId, {
      jobId: searchParams.get("jobId") || undefined,
      artifactType: searchParams.get("artifactType") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
