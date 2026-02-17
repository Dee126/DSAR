/**
 * Vendor Derivation Service
 *
 * Derives which vendors/processors are implicated for a DSAR case
 * based on the case's linked systems and each system's SystemProcessor records.
 *
 * Multi-tenant safe: all operations scoped by tenantId.
 */

import { prisma } from "./prisma";

export interface DerivedVendor {
  vendorId: string | null;
  vendorName: string;
  systemId: string;
  systemName: string;
  processorRole: string;
  contactEmail: string | null;
  dpaOnFile: boolean;
}

/**
 * Derive all vendors implicated by a DSAR case.
 *
 * 1. Get all CaseSystemLinks for the case.
 * 2. For each system, fetch SystemProcessor records.
 * 3. Return a deduplicated list of vendor involvement.
 */
export async function deriveVendorsForCase(
  tenantId: string,
  caseId: string,
): Promise<DerivedVendor[]> {
  const caseLinks = await prisma.caseSystemLink.findMany({
    where: { tenantId, caseId },
    include: {
      system: {
        include: {
          processors: {
            include: { vendor: { select: { id: true, name: true, status: true, dpaOnFile: true } } },
          },
        },
      },
    },
  });

  const vendors: DerivedVendor[] = [];
  for (const link of caseLinks) {
    for (const proc of link.system.processors) {
      vendors.push({
        vendorId: proc.vendorId,
        vendorName: proc.vendor?.name ?? proc.vendorName,
        systemId: link.system.id,
        systemName: link.system.name,
        processorRole: proc.role,
        contactEmail: proc.contactEmail,
        dpaOnFile: proc.vendor?.dpaOnFile ?? proc.dpaOnFile,
      });
    }
  }

  return vendors;
}

/**
 * Auto-create vendor requests for all derived vendors for a case.
 * Returns the created request IDs.
 */
export async function autoCreateVendorRequests(
  tenantId: string,
  caseId: string,
  userId: string,
  options?: {
    templateId?: string;
    dueDays?: number;
  },
): Promise<string[]> {
  const derived = await deriveVendorsForCase(tenantId, caseId);
  if (derived.length === 0) return [];

  // Get the case details for placeholders
  const dsarCase = await prisma.dSARCase.findFirst({
    where: { id: caseId, tenantId },
    include: { dataSubject: true },
  });
  if (!dsarCase) return [];

  // Group by vendor (a vendor may appear for multiple systems)
  const vendorMap = new Map<string, DerivedVendor[]>();
  for (const v of derived) {
    const key = v.vendorId || v.vendorName;
    if (!vendorMap.has(key)) vendorMap.set(key, []);
    vendorMap.get(key)!.push(v);
  }

  const dueDays = options?.dueDays ?? 14;
  const dueAt = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

  const requestIds: string[] = [];

  for (const vendorGroup of Array.from(vendorMap.values())) {
    const first = vendorGroup[0];
    if (!first.vendorId) continue; // skip unlinked processors

    // Check if a request already exists for this vendor+case
    const existing = await prisma.vendorRequest.findFirst({
      where: {
        tenantId,
        caseId,
        vendorId: first.vendorId,
        status: { notIn: ["CLOSED"] },
      },
    });
    if (existing) continue;

    const systemNames = vendorGroup.map((vg: DerivedVendor) => vg.systemName).join(", ");
    const subject = `Data Subject Access Request – ${dsarCase.caseNumber}`;
    const bodyHtml = `<p>Dear ${first.vendorName} Privacy Team,</p>
<p>We are processing a DSAR (case ${dsarCase.caseNumber}, type: ${dsarCase.type}) and require your assistance in providing the relevant personal data.</p>
<p><strong>Data Subject:</strong> ${dsarCase.dataSubject.fullName}</p>
<p><strong>Affected Systems:</strong> ${systemNames}</p>
<p>Please respond within ${dueDays} days.</p>
<p>Best regards,<br/>Privacy Team</p>`;

    const request = await prisma.vendorRequest.create({
      data: {
        tenantId,
        caseId,
        vendorId: first.vendorId,
        systemId: first.systemId,
        status: "DRAFT",
        templateId: options?.templateId,
        subject,
        bodyHtml,
        dueAt,
        createdByUserId: userId,
        items: {
          create: vendorGroup.map((vg: DerivedVendor) => ({
            tenantId,
            systemId: vg.systemId,
            description: `Provide personal data from ${vg.systemName} (${vg.processorRole})`,
          })),
        },
      },
    });

    requestIds.push(request.id);
  }

  return requestIds;
}

/**
 * Get vendor request summary for a case.
 */
export async function getVendorRequestSummaryForCase(
  tenantId: string,
  caseId: string,
) {
  const requests = await prisma.vendorRequest.findMany({
    where: { tenantId, caseId },
    include: {
      vendor: { select: { id: true, name: true, shortCode: true } },
      system: { select: { id: true, name: true } },
      _count: { select: { items: true, responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = requests.length;
  const pending = requests.filter((r) => ["DRAFT", "SENT", "ACKNOWLEDGED"].includes(r.status)).length;
  const responded = requests.filter((r) => ["RESPONDED", "PARTIALLY_RESPONDED"].includes(r.status)).length;
  const overdue = requests.filter(
    (r) => r.dueAt && r.dueAt < new Date() && !["RESPONDED", "CLOSED"].includes(r.status),
  ).length;

  return { requests, summary: { total, pending, responded, overdue } };
}
