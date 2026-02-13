import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";

const createSummarySchema = z.object({
  summaryType: z.enum([
    "LOCATION_OVERVIEW",
    "CATEGORY_OVERVIEW",
    "DSAR_DRAFT",
    "RISK_SUMMARY",
  ]),
});

/* -- POST — Generate a summary for a copilot run -------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "create");

    const { id: caseId, runId } = await params;

    const body = await request.json();
    const data = createSummarySchema.parse(body);

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Load the copilot run with evidence and findings for summary generation
    const run = await prisma.copilotRun.findFirst({
      where: {
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
      include: {
        queries: {
          include: {
            integration: {
              select: { id: true, name: true, provider: true },
            },
          },
        },
        evidenceItems: true,
        findings: true,
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    if (run.status !== "COMPLETED") {
      throw new ApiError(
        400,
        `Cannot generate summary for a run with status "${run.status}". Run must be COMPLETED.`
      );
    }

    // Generate summary content based on type
    const content = generateSummaryContent(data.summaryType, run, dsarCase);

    // Compute evidence snapshot hash to verify summary matches current evidence state
    const evidenceSnapshot = JSON.stringify({
      findings: run.findings.map((f) => f.id).sort(),
      evidenceItems: run.evidenceItems.map((e) => e.id).sort(),
      queries: run.queries.map((q) => q.id).sort(),
    });
    const evidenceSnapshotHash = crypto
      .createHash("sha256")
      .update(evidenceSnapshot)
      .digest("hex");

    // Create the CopilotSummary record
    const summary = await prisma.copilotSummary.create({
      data: {
        tenantId: user.tenantId,
        caseId,
        runId,
        createdByUserId: user.id,
        summaryType: data.summaryType,
        content,
        evidenceSnapshotHash,
        disclaimerIncluded: true,
      },
    });

    // Log audit event
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "copilot_summary.created",
      entityType: "CopilotSummary",
      entityId: summary.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId,
        caseNumber: dsarCase.caseNumber,
        runId,
        summaryType: data.summaryType,
      },
    });

    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/* -- Summary generation helpers -------------------------------------------- */

interface RunWithRelations {
  id: string;
  resultSummary: string | null;
  totalFindings: number;
  totalEvidenceItems: number;
  containsSpecialCategory: boolean;
  legalApprovalStatus: string;
  queries: Array<{
    id: string;
    provider: string | null;
    status: string;
    recordsFound: number | null;
    integration: { id: string; name: string; provider: string } | null;
  }>;
  evidenceItems: Array<{
    id: string;
    provider: string;
    workload: string | null;
    itemType: string;
    location: string;
    title: string;
  }>;
  findings: Array<{
    id: string;
    dataCategory: string;
    severity: string;
    confidence: number;
    summary: string;
    containsSpecialCategory: boolean;
    requiresLegalReview: boolean;
  }>;
}

interface CaseInfo {
  caseNumber: string;
  type: string;
}

function generateSummaryContent(
  summaryType: string,
  run: RunWithRelations,
  dsarCase: CaseInfo
): string {
  const lines: string[] = [];
  const disclaimer =
    "\n---\nDisclaimer: This summary was generated automatically based on available evidence. " +
    "It should be reviewed by a qualified professional before use in any formal response.";

  switch (summaryType) {
    case "LOCATION_OVERVIEW":
      lines.push(`=== Data Location Overview ===`);
      lines.push(`Case: ${dsarCase.caseNumber} (${dsarCase.type})`);
      lines.push(`Run: ${run.id}`);
      lines.push("");
      lines.push(`Systems queried: ${run.queries.length}`);
      lines.push(`Evidence items collected: ${run.totalEvidenceItems}`);
      lines.push("");

      if (run.evidenceItems.length === 0) {
        lines.push("No evidence items were found during this discovery run.");
      } else {
        lines.push("Data Locations:");
        const byProvider = new Map<string, typeof run.evidenceItems>();
        for (const item of run.evidenceItems) {
          const list = byProvider.get(item.provider) ?? [];
          list.push(item);
          byProvider.set(item.provider, list);
        }
        for (const provider of Array.from(byProvider.keys())) {
          const items: typeof run.evidenceItems = byProvider.get(provider)!;
          lines.push(`  ${provider}:`);
          for (const item of items) {
            lines.push(`    - ${item.title} (${item.itemType}) @ ${item.location}`);
          }
        }
      }
      break;

    case "CATEGORY_OVERVIEW":
      lines.push(`=== Data Category Overview ===`);
      lines.push(`Case: ${dsarCase.caseNumber} (${dsarCase.type})`);
      lines.push(`Run: ${run.id}`);
      lines.push("");
      lines.push(`Total findings: ${run.totalFindings}`);
      lines.push(
        `Special category data: ${run.containsSpecialCategory ? "YES" : "No"}`
      );
      lines.push("");

      if (run.findings.length === 0) {
        lines.push("No data category findings were produced.");
      } else {
        lines.push("Findings by Category:");
        for (const finding of run.findings) {
          const specialLabel = finding.containsSpecialCategory
            ? " [ART. 9 SPECIAL CATEGORY]"
            : "";
          lines.push(
            `  ${finding.dataCategory} (${finding.severity})${specialLabel}:`
          );
          lines.push(`    ${finding.summary}`);
          lines.push(
            `    Confidence: ${(finding.confidence * 100).toFixed(0)}%`
          );
          if (finding.requiresLegalReview) {
            lines.push(`    ** Requires legal review **`);
          }
        }
      }
      break;

    case "DSAR_DRAFT":
      lines.push(`=== DSAR Response Draft ===`);
      lines.push(`Case: ${dsarCase.caseNumber} (${dsarCase.type})`);
      lines.push(`Run: ${run.id}`);
      lines.push("");
      lines.push(
        "Dear Data Subject,"
      );
      lines.push("");
      lines.push(
        "In response to your data subject access request, we have conducted a " +
          "comprehensive search across our data systems. Below is a summary of the " +
          "personal data we hold relating to you."
      );
      lines.push("");

      if (run.findings.length > 0) {
        lines.push("Categories of personal data found:");
        for (const finding of run.findings) {
          lines.push(`  - ${finding.dataCategory}: ${finding.summary}`);
        }
        lines.push("");
        lines.push(
          `Data was located across ${run.totalEvidenceItems} data source(s).`
        );
      } else {
        lines.push(
          "Our search did not identify personal data relating to you in our systems."
        );
      }

      if (run.containsSpecialCategory) {
        lines.push("");
        lines.push(
          "Please note: Special category data (as defined under Art. 9 GDPR) was identified. " +
            "This data requires additional safeguards and has been flagged for legal review."
        );
      }

      lines.push("");
      lines.push(
        "If you have any questions about this response, please contact our Data Protection Officer."
      );
      break;

    case "RISK_SUMMARY":
      lines.push(`=== Risk Summary ===`);
      lines.push(`Case: ${dsarCase.caseNumber} (${dsarCase.type})`);
      lines.push(`Run: ${run.id}`);
      lines.push("");

      const criticalFindings = run.findings.filter(
        (f) => f.severity === "CRITICAL"
      );
      const warningFindings = run.findings.filter(
        (f) => f.severity === "WARNING"
      );
      const legalReviewRequired = run.findings.filter(
        (f) => f.requiresLegalReview
      );

      lines.push(`Risk Indicators:`);
      lines.push(
        `  Special category data detected: ${run.containsSpecialCategory ? "YES" : "No"}`
      );
      lines.push(
        `  Legal approval status: ${run.legalApprovalStatus}`
      );
      lines.push(`  Critical findings: ${criticalFindings.length}`);
      lines.push(`  Warning findings: ${warningFindings.length}`);
      lines.push(
        `  Findings requiring legal review: ${legalReviewRequired.length}`
      );
      lines.push("");

      if (criticalFindings.length > 0) {
        lines.push("Critical Findings:");
        for (const f of criticalFindings) {
          lines.push(`  - ${f.dataCategory}: ${f.summary}`);
        }
        lines.push("");
      }

      if (warningFindings.length > 0) {
        lines.push("Warning Findings:");
        for (const f of warningFindings) {
          lines.push(`  - ${f.dataCategory}: ${f.summary}`);
        }
        lines.push("");
      }

      if (
        criticalFindings.length === 0 &&
        warningFindings.length === 0
      ) {
        lines.push("No elevated risk findings were detected.");
      }
      break;

    default:
      lines.push(`Summary type "${summaryType}" is not supported.`);
  }

  lines.push(disclaimer);
  return lines.join("\n");
}
