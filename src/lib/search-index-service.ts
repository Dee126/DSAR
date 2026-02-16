import { prisma } from "./prisma";
import { SearchEntityType, Prisma } from "@prisma/client";

// ─── Email masking for data minimization ────────────────────────────────────

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.substring(0, at);
  const domain = email.substring(at);
  const visible = local.length <= 2 ? local[0] : local.substring(0, 2);
  return `${visible}***${domain}`;
}

// ─── Content extraction per entity type ─────────────────────────────────────

interface IndexPayload {
  title: string;
  bodyText: string;
  tags: string[];
  metadataJson: Record<string, unknown>;
}

async function extractCase(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const c = await prisma.dSARCase.findFirst({
    where: { id: entityId, tenantId },
    include: { dataSubject: true, assignedTo: true },
  });
  if (!c) return null;
  const subjectEmail = c.dataSubject?.email ? maskEmail(c.dataSubject.email) : "";
  const subjectName = c.dataSubject?.fullName ?? "";
  return {
    title: `${c.caseNumber} - ${c.type} request`,
    bodyText: [
      c.description ?? "",
      subjectName,
      subjectEmail,
      c.channel ?? "",
      c.requesterType ?? "",
      c.lawfulBasis ?? "",
    ].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      status: c.status,
      priority: c.priority,
      type: c.type,
      caseNumber: c.caseNumber,
      assignedTo: c.assignedTo?.name ?? null,
      assignedToUserId: c.assignedToUserId,
      dueDate: c.dueDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      subjectName,
    },
  };
}

async function extractIncident(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const i = await prisma.incident.findFirst({
    where: { id: entityId, tenantId },
  });
  if (!i) return null;
  return {
    title: `${i.reference} - ${i.title}`,
    bodyText: [i.description ?? "", i.category ?? ""].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      status: i.status,
      severity: i.severity,
      category: i.category,
      reference: i.reference,
      createdAt: i.createdAt.toISOString(),
      notifiable: i.notifiable,
    },
  };
}

async function extractVendorRequest(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const vr = await prisma.vendorRequest.findFirst({
    where: { id: entityId, tenantId },
    include: { vendor: true, case: true },
  });
  if (!vr) return null;
  return {
    title: `Vendor Request: ${vr.vendor?.name ?? "Unknown"} (${vr.case?.caseNumber ?? ""})`,
    bodyText: [vr.notes ?? "", vr.vendor?.name ?? ""].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      status: vr.status,
      vendorName: vr.vendor?.name,
      vendorId: vr.vendorId,
      caseId: vr.caseId,
      caseNumber: vr.case?.caseNumber,
      dueDate: vr.dueDate?.toISOString() ?? null,
      sentAt: vr.sentAt?.toISOString() ?? null,
      createdAt: vr.createdAt.toISOString(),
    },
  };
}

async function extractDocument(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const d = await prisma.document.findFirst({
    where: { id: entityId, tenantId },
    include: { case: true },
  });
  if (!d) return null;
  return {
    title: d.filename,
    bodyText: [d.filename, d.mimeType ?? ""].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      classification: d.classification,
      mimeType: d.mimeType,
      caseId: d.caseId,
      caseNumber: d.case?.caseNumber,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt.toISOString(),
    },
  };
}

async function extractSystem(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const s = await prisma.system.findFirst({
    where: { id: entityId, tenantId },
    include: { ownerUser: true },
  });
  if (!s) return null;
  return {
    title: s.name,
    bodyText: [
      s.description ?? "",
      s.notes ?? "",
      s.contactEmail ? maskEmail(s.contactEmail) : "",
    ].filter(Boolean).join(" "),
    tags: s.tags,
    metadataJson: {
      criticality: s.criticality,
      systemStatus: s.systemStatus,
      ownerUserId: s.ownerUserId,
      ownerName: s.ownerUser?.name ?? null,
      inScopeForDsar: s.inScopeForDsar,
      automationReadiness: s.automationReadiness,
      containsSpecialCategories: s.containsSpecialCategories,
      createdAt: s.createdAt.toISOString(),
    },
  };
}

async function extractIntake(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const i = await prisma.intakeSubmission.findFirst({
    where: { id: entityId, tenantId },
  });
  if (!i) return null;
  const subjectEmail = i.subjectEmail ? maskEmail(i.subjectEmail) : "";
  return {
    title: `Intake ${i.reference} - ${i.subjectName ?? "Unknown"}`,
    bodyText: [
      i.description ?? "",
      i.subjectName ?? "",
      subjectEmail,
      i.channel,
    ].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      status: i.status,
      channel: i.channel,
      requestTypes: i.requestTypes,
      reference: i.reference,
      caseId: i.caseId,
      createdAt: i.createdAt.toISOString(),
    },
  };
}

async function extractResponse(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const r = await prisma.responseDocument.findFirst({
    where: { id: entityId, tenantId },
    include: { case: true },
  });
  if (!r) return null;
  return {
    title: `Response for ${r.case?.caseNumber ?? "case"}`,
    bodyText: [r.language ?? "", r.case?.caseNumber ?? ""].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      status: r.status,
      caseId: r.caseId,
      caseNumber: r.case?.caseNumber,
      language: r.language,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
    },
  };
}

async function extractAudit(entityId: string, tenantId: string): Promise<IndexPayload | null> {
  const a = await prisma.auditLog.findFirst({
    where: { id: entityId, tenantId },
    include: { actor: true },
  });
  if (!a) return null;
  return {
    title: `${a.action} on ${a.entityType}`,
    bodyText: [a.action, a.entityType, a.entityId ?? "", a.actor?.name ?? ""].filter(Boolean).join(" "),
    tags: [],
    metadataJson: {
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actorName: a.actor?.name ?? null,
      actorUserId: a.actorUserId,
      timestamp: a.timestamp.toISOString(),
    },
  };
}

// ─── Extraction router ──────────────────────────────────────────────────────

const EXTRACTORS: Record<SearchEntityType, (id: string, tid: string) => Promise<IndexPayload | null>> = {
  CASE: extractCase,
  INCIDENT: extractIncident,
  VENDOR_REQUEST: extractVendorRequest,
  DOCUMENT: extractDocument,
  SYSTEM: extractSystem,
  INTAKE: extractIntake,
  RESPONSE: extractResponse,
  AUDIT: extractAudit,
};

// ─── Public API ─────────────────────────────────────────────────────────────

export async function upsertIndexEntry(
  entityType: SearchEntityType,
  entityId: string,
  tenantId: string
): Promise<void> {
  const extract = EXTRACTORS[entityType];
  if (!extract) return;

  const payload = await extract(entityId, tenantId);
  if (!payload) {
    // Entity was deleted or not found – remove from index
    await removeIndexEntry(entityType, entityId, tenantId);
    return;
  }

  await prisma.searchIndexEntry.upsert({
    where: {
      tenantId_entityType_entityId: { tenantId, entityType, entityId },
    },
    create: {
      tenantId,
      entityType,
      entityId,
      title: payload.title,
      bodyText: payload.bodyText,
      tags: payload.tags,
      metadataJson: payload.metadataJson as Prisma.JsonObject,
    },
    update: {
      title: payload.title,
      bodyText: payload.bodyText,
      tags: payload.tags,
      metadataJson: payload.metadataJson as Prisma.JsonObject,
    },
  });
}

export async function removeIndexEntry(
  entityType: SearchEntityType,
  entityId: string,
  tenantId: string
): Promise<void> {
  await prisma.searchIndexEntry.deleteMany({
    where: { tenantId, entityType, entityId },
  });
}

export async function rebuildIndexForTenant(tenantId: string): Promise<{ indexed: number }> {
  // Delete all existing entries for this tenant
  await prisma.searchIndexEntry.deleteMany({ where: { tenantId } });

  let indexed = 0;

  // Cases
  const cases = await prisma.dSARCase.findMany({ where: { tenantId }, select: { id: true } });
  for (const c of cases) {
    await upsertIndexEntry("CASE", c.id, tenantId);
    indexed++;
  }

  // Incidents
  const incidents = await prisma.incident.findMany({ where: { tenantId }, select: { id: true } });
  for (const i of incidents) {
    await upsertIndexEntry("INCIDENT", i.id, tenantId);
    indexed++;
  }

  // Vendor Requests
  const vendorRequests = await prisma.vendorRequest.findMany({ where: { tenantId }, select: { id: true } });
  for (const vr of vendorRequests) {
    await upsertIndexEntry("VENDOR_REQUEST", vr.id, tenantId);
    indexed++;
  }

  // Documents
  const documents = await prisma.document.findMany({ where: { tenantId }, select: { id: true } });
  for (const d of documents) {
    await upsertIndexEntry("DOCUMENT", d.id, tenantId);
    indexed++;
  }

  // Systems
  const systems = await prisma.system.findMany({ where: { tenantId }, select: { id: true } });
  for (const s of systems) {
    await upsertIndexEntry("SYSTEM", s.id, tenantId);
    indexed++;
  }

  // Intake Submissions
  const intakes = await prisma.intakeSubmission.findMany({ where: { tenantId }, select: { id: true } });
  for (const i of intakes) {
    await upsertIndexEntry("INTAKE", i.id, tenantId);
    indexed++;
  }

  // Response Documents
  const responses = await prisma.responseDocument.findMany({ where: { tenantId }, select: { id: true } });
  for (const r of responses) {
    await upsertIndexEntry("RESPONSE", r.id, tenantId);
    indexed++;
  }

  // Audit Logs (limited to last 1000 for performance)
  const audits = await prisma.auditLog.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { timestamp: "desc" },
    take: 1000,
  });
  for (const a of audits) {
    await upsertIndexEntry("AUDIT", a.id, tenantId);
    indexed++;
  }

  return { indexed };
}

// ─── Deep link URL generation ───────────────────────────────────────────────

export function getDeepLink(entityType: SearchEntityType, entityId: string, metadata?: Record<string, unknown>): string {
  switch (entityType) {
    case "CASE":
      return `/cases/${entityId}`;
    case "INCIDENT":
      return `/governance/incidents?id=${entityId}`;
    case "VENDOR_REQUEST":
      return metadata?.caseId ? `/cases/${metadata.caseId}?tab=vendors` : `/governance/vendors`;
    case "DOCUMENT":
      return metadata?.caseId ? `/cases/${metadata.caseId}?tab=documents` : `/documents`;
    case "SYSTEM":
      return `/data-inventory/${entityId}`;
    case "INTAKE":
      return `/intake?id=${entityId}`;
    case "RESPONSE":
      return metadata?.caseId ? `/cases/${metadata.caseId}?tab=response` : `/documents`;
    case "AUDIT":
      return `/governance/assurance?tab=audit`;
    default:
      return "/search";
  }
}
