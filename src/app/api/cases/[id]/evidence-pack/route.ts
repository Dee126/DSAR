export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { PassThrough } from "stream";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/cases/[id]/evidence-pack
 *
 * Generates a ZIP "evidence pack" of all INCLUDED data asset items for a case.
 * For MVP this contains:
 *   - cover-sheet.html (case metadata + data subject info)
 *   - included-items.json (all INCLUDED DsarCaseItem records)
 *   - items-summary.csv
 *   - per-item metadata files
 *
 * TODO: Replace mock file stubs with real connector exports (pull actual
 * files from M365, Google Workspace, Salesforce, etc.) when connectors
 * are implemented. See src/lib/integrations/ for connector stubs.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "export", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { dataSubject: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });

    // Fetch INCLUDED items only
    const includedItems = await prisma.dsarCaseItem.findMany({
      where: {
        caseId: params.id,
        tenantId: user.tenantId,
        decision: "INCLUDED",
      },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { matchScore: "desc" },
    });

    // Fetch all items for summary
    const allItems = await prisma.dsarCaseItem.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      select: { decision: true },
    });

    const stats = {
      total: allItems.length,
      included: allItems.filter((i) => i.decision === "INCLUDED").length,
      excluded: allItems.filter((i) => i.decision === "EXCLUDED").length,
      proposed: allItems.filter((i) => i.decision === "PROPOSED").length,
    };

    // Fetch audit events
    const auditEvents = await prisma.dsarAuditEvent.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Build ZIP
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // ── Cover sheet HTML ─────────────────────────────────────────────
    const coverHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Evidence Pack - ${dsarCase.caseNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
    h1 { color: #1a365d; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    .meta { background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .meta dt { font-weight: bold; color: #555; }
    .meta dd { margin: 0 0 10px 0; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; }
    .badge-included { background: #dcfce7; color: #166534; }
    .badge-excluded { background: #fee2e2; color: #991b1b; }
    .badge-proposed { background: #e0e7ff; color: #3730a3; }
  </style>
</head>
<body>
  <h1>DSAR Evidence Pack</h1>
  <p>Generated: ${today}</p>

  <div class="meta">
    <dl>
      <dt>Case Number</dt><dd>${dsarCase.caseNumber}</dd>
      <dt>Request Type</dt><dd>${dsarCase.type}</dd>
      <dt>Status</dt><dd>${dsarCase.status}</dd>
      <dt>Data Subject</dt><dd>${dsarCase.dataSubject.fullName}</dd>
      <dt>Email</dt><dd>${dsarCase.dataSubject.email ?? "N/A"}</dd>
      <dt>Received</dt><dd>${new Date(dsarCase.receivedAt).toLocaleDateString()}</dd>
      <dt>Due Date</dt><dd>${new Date(dsarCase.dueDate).toLocaleDateString()}</dd>
      <dt>Organization</dt><dd>${tenant?.name ?? "N/A"}</dd>
    </dl>
  </div>

  <h2>Data Asset Summary</h2>
  <table>
    <tr><th>Category</th><th>Count</th></tr>
    <tr><td>Total Items Scanned</td><td>${stats.total}</td></tr>
    <tr><td><span class="badge badge-included">Included</span></td><td>${stats.included}</td></tr>
    <tr><td><span class="badge badge-excluded">Excluded</span></td><td>${stats.excluded}</td></tr>
    <tr><td><span class="badge badge-proposed">Pending Review</span></td><td>${stats.proposed}</td></tr>
  </table>

  <h2>Included Data Assets (${includedItems.length})</h2>
  <table>
    <tr><th>#</th><th>Title</th><th>Type</th><th>Location</th><th>Category</th><th>Risk</th><th>Decided By</th></tr>
    ${includedItems
      .map(
        (item, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${item.title}</td>
            <td>${item.assetType}</td>
            <td>${item.location ?? "N/A"}</td>
            <td>${item.dataCategory ?? "N/A"}</td>
            <td>${item.riskScore ?? "N/A"}</td>
            <td>${item.decidedBy?.name ?? "N/A"}</td>
          </tr>`
      )
      .join("")}
  </table>

  <h2>Audit Trail</h2>
  <table>
    <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Details</th></tr>
    ${auditEvents
      .map(
        (ev) =>
          `<tr>
            <td>${new Date(ev.createdAt).toLocaleString()}</td>
            <td>${ev.actor?.name ?? "System"}</td>
            <td>${ev.action}</td>
            <td>${JSON.stringify(ev.details ?? {}).slice(0, 200)}</td>
          </tr>`
      )
      .join("")}
  </table>

  <div class="footer">
    <p>This evidence pack was generated by PrivacyPilot DSAR Management Platform.</p>
    <p>Case: ${dsarCase.caseNumber} | Generated: ${today}</p>
    <p><em>Note: Actual file contents from source systems are not yet included in this MVP
    export. When production connectors are enabled, real documents (emails, files, records)
    will be pulled from each integrated system and included here.</em></p>
  </div>
</body>
</html>`;
    archive.append(coverHTML, { name: "cover-sheet.html" });

    // ── JSON data ────────────────────────────────────────────────────
    archive.append(JSON.stringify(includedItems, null, 2), {
      name: "included-items.json",
    });
    archive.append(JSON.stringify(auditEvents, null, 2), {
      name: "audit-trail.json",
    });

    // ── CSV summary ──────────────────────────────────────────────────
    const csvHeader = "Title,Type,Location,Category,Risk Score,Decision,Reason,Decided By,Decided At";
    const csvRows = includedItems.map((item) =>
      [
        escapeCSV(item.title),
        escapeCSV(item.assetType),
        escapeCSV(item.location),
        escapeCSV(item.dataCategory),
        item.riskScore?.toString() ?? "",
        item.decision,
        escapeCSV(item.decisionReason),
        escapeCSV(item.decidedBy?.name),
        item.decidedAt ? new Date(item.decidedAt).toISOString() : "",
      ].join(",")
    );
    archive.append([csvHeader, ...csvRows].join("\n"), {
      name: "included-items.csv",
    });

    // ── Per-item stub files ──────────────────────────────────────────
    // TODO: When connectors are live, fetch actual content from source systems
    // and include real documents/exports here instead of stub files.
    for (const item of includedItems) {
      const stub = [
        `Data Asset: ${item.title}`,
        `Type: ${item.assetType}`,
        `Location: ${item.location ?? "N/A"}`,
        `Category: ${item.dataCategory ?? "N/A"}`,
        `Risk Score: ${item.riskScore ?? "N/A"}`,
        `Match Score: ${item.matchScore ?? "N/A"}`,
        "",
        "--- PLACEHOLDER ---",
        "This is a stub file. When real connectors are enabled, this file",
        "will contain the actual exported data from the source system.",
        "",
        "TODO: Implement real data export via:",
        "  - Microsoft Graph API (for M365 / Exchange / SharePoint)",
        "  - Google Workspace APIs (for Gmail / Drive)",
        "  - Salesforce REST API",
        "  - Other integrated system APIs",
        "",
        `Generated: ${new Date().toISOString()}`,
      ].join("\n");

      const safeName = item.title
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 60);
      archive.append(stub, {
        name: `items/${item.assetType}-${safeName}.txt`,
      });
    }

    await archive.finalize();

    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Audit
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.evidence_pack_exported",
      entityType: "DSARCase",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: dsarCase.caseNumber,
        includedItems: includedItems.length,
        archiveSizeBytes: buffer.length,
      },
    });

    await prisma.dsarAuditEvent.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        actorUserId: user.id,
        action: "export.evidence_pack",
        details: {
          includedItems: includedItems.length,
          archiveSizeBytes: buffer.length,
        },
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${dsarCase.caseNumber}-evidence-pack.zip"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
