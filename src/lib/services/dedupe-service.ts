import { prisma } from "../prisma";

export interface DedupeMatch {
  caseId: string;
  caseNumber: string;
  score: number;
  reasons: string[];
}

function normalise(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  // Simple token overlap
  const tokensA = new Set(na.split(/\s+/));
  const tokensB = new Set(nb.split(/\s+/));
  let overlap = 0;
  Array.from(tokensA).forEach((t) => {
    if (tokensB.has(t)) overlap++;
  });
  const total = Math.max(tokensA.size, tokensB.size);
  return total > 0 ? overlap / total : 0;
}

export async function findDuplicates(
  tenantId: string,
  input: {
    email?: string | null;
    phone?: string | null;
    customerId?: string | null;
    employeeId?: string | null;
    name?: string | null;
    address?: string | null;
  },
  excludeCaseId?: string,
  windowDays: number = 30
): Promise<DedupeMatch[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // Find recent cases with matching identifiers
  const cases = await prisma.dSARCase.findMany({
    where: {
      tenantId,
      createdAt: { gte: cutoff },
      deletedAt: null,
      ...(excludeCaseId ? { id: { not: excludeCaseId } } : {}),
    },
    include: { dataSubject: true },
  });

  const matches: DedupeMatch[] = [];

  for (const c of cases) {
    const ds = c.dataSubject;
    if (!ds) continue;

    let score = 0;
    const reasons: string[] = [];

    // Email match (strongest signal)
    if (input.email && ds.email && normalise(input.email) === normalise(ds.email)) {
      score += 0.4;
      reasons.push("Email match");
    }

    // Phone match
    if (input.phone && ds.phone) {
      const pA = input.phone.replace(/\D/g, "");
      const pB = ds.phone.replace(/\D/g, "");
      if (pA.length >= 6 && pA === pB) {
        score += 0.25;
        reasons.push("Phone match");
      }
    }

    // CustomerId / EmployeeId match
    const identifiers = (ds.identifiers as Record<string, string>) || {};
    if (input.customerId && (identifiers.customerId === input.customerId || c.requesterType === input.customerId)) {
      score += 0.3;
      reasons.push("Customer ID match");
    }
    if (input.employeeId && identifiers.employeeId === input.employeeId) {
      score += 0.3;
      reasons.push("Employee ID match");
    }

    // Name similarity
    if (input.name && ds.fullName) {
      const sim = nameSimilarity(input.name, ds.fullName);
      if (sim >= 0.5) {
        score += sim * 0.2;
        reasons.push(`Name similarity (${Math.round(sim * 100)}%)`);
      }
    }

    // Recency bonus (more recent = higher chance of duplicate)
    const daysSince = (Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      score += 0.05;
      reasons.push("Created within 7 days");
    }

    // Cap at 1.0
    score = Math.min(score, 1.0);

    if (score >= 0.3 && reasons.length > 0) {
      matches.push({
        caseId: c.id,
        caseNumber: c.caseNumber,
        score: Math.round(score * 100) / 100,
        reasons,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

export async function createDedupeCandidates(
  tenantId: string,
  caseId: string,
  matches: DedupeMatch[]
): Promise<void> {
  for (const m of matches) {
    await prisma.dedupeCandidate.upsert({
      where: {
        caseId_candidateCaseId: {
          caseId,
          candidateCaseId: m.caseId,
        },
      },
      create: {
        tenantId,
        caseId,
        candidateCaseId: m.caseId,
        score: m.score,
        reasons: m.reasons,
      },
      update: {
        score: m.score,
        reasons: m.reasons,
        status: "PENDING",
      },
    });
  }
}

export async function linkAsDuplicate(
  tenantId: string,
  caseId: string,
  duplicateOfCaseId: string,
  candidateId: string
): Promise<void> {
  await prisma.$transaction([
    prisma.dSARCase.update({
      where: { id: caseId, tenantId },
      data: { duplicateOfCaseId },
    }),
    prisma.dedupeCandidate.update({
      where: { id: candidateId },
      data: { status: "LINKED", resolvedAt: new Date() },
    }),
  ]);
}

export async function mergeCases(
  tenantId: string,
  sourceCaseId: string,
  targetCaseId: string,
  candidateId: string
): Promise<void> {
  // Move tasks, documents, comments from source to target
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { caseId: sourceCaseId, tenantId },
      data: { caseId: targetCaseId },
    }),
    prisma.document.updateMany({
      where: { caseId: sourceCaseId, tenantId },
      data: { caseId: targetCaseId },
    }),
    prisma.comment.updateMany({
      where: { caseId: sourceCaseId, tenantId },
      data: { caseId: targetCaseId },
    }),
    prisma.dSARCase.update({
      where: { id: sourceCaseId, tenantId },
      data: {
        duplicateOfCaseId: targetCaseId,
        status: "CLOSED",
        description: `[Merged into ${targetCaseId}] ${(await prisma.dSARCase.findUnique({ where: { id: sourceCaseId } }))?.description || ""}`,
      },
    }),
    prisma.dedupeCandidate.update({
      where: { id: candidateId },
      data: { status: "MERGED", resolvedAt: new Date() },
    }),
  ]);
}

export async function dismissCandidate(candidateId: string): Promise<void> {
  await prisma.dedupeCandidate.update({
    where: { id: candidateId },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
}
