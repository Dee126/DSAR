/**
 * Authority Export Service
 *
 * Generates "Authority Packs" for supervisory authority submissions.
 * Produces a PDF summary report and a ZIP evidence bundle.
 *
 * Multi-tenant safe.
 */

import { prisma } from "./prisma";
import { getStorage } from "./storage";
import * as crypto from "crypto";

interface ExportOptions {
  includeTimeline?: boolean;
  includeDsarList?: boolean;
  includeEvidence?: boolean;
  includeResponses?: boolean;
}

/**
 * Generate an Authority Pack for an incident.
 */
export async function generateAuthorityExport(
  tenantId: string,
  incidentId: string,
  userId: string,
  options: ExportOptions = {},
): Promise<{ exportRunId: string }> {
  const includeTimeline = options.includeTimeline ?? true;
  const includeDsarList = options.includeDsarList ?? true;
  const includeEvidence = options.includeEvidence ?? false;
  const includeResponses = options.includeResponses ?? false;

  // Create pending export run
  const exportRun = await prisma.authorityExportRun.create({
    data: {
      tenantId,
      incidentId,
      status: "GENERATING",
      includeTimeline,
      includeDsarList,
      includeEvidence,
      includeResponses,
      createdByUserId: userId,
    },
  });

  try {
    // Load incident with all related data
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, tenantId },
      include: {
        createdBy: { select: { name: true, email: true } },
        incidentSystems: {
          include: { system: { select: { name: true, description: true } } },
        },
        contacts: true,
        timeline: {
          orderBy: { timestamp: "asc" },
          include: { createdBy: { select: { name: true } } },
        },
        assessments: { orderBy: { version: "desc" }, take: 1 },
        regulatorRecords: true,
        dsarIncidents: {
          include: {
            case: {
              select: {
                id: true,
                caseNumber: true,
                type: true,
                status: true,
                priority: true,
                dueDate: true,
                dataSubject: { select: { fullName: true } },
                responseDocuments: {
                  where: { status: { in: ["APPROVED", "SENT"] } },
                  select: { id: true, version: true, status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    // Generate PDF summary
    const pdfContent = buildAuthorityPdfContent(incident, {
      includeTimeline,
      includeDsarList,
    });
    const pdfBuffer = buildSimplePdf(pdfContent, `Authority-Pack-${incident.id}`);
    const storage = getStorage();
    const pdfResult = await storage.upload(
      pdfBuffer,
      `authority-pack-${incidentId}.pdf`,
      "application/pdf",
    );

    // Generate timeline CSV if included
    const csvParts: Array<{ filename: string; content: string }> = [];

    if (includeTimeline && incident.timeline.length > 0) {
      const timelineCsv = buildTimelineCsv(incident.timeline);
      csvParts.push({ filename: "incident-timeline.csv", content: timelineCsv });
    }

    if (includeDsarList && incident.dsarIncidents.length > 0) {
      const dsarCsv = buildDsarListCsv(incident.dsarIncidents);
      csvParts.push({ filename: "linked-dsar-cases.csv", content: dsarCsv });
    }

    // Build a combined text manifest (ZIP placeholder: production should use archiver)
    let manifestContent = `AUTHORITY EXPORT PACK\n`;
    manifestContent += `======================\n\n`;
    manifestContent += `Incident: ${incident.title}\n`;
    manifestContent += `Generated: ${new Date().toISOString()}\n\n`;
    manifestContent += `Files included:\n`;
    manifestContent += `  - authority-pack-${incidentId}.pdf (Summary Report)\n`;
    csvParts.forEach((p) => {
      manifestContent += `  - ${p.filename}\n`;
    });
    if (includeEvidence) {
      manifestContent += `  - [Evidence documents referenced but not included in this placeholder bundle]\n`;
    }
    if (includeResponses) {
      const approvedDocs = incident.dsarIncidents
        .flatMap((di) => di.case.responseDocuments)
        .filter((d) => d);
      manifestContent += `  - ${approvedDocs.length} approved/sent response document(s) referenced\n`;
    }

    // Store CSV files via storage
    const bundleFiles: string[] = [pdfResult.storageKey];
    for (const csvPart of csvParts) {
      const csvBuffer = Buffer.from(csvPart.content, "utf-8");
      const csvResult = await storage.upload(csvBuffer, csvPart.filename, "text/csv");
      bundleFiles.push(csvResult.storageKey);
    }

    // Store manifest as ZIP placeholder
    const manifestBuffer = Buffer.from(manifestContent, "utf-8");
    const zipResult = await storage.upload(
      manifestBuffer,
      `authority-pack-${incidentId}-manifest.txt`,
      "text/plain",
    );

    // Compute checksum of PDF
    const checksum = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // Update export run
    await prisma.authorityExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "COMPLETED",
        pdfStorageKey: pdfResult.storageKey,
        zipStorageKey: zipResult.storageKey,
        fileChecksum: checksum,
        fileSize: pdfResult.size,
        completedAt: new Date(),
      },
    });

    return { exportRunId: exportRun.id };
  } catch (error) {
    await prisma.authorityExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function getExportRun(tenantId: string, exportRunId: string) {
  return prisma.authorityExportRun.findFirst({
    where: { id: exportRunId, tenantId },
    include: {
      incident: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

// ─── PDF Generation Helpers ──────────────────────────────────────────────────

function buildAuthorityPdfContent(
  incident: {
    title: string;
    description: string | null;
    severity: string;
    status: string;
    detectedAt: Date | null;
    containedAt: Date | null;
    resolvedAt: Date | null;
    regulatorNotificationRequired: boolean;
    regulatorNotifiedAt: Date | null;
    numberOfDataSubjectsEstimate: number | null;
    categoriesOfDataAffected: string[];
    crossBorder: boolean;
    contacts: Array<{ role: string; name: string; email: string | null }>;
    assessments: Array<{
      natureOfBreach: string | null;
      categoriesAndApproxSubjects: string | null;
      categoriesAndApproxRecords: string | null;
      likelyConsequences: string | null;
      measuresTakenOrProposed: string | null;
      dpoContactDetails: string | null;
    }>;
    timeline: Array<{ eventType: string; timestamp: Date; description: string }>;
    regulatorRecords: Array<{
      authorityName: string;
      referenceNumber: string | null;
      status: string;
    }>;
    dsarIncidents: Array<{
      case: {
        caseNumber: string;
        type: string;
        status: string;
        dueDate: Date;
        dataSubject: { fullName: string };
      };
    }>;
  },
  options: { includeTimeline: boolean; includeDsarList: boolean },
): string {
  const lines: string[] = [];
  const formatDate = (d: Date | null) => d ? d.toISOString().split("T")[0] : "N/A";

  lines.push("AUTHORITY SUBMISSION - INCIDENT SUMMARY REPORT");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`Report Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Section 1: Incident Overview
  lines.push("1. INCIDENT OVERVIEW");
  lines.push("-".repeat(30));
  lines.push(`Title: ${incident.title}`);
  lines.push(`Severity: ${incident.severity}`);
  lines.push(`Status: ${incident.status}`);
  lines.push(`Description: ${incident.description || "N/A"}`);
  lines.push(`Detected: ${formatDate(incident.detectedAt)}`);
  lines.push(`Contained: ${formatDate(incident.containedAt)}`);
  lines.push(`Resolved: ${formatDate(incident.resolvedAt)}`);
  lines.push(`Cross-border: ${incident.crossBorder ? "Yes" : "No"}`);
  lines.push(`Estimated data subjects affected: ${incident.numberOfDataSubjectsEstimate ?? "Unknown"}`);
  lines.push(`Categories of data affected: ${incident.categoriesOfDataAffected.join(", ") || "N/A"}`);
  lines.push(`Regulator notification required: ${incident.regulatorNotificationRequired ? "Yes" : "No"}`);
  lines.push(`Regulator notified: ${formatDate(incident.regulatorNotifiedAt)}`);
  lines.push("");

  // Section 2: Assessment (Art. 33/34)
  const assessment = incident.assessments[0];
  lines.push("2. BREACH ASSESSMENT (GDPR Art. 33/34)");
  lines.push("-".repeat(30));
  if (assessment) {
    lines.push(`Nature of breach: ${assessment.natureOfBreach || "N/A"}`);
    lines.push(`Categories and approx. number of data subjects: ${assessment.categoriesAndApproxSubjects || "N/A"}`);
    lines.push(`Categories and approx. number of records: ${assessment.categoriesAndApproxRecords || "N/A"}`);
    lines.push(`Likely consequences: ${assessment.likelyConsequences || "N/A"}`);
    lines.push(`Measures taken or proposed: ${assessment.measuresTakenOrProposed || "N/A"}`);
    lines.push(`DPO contact details: ${assessment.dpoContactDetails || "N/A"}`);
  } else {
    lines.push("No assessment recorded.");
  }
  lines.push("");

  // Section 3: Contacts
  lines.push("3. KEY CONTACTS");
  lines.push("-".repeat(30));
  if (incident.contacts.length > 0) {
    for (const contact of incident.contacts) {
      lines.push(`  ${contact.role}: ${contact.name} (${contact.email || "no email"})`);
    }
  } else {
    lines.push("  No contacts recorded.");
  }
  lines.push("");

  // Section 4: Regulator Records
  lines.push("4. SUPERVISORY AUTHORITY RECORDS");
  lines.push("-".repeat(30));
  if (incident.regulatorRecords.length > 0) {
    for (const rec of incident.regulatorRecords) {
      lines.push(`  Authority: ${rec.authorityName}`);
      lines.push(`  Reference: ${rec.referenceNumber || "Pending"}`);
      lines.push(`  Status: ${rec.status}`);
      lines.push("");
    }
  } else {
    lines.push("  No regulator records.");
  }
  lines.push("");

  // Section 5: Timeline
  if (options.includeTimeline && incident.timeline.length > 0) {
    lines.push("5. INCIDENT TIMELINE");
    lines.push("-".repeat(30));
    for (const event of incident.timeline) {
      lines.push(`  ${formatDate(event.timestamp)} [${event.eventType}] ${event.description}`);
    }
    lines.push("");
  }

  // Section 6: Linked DSARs
  if (options.includeDsarList && incident.dsarIncidents.length > 0) {
    lines.push("6. LINKED DSAR CASES");
    lines.push("-".repeat(30));
    lines.push(`  Total linked: ${incident.dsarIncidents.length}`);
    lines.push("");
    for (const link of incident.dsarIncidents) {
      const c = link.case;
      lines.push(`  ${c.caseNumber} | ${c.type} | ${c.status} | Due: ${formatDate(c.dueDate)} | Subject: ${c.dataSubject.fullName}`);
    }
    lines.push("");
  }

  // Disclaimer
  lines.push("-".repeat(50));
  lines.push("DISCLAIMER: This report is generated from case management data.");
  lines.push("It is provided for regulatory compliance purposes and must be");
  lines.push("reviewed by the Data Protection Officer before submission.");

  return lines.join("\n");
}

function buildTimelineCsv(
  timeline: Array<{
    eventType: string;
    timestamp: Date;
    description: string;
    createdBy: { name: string };
  }>,
): string {
  const header = "Timestamp,Event Type,Description,Recorded By";
  const rows = timeline.map(
    (e) =>
      `"${e.timestamp.toISOString()}","${e.eventType}","${csvEscape(e.description)}","${csvEscape(e.createdBy.name)}"`,
  );
  return [header, ...rows].join("\n");
}

function buildDsarListCsv(
  dsarIncidents: Array<{
    case: {
      caseNumber: string;
      type: string;
      status: string;
      priority: string;
      dueDate: Date;
      dataSubject: { fullName: string };
    };
  }>,
): string {
  const header = "Case Number,DSAR Type,Status,Priority,Due Date,Data Subject";
  const rows = dsarIncidents.map(
    (di) => {
      const c = di.case;
      return `"${c.caseNumber}","${c.type}","${c.status}","${c.priority}","${c.dueDate.toISOString().split("T")[0]}","${csvEscape(c.dataSubject.fullName)}"`;
    },
  );
  return [header, ...rows].join("\n");
}

function csvEscape(str: string): string {
  return str.replace(/"/g, '""');
}

// ─── Minimal PDF Builder (reuses pattern from response-export.ts) ────────────

function buildSimplePdf(text: string, _title: string): Buffer {
  const sanitized = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const lines = sanitized.split("\n");
  const pageLines: string[] = [];
  const maxLineLength = 90;

  for (const line of lines) {
    if (line.length <= maxLineLength) {
      pageLines.push(line);
    } else {
      let remaining = line;
      while (remaining.length > maxLineLength) {
        let breakAt = remaining.lastIndexOf(" ", maxLineLength);
        if (breakAt === -1) breakAt = maxLineLength;
        pageLines.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trimStart();
      }
      if (remaining) pageLines.push(remaining);
    }
  }

  const lineHeight = 14;
  const fontSize = 10;
  const margin = 50;
  const pageHeight = 842;
  const pageWidth = 595;
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < pageLines.length; i += linesPerPage) {
    pages.push(pageLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  let objectCount = 0;

  function addObject(content: string): number {
    objectCount++;
    objects.push(`${objectCount} 0 obj\n${content}\nendobj\n`);
    return objectCount;
  }

  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  const pageRefs = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  addObject(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);

  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLinesChunk of pages) {
    let textOps = `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n`;
    for (const pLine of pageLinesChunk) {
      textOps += `(${pLine}) Tj\n0 -${lineHeight} Td\n`;
    }
    textOps += "ET";

    const streamObj = addObject(
      `<< /Length ${textOps.length} >>\nstream\n${textOps}\nendstream`,
    );

    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObj} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
  }

  const header = "%PDF-1.4\n";
  let body = "";
  const xrefOffsets: number[] = [];

  for (const obj of objects) {
    xrefOffsets.push(header.length + body.length);
    body += obj;
  }

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (const offset of xrefOffsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "binary");
}
