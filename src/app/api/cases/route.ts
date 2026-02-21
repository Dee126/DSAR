export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createCaseSchema } from "@/lib/validation";
import { generateCaseNumber, calculateDueDate } from "@/lib/utils";
import { CaseStatus, DSARType, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") as CaseStatus | null;
    const type = searchParams.get("type") as DSARType | null;
    const assignee = searchParams.get("assignee");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.DSARCaseWhereInput = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (assignee) {
      where.assignedToUserId = assignee;
    }

    if (search) {
      where.OR = [
        { caseNumber: { contains: search, mode: "insensitive" } },
        {
          dataSubject: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
        {
          dataSubject: {
            email: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.dSARCase.findMany({
        where,
        include: {
          dataSubject: true,
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dSARCase.count({ where }),
    ]);

    return NextResponse.json({
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "create");

    const body = await request.json();
    const data = createCaseSchema.parse(body);

    const { dataSubject: dsData, ...caseData } = data;

    // Find or create DataSubject
    let dataSubject;
    if (dsData.id) {
      dataSubject = await prisma.dataSubject.findFirst({
        where: { id: dsData.id, tenantId: user.tenantId },
      });
      if (!dataSubject) {
        return NextResponse.json(
          { error: "Data subject not found" },
          { status: 404 }
        );
      }
      // Update data subject fields if provided
      dataSubject = await prisma.dataSubject.update({
        where: { id: dataSubject.id },
        data: {
          fullName: dsData.fullName,
          ...(dsData.email !== undefined && { email: dsData.email || null }),
          ...(dsData.phone !== undefined && { phone: dsData.phone || null }),
          ...(dsData.address !== undefined && { address: dsData.address || null }),
        },
      });
    } else {
      dataSubject = await prisma.dataSubject.create({
        data: {
          tenantId: user.tenantId,
          fullName: dsData.fullName,
          email: dsData.email || null,
          phone: dsData.phone || null,
          address: dsData.address || null,
        },
      });
    }

    // Get tenant SLA days for due date calculation
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
    });

    const receivedAt = caseData.receivedAt
      ? new Date(caseData.receivedAt)
      : new Date();
    const dueDate = calculateDueDate(receivedAt, tenant.slaDefaultDays);
    const caseNumber = generateCaseNumber();

    const newCase = await prisma.dSARCase.create({
      data: {
        tenantId: user.tenantId,
        caseNumber,
        type: caseData.type,
        priority: caseData.priority,
        channel: caseData.channel ?? null,
        requesterType: caseData.requesterType ?? null,
        description: caseData.description ?? null,
        lawfulBasis: caseData.lawfulBasis ?? null,
        receivedAt,
        dueDate,
        dataSubjectId: dataSubject.id,
        createdByUserId: user.id,
      },
      include: {
        dataSubject: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.created",
      entityType: "DSARCase",
      entityId: newCase.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: newCase.caseNumber,
        type: newCase.type,
        dataSubjectName: dataSubject.fullName,
      },
    });

    // Create DSAR audit event for the new case
    await prisma.dsarAuditEvent.create({
      data: {
        tenantId: user.tenantId,
        caseId: newCase.id,
        actorUserId: user.id,
        action: "case.created",
        entityType: "DSARCase",
        entityId: newCase.id,
        details: {
          caseNumber: newCase.caseNumber,
          type: newCase.type,
          dataSubjectName: dataSubject.fullName,
          dataSubjectEmail: dataSubject.email,
        },
      },
    });

    // Auto-propose relevant data assets (best-effort, non-blocking)
    autoProposeCaseItems(user.tenantId, newCase.id, dataSubject, user.id).catch(
      (err) => console.error("[auto-propose] failed:", err)
    );

    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Auto-propose data assets for a newly created case by matching data subject
 * identifiers against findings and evidence items.
 *
 * This runs as a best-effort background task after case creation.
 * TODO: Replace text matching with real connector-based search per system.
 */
async function autoProposeCaseItems(
  tenantId: string,
  caseId: string,
  dataSubject: { fullName: string; email: string | null; phone: string | null; identifiers?: unknown },
  actorUserId: string
) {
  const searchTerms: string[] = [];
  if (dataSubject.fullName) searchTerms.push(dataSubject.fullName.toLowerCase());
  if (dataSubject.email) searchTerms.push(dataSubject.email.toLowerCase());
  if (dataSubject.phone) searchTerms.push(dataSubject.phone.replace(/\s/g, ""));

  if (searchTerms.length === 0) return;

  // Match findings
  const findings = await prisma.finding.findMany({
    where: { tenantId },
    select: {
      id: true, summary: true, dataCategory: true,
      riskScore: true, systemId: true, dataAssetLocation: true,
    },
  });

  const items: Array<{
    tenantId: string; caseId: string; findingId?: string; evidenceId?: string;
    systemId?: string | null; assetType: string; title: string; location?: string | null;
    dataCategory?: string; riskScore?: number; matchScore: number;
    matchDetails: { matchedTerms: string[] };
  }> = [];

  for (const f of findings) {
    const text = [f.summary, f.dataAssetLocation ?? ""].join(" ").toLowerCase();
    const matched = searchTerms.filter((t) => text.includes(t));
    if (matched.length > 0) {
      items.push({
        tenantId, caseId, findingId: f.id, systemId: f.systemId,
        assetType: "finding", title: f.summary.slice(0, 200),
        location: f.dataAssetLocation, dataCategory: f.dataCategory,
        riskScore: f.riskScore, matchScore: matched.length / searchTerms.length,
        matchDetails: { matchedTerms: matched },
      });
    }
  }

  // Match evidence items
  const evidenceItems = await prisma.evidenceItem.findMany({
    where: { tenantId },
    select: {
      id: true, title: true, location: true, sensitivityScore: true, metadata: true,
    },
  });

  for (const ev of evidenceItems) {
    const metaStr = ev.metadata ? JSON.stringify(ev.metadata).toLowerCase() : "";
    const text = [ev.title, ev.location, metaStr].join(" ").toLowerCase();
    const matched = searchTerms.filter((t) => text.includes(t));
    if (matched.length > 0) {
      items.push({
        tenantId, caseId, evidenceId: ev.id, assetType: "evidence",
        title: ev.title.slice(0, 200), location: ev.location,
        riskScore: ev.sensitivityScore ?? undefined,
        matchScore: matched.length / searchTerms.length,
        matchDetails: { matchedTerms: matched },
      });
    }
  }

  // Take top 50 by match score
  items.sort((a, b) => b.matchScore - a.matchScore);
  const top = items.slice(0, 50);

  if (top.length > 0) {
    await prisma.dsarCaseItem.createMany({
      data: top.map((item) => ({
        tenantId: item.tenantId, caseId: item.caseId,
        findingId: item.findingId ?? null, evidenceId: item.evidenceId ?? null,
        systemId: item.systemId ?? null, assetType: item.assetType,
        title: item.title, location: item.location ?? null,
        dataCategory: item.dataCategory ?? null, riskScore: item.riskScore ?? null,
        matchScore: item.matchScore, matchDetails: item.matchDetails,
        decision: "PROPOSED" as const,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.dsarAuditEvent.create({
    data: {
      tenantId, caseId, actorUserId,
      action: "items.auto_proposed",
      entityType: "DsarCaseItem",
      details: {
        searchTerms, findingsScanned: findings.length,
        evidenceScanned: evidenceItems.length, proposedCount: top.length,
      },
    },
  });
}
