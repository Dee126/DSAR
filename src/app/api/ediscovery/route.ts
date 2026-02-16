import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { ediscoveryQuerySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientInfo } from "@/lib/audit";

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  category: string;
  title: string;
  description: string;
  actorName?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

function formatCsv(events: TimelineEvent[]): string {
  const headers = ["timestamp", "eventType", "category", "title", "description", "actorName", "entityType", "entityId"];
  const rows = events.map((e) =>
    headers.map((h) => {
      const val = String((e as Record<string, unknown>)[h] ?? "");
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EDISCOVERY_VIEW");

    const url = request.nextUrl;
    const rawInput = {
      caseId: url.searchParams.get("caseId") ?? undefined,
      incidentId: url.searchParams.get("incidentId") ?? undefined,
      eventTypes: url.searchParams.get("eventTypes")?.split(",").filter(Boolean) ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      page: parseInt(url.searchParams.get("page") ?? "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") ?? "50"),
      exportFormat: url.searchParams.get("exportFormat") ?? undefined,
    };

    const input = ediscoveryQuerySchema.parse(rawInput);

    if (!input.caseId && !input.incidentId) {
      throw new ApiError(400, "Either caseId or incidentId is required");
    }

    const timeline: TimelineEvent[] = [];

    // Date range helpers
    const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
    const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;

    if (input.caseId) {
      // Verify case belongs to tenant
      const dsarCase = await prisma.dSARCase.findFirst({
        where: { id: input.caseId, tenantId: user.tenantId },
        include: { dataSubject: true, assignedTo: true },
      });
      if (!dsarCase) throw new ApiError(404, "Case not found");

      // 1. Case creation event
      timeline.push({
        timestamp: dsarCase.createdAt.toISOString(),
        eventType: "CASE_CREATED",
        category: "case",
        title: `Case ${dsarCase.caseNumber} created`,
        description: `${dsarCase.type} request created via ${dsarCase.channel ?? "manual"}`,
        entityType: "DSARCase",
        entityId: dsarCase.id,
        metadata: { type: dsarCase.type, priority: dsarCase.priority },
      });

      // 2. State transitions
      const transitions = await prisma.dSARStateTransition.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      for (const t of transitions) {
        timeline.push({
          timestamp: t.createdAt.toISOString(),
          eventType: "STATUS_CHANGE",
          category: "transition",
          title: `Status: ${t.fromStatus} → ${t.toStatus}`,
          description: t.reason,
          actorName: t.actor?.name,
          entityType: "DSARStateTransition",
          entityId: t.id,
        });
      }

      // 3. Tasks
      const tasks = await prisma.task.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      for (const t of tasks) {
        timeline.push({
          timestamp: t.createdAt.toISOString(),
          eventType: "TASK_CREATED",
          category: "task",
          title: `Task: ${t.title}`,
          description: `Status: ${t.status}${t.assignee ? ` / Assignee: ${t.assignee.name}` : ""}`,
          entityType: "Task",
          entityId: t.id,
        });
      }

      // 4. Documents
      const docs = await prisma.document.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      for (const d of docs) {
        timeline.push({
          timestamp: d.createdAt.toISOString(),
          eventType: "DOCUMENT_UPLOADED",
          category: "document",
          title: `Document: ${d.filename}`,
          description: `${d.mimeType ?? ""} (${d.classification})`,
          actorName: d.uploadedBy?.name,
          entityType: "Document",
          entityId: d.id,
        });
      }

      // 5. Vendor Requests (if any case link)
      const vendorRequests = await prisma.vendorRequest.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        include: { vendor: true },
        orderBy: { createdAt: "asc" },
      });
      for (const vr of vendorRequests) {
        timeline.push({
          timestamp: vr.createdAt.toISOString(),
          eventType: "VENDOR_REQUEST_CREATED",
          category: "vendor",
          title: `Vendor Request: ${vr.vendor?.name ?? "Unknown"}`,
          description: `Status: ${vr.status}`,
          entityType: "VendorRequest",
          entityId: vr.id,
          metadata: { vendorName: vr.vendor?.name, status: vr.status },
        });
      }

      // 6. Vendor Responses
      for (const vr of vendorRequests) {
        const responses = await prisma.vendorResponse.findMany({
          where: { vendorRequestId: vr.id, tenantId: user.tenantId },
          orderBy: { receivedAt: "asc" },
        });
        for (const resp of responses) {
          timeline.push({
            timestamp: resp.receivedAt.toISOString(),
            eventType: "VENDOR_RESPONSE_RECEIVED",
            category: "vendor",
            title: `Vendor Response from ${vr.vendor?.name ?? "Unknown"}`,
            description: `Type: ${resp.responseType}`,
            entityType: "VendorResponse",
            entityId: resp.id,
          });
        }
      }

      // 7. Response Documents
      const respDocs = await prisma.responseDocument.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        orderBy: { createdAt: "asc" },
      });
      for (const rd of respDocs) {
        timeline.push({
          timestamp: rd.createdAt.toISOString(),
          eventType: "RESPONSE_GENERATED",
          category: "response",
          title: `Response Document v${rd.version}`,
          description: `Status: ${rd.status}, Language: ${rd.language}`,
          entityType: "ResponseDocument",
          entityId: rd.id,
        });
      }

      // 8. Delivery Records
      const deliveries = await prisma.deliveryRecord.findMany({
        where: { caseId: input.caseId, tenantId: user.tenantId },
        orderBy: { deliveredAt: "asc" },
      });
      for (const del of deliveries) {
        timeline.push({
          timestamp: del.deliveredAt.toISOString(),
          eventType: "RESPONSE_DELIVERED",
          category: "delivery",
          title: `Delivery via ${del.method}`,
          description: del.notes ?? "",
          entityType: "DeliveryRecord",
          entityId: del.id,
        });
      }

      // 9. Deadline Events
      const deadlineEvents = await prisma.deadlineEvent.findMany({
        where: { tenantId: user.tenantId, deadline: { caseId: input.caseId } },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      for (const de of deadlineEvents) {
        timeline.push({
          timestamp: de.createdAt.toISOString(),
          eventType: `DEADLINE_${de.eventType}`,
          category: "deadline",
          title: `Deadline: ${de.eventType}`,
          description: de.reason ?? "",
          actorName: de.actor?.name,
          entityType: "DeadlineEvent",
          entityId: de.id,
        });
      }

      // 10. Audit Log entries for this case
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          tenantId: user.tenantId,
          entityType: "DSARCase",
          entityId: input.caseId,
        },
        include: { actor: { select: { name: true } } },
        orderBy: { timestamp: "asc" },
      });
      for (const al of auditLogs) {
        timeline.push({
          timestamp: al.timestamp.toISOString(),
          eventType: `AUDIT_${al.action}`,
          category: "audit",
          title: `Audit: ${al.action}`,
          description: `${al.entityType} ${al.entityId ?? ""}`,
          actorName: al.actor?.name,
          entityType: "AuditLog",
          entityId: al.id,
        });
      }
    }

    if (input.incidentId) {
      // Verify incident belongs to tenant
      const incident = await prisma.incident.findFirst({
        where: { id: input.incidentId, tenantId: user.tenantId },
      });
      if (!incident) throw new ApiError(404, "Incident not found");

      timeline.push({
        timestamp: incident.createdAt.toISOString(),
        eventType: "INCIDENT_CREATED",
        category: "incident",
        title: `Incident ${incident.reference}: ${incident.title}`,
        description: incident.description ?? "",
        entityType: "Incident",
        entityId: incident.id,
        metadata: { severity: incident.severity, status: incident.status },
      });

      // Incident timeline events
      const itEvents = await prisma.incidentTimeline.findMany({
        where: { incidentId: input.incidentId, tenantId: user.tenantId },
        include: { actor: { select: { name: true } } },
        orderBy: { timestamp: "asc" },
      });
      for (const it of itEvents) {
        timeline.push({
          timestamp: it.timestamp.toISOString(),
          eventType: `INCIDENT_${it.eventType}`,
          category: "incident_timeline",
          title: `${it.eventType}`,
          description: it.description,
          actorName: it.actor?.name,
          entityType: "IncidentTimeline",
          entityId: it.id,
        });
      }

      // Linked DSARs
      const dsarLinks = await prisma.dsarIncident.findMany({
        where: { incidentId: input.incidentId, tenantId: user.tenantId },
        include: { case: true },
        orderBy: { linkedAt: "asc" },
      });
      for (const dl of dsarLinks) {
        timeline.push({
          timestamp: dl.linkedAt.toISOString(),
          eventType: "DSAR_LINKED",
          category: "linkage",
          title: `DSAR ${dl.case?.caseNumber ?? ""} linked`,
          description: dl.linkReason ?? "",
          entityType: "DsarIncident",
          entityId: dl.id,
        });
      }

      // Authority exports
      const authExports = await prisma.authorityExportRun.findMany({
        where: { incidentId: input.incidentId, tenantId: user.tenantId },
        orderBy: { createdAt: "asc" },
      });
      for (const ae of authExports) {
        timeline.push({
          timestamp: ae.createdAt.toISOString(),
          eventType: "AUTHORITY_EXPORT",
          category: "authority",
          title: `Authority Export`,
          description: `Status: ${ae.status}, Format: ${ae.format}`,
          entityType: "AuthorityExportRun",
          entityId: ae.id,
        });
      }
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Apply date filters
    let filtered = timeline;
    if (dateFrom) {
      filtered = filtered.filter((e) => new Date(e.timestamp) >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((e) => new Date(e.timestamp) <= dateTo);
    }

    // Apply event type filter
    if (input.eventTypes && input.eventTypes.length > 0) {
      filtered = filtered.filter((e) =>
        input.eventTypes!.some((et) => e.eventType.includes(et) || e.category === et)
      );
    }

    // Handle exports
    if (input.exportFormat) {
      enforce(user.role, "EDISCOVERY_EXPORT");

      const { ip, userAgent } = getClientInfo(request);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "EDISCOVERY_EXPORT",
        entityType: input.caseId ? "DSARCase" : "Incident",
        entityId: input.caseId ?? input.incidentId,
        ip,
        userAgent,
        details: { format: input.exportFormat, eventCount: filtered.length },
      });

      if (input.exportFormat === "csv") {
        const csv = formatCsv(filtered);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="ediscovery-timeline-${Date.now()}.csv"`,
          },
        });
      }

      // JSON export
      return new NextResponse(JSON.stringify(filtered, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="ediscovery-timeline-${Date.now()}.json"`,
        },
      });
    }

    // Paginate
    const total = filtered.length;
    const start = (input.page - 1) * input.pageSize;
    const page = filtered.slice(start, start + input.pageSize);

    return NextResponse.json({
      timeline: page,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
      categories: [...new Set(timeline.map((e) => e.category))],
      eventTypes: [...new Set(timeline.map((e) => e.eventType))],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
