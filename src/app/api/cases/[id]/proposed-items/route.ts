export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/cases/[id]/proposed-items
 *
 * Returns all DsarCaseItems for a case.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const items = await prisma.dsarCaseItem.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ decision: "asc" }, { matchScore: "desc" }, { riskScore: "desc" }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/proposed-items
 *
 * Auto-propose relevant data assets for a case by matching the data subject's
 * identifiers (name, email, phone) against Finding summaries, EvidenceItem
 * titles/locations/metadata, and system data.
 *
 * MVP: Simple text matching. TODO: Replace with real connector-based search.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { dataSubject: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const ds = dsarCase.dataSubject;

    // Build search terms from data subject identifiers
    const searchTerms: string[] = [];
    if (ds.fullName) searchTerms.push(ds.fullName.toLowerCase());
    if (ds.email) searchTerms.push(ds.email.toLowerCase());
    if (ds.phone) searchTerms.push(ds.phone.replace(/\s/g, ""));

    // Also extract from identifiers JSON if present
    const identifiers = ds.identifiers as Record<string, string> | null;
    if (identifiers) {
      for (const val of Object.values(identifiers)) {
        if (typeof val === "string" && val.length > 2) {
          searchTerms.push(val.toLowerCase());
        }
      }
    }

    if (searchTerms.length === 0) {
      return NextResponse.json(
        { error: "No identifiers available for matching. Add email or name to the data subject." },
        { status: 400 }
      );
    }

    // Count existing proposed items to avoid duplicates
    const existingItemIds = new Set(
      (
        await prisma.dsarCaseItem.findMany({
          where: { caseId: params.id, tenantId: user.tenantId },
          select: { findingId: true, evidenceId: true },
        })
      ).flatMap((i) => [i.findingId, i.evidenceId].filter(Boolean))
    );

    const proposedItems: Array<{
      tenantId: string;
      caseId: string;
      findingId?: string;
      evidenceId?: string;
      systemId?: string;
      assetType: string;
      title: string;
      location?: string;
      dataCategory?: string;
      riskScore?: number;
      matchScore: number;
      matchDetails: Record<string, string[]>;
    }> = [];

    // ──────────────────────────────────────────────────────────────────
    // 1. Match against Findings
    // ──────────────────────────────────────────────────────────────────
    const findings = await prisma.finding.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        summary: true,
        dataCategory: true,
        riskScore: true,
        systemId: true,
        dataAssetLocation: true,
        system: { select: { name: true } },
      },
    });

    for (const f of findings) {
      if (existingItemIds.has(f.id)) continue;

      const matchedTerms: string[] = [];
      const textToSearch = [
        f.summary,
        f.dataAssetLocation ?? "",
        f.system?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      for (const term of searchTerms) {
        if (textToSearch.includes(term)) {
          matchedTerms.push(term);
        }
      }

      if (matchedTerms.length > 0) {
        proposedItems.push({
          tenantId: user.tenantId,
          caseId: params.id,
          findingId: f.id,
          systemId: f.systemId ?? undefined,
          assetType: "finding",
          title: f.summary.slice(0, 200),
          location: f.dataAssetLocation ?? undefined,
          dataCategory: f.dataCategory,
          riskScore: f.riskScore,
          matchScore: matchedTerms.length / searchTerms.length,
          matchDetails: { matchedTerms },
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // 2. Match against Evidence Items
    // TODO: Replace with real connector-based search per system.
    // ──────────────────────────────────────────────────────────────────
    const evidenceItems = await prisma.evidenceItem.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        title: true,
        location: true,
        itemType: true,
        provider: true,
        sensitivityScore: true,
        metadata: true,
      },
    });

    for (const ev of evidenceItems) {
      if (existingItemIds.has(ev.id)) continue;

      const matchedTerms: string[] = [];
      const metaStr = ev.metadata ? JSON.stringify(ev.metadata).toLowerCase() : "";
      const textToSearch = [ev.title, ev.location, metaStr].join(" ").toLowerCase();

      for (const term of searchTerms) {
        if (textToSearch.includes(term)) {
          matchedTerms.push(term);
        }
      }

      if (matchedTerms.length > 0) {
        proposedItems.push({
          tenantId: user.tenantId,
          caseId: params.id,
          evidenceId: ev.id,
          assetType: "evidence",
          title: ev.title.slice(0, 200),
          location: ev.location,
          riskScore: ev.sensitivityScore ?? undefined,
          matchScore: matchedTerms.length / searchTerms.length,
          matchDetails: { matchedTerms },
        });
      }
    }

    // Sort by match score descending, take top 50 for MVP
    proposedItems.sort((a, b) => b.matchScore - a.matchScore);
    const topItems = proposedItems.slice(0, 50);

    // Batch create
    let createdCount = 0;
    if (topItems.length > 0) {
      const result = await prisma.dsarCaseItem.createMany({
        data: topItems.map((item) => ({
          tenantId: item.tenantId,
          caseId: item.caseId,
          findingId: item.findingId ?? null,
          evidenceId: item.evidenceId ?? null,
          systemId: item.systemId ?? null,
          assetType: item.assetType,
          title: item.title,
          location: item.location ?? null,
          dataCategory: item.dataCategory ?? null,
          riskScore: item.riskScore ?? null,
          matchScore: item.matchScore,
          matchDetails: item.matchDetails,
          decision: "PROPOSED",
        })),
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    // Audit event
    await prisma.dsarAuditEvent.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        actorUserId: user.id,
        action: "items.auto_proposed",
        entityType: "DsarCaseItem",
        details: {
          searchTerms,
          findingsScanned: findings.length,
          evidenceScanned: evidenceItems.length,
          proposedCount: createdCount,
        },
      },
    });

    return NextResponse.json({
      proposed: createdCount,
      searchTerms,
      findingsScanned: findings.length,
      evidenceScanned: evidenceItems.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
